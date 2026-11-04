"""Company-shared access model: everyone reads everything; writes differ by role/ownership."""

from conftest import STRONG_CV, drain_pipeline, upload

JOB = {
    "title": "Senior Python Backend Engineer",
    "description": "Build and operate Python APIs.",
    "required_skills": ["Python", "FastAPI"],
}


async def _account(client, admin_headers, email: str, role: str) -> dict[str, str]:
    user = {"email": email, "password": "Password1", "full_name": email.split("@")[0], "role": role}
    assert (await client.post("/api/v1/auth/register", json=user, headers=admin_headers)).status_code == 201
    login = await client.post("/api/v1/auth/login", json={"email": email, "password": "Password1"})
    return {"Authorization": f"Bearer {login.json()['data']['access_token']}"}


async def test_every_role_sees_shared_jobs_cvs_rankings_and_dashboard(client, admin_headers):
    rec_a = await _account(client, admin_headers, "a@example.com", "recruiter")
    rec_b = await _account(client, admin_headers, "b@example.com", "recruiter")
    viewer = await _account(client, admin_headers, "v@example.com", "viewer")

    job = (await client.post("/api/v1/jobs", json=JOB, headers=rec_a)).json()["data"]
    cv = (await upload(client, rec_a, "Nguyen Van Strong", STRONG_CV)).json()["data"]
    await drain_pipeline()

    # Another recruiter can run matching on a colleague's JD
    run = await client.post("/api/v1/matching/run", json={"job_id": job["id"]}, headers=rec_b)
    assert run.status_code == 202 and run.json()["data"]["queued"] == 1
    await drain_pipeline()

    for headers in (admin_headers, rec_b, viewer):
        jobs = (await client.get("/api/v1/jobs", headers=headers)).json()["data"]
        assert [j["id"] for j in jobs["items"]] == [job["id"]]
        assert (await client.get(f"/api/v1/jobs/{job['id']}", headers=headers)).status_code == 200

        cvs = (await client.get("/api/v1/cvs", headers=headers)).json()["data"]
        assert [c["id"] for c in cvs["items"]] == [cv["id"]]
        assert (await client.get(f"/api/v1/cvs/{cv['id']}", headers=headers)).status_code == 200
        assert (await client.get(f"/api/v1/cvs/{cv['id']}/file", headers=headers)).status_code == 200

        ranking = await client.get(f"/api/v1/matching/jobs/{job['id']}/results", headers=headers)
        assert ranking.status_code == 200 and ranking.json()["data"]["total"] == 1

        summary = (await client.get("/api/v1/dashboard/summary", headers=headers)).json()["data"]
        assert summary["total_jobs"] == 1 and summary["total_cvs"] == 1 and summary["scored_matches"] == 1


async def test_jd_edit_and_archive_limited_to_creator_or_admin(client, admin_headers):
    rec_a = await _account(client, admin_headers, "a@example.com", "recruiter")
    rec_b = await _account(client, admin_headers, "b@example.com", "recruiter")
    viewer = await _account(client, admin_headers, "v@example.com", "viewer")
    job = (await client.post("/api/v1/jobs", json=JOB, headers=rec_a)).json()["data"]
    url = f"/api/v1/jobs/{job['id']}"

    assert (await client.patch(url, json={"title": "Hijacked"}, headers=rec_b)).status_code == 403
    assert (await client.delete(url, headers=rec_b)).status_code == 403
    assert (await client.patch(url, json={"title": "X"}, headers=viewer)).status_code == 403

    assert (await client.patch(url, json={"status": "active"}, headers=rec_a)).status_code == 200
    edited = await client.patch(url, json={"title": "Edited by admin"}, headers=admin_headers)
    assert edited.status_code == 200 and edited.json()["data"]["title"] == "Edited by admin"
    archived = await client.delete(url, headers=admin_headers)
    assert archived.status_code == 200 and archived.json()["data"]["status"] == "archived"

    assert (await client.patch("/api/v1/jobs/9999", json={"title": "X"}, headers=admin_headers)).status_code == 404


async def test_cv_delete_limited_to_uploader_or_admin(client, admin_headers):
    rec_a = await _account(client, admin_headers, "a@example.com", "recruiter")
    rec_b = await _account(client, admin_headers, "b@example.com", "recruiter")
    viewer = await _account(client, admin_headers, "v@example.com", "viewer")
    cv = (await upload(client, rec_a, "Nguyen Van Strong", STRONG_CV)).json()["data"]
    await drain_pipeline()
    url = f"/api/v1/cvs/{cv['id']}"

    assert (await client.delete(url, headers=rec_b)).status_code == 403
    assert (await client.delete(url, headers=viewer)).status_code == 403
    assert (await upload(client, viewer, "Someone", ["Someone", "SKILLS", "Excel"])).status_code == 403
    assert (await client.delete(url, headers=rec_a)).status_code == 200
    assert (await client.delete(url, headers=admin_headers)).status_code == 404


async def test_viewer_cannot_run_matching_or_decide(client, admin_headers):
    viewer = await _account(client, admin_headers, "v@example.com", "viewer")
    job = (await client.post("/api/v1/jobs", json=JOB, headers=admin_headers)).json()["data"]
    await upload(client, admin_headers, "Nguyen Van Strong", STRONG_CV)
    await drain_pipeline()

    assert (await client.post("/api/v1/matching/run", json={"job_id": job["id"]}, headers=viewer)).status_code == 403
    await client.post("/api/v1/matching/run", json={"job_id": job["id"]}, headers=admin_headers)
    await drain_pipeline()
    result = (await client.get(f"/api/v1/matching/jobs/{job['id']}/results", headers=viewer)).json()["data"]["items"][0]

    decision = {"status": "shortlisted", "reason": "Strong fit"}
    url = f"/api/v1/matching/results/{result['id']}/decision"
    assert (await client.put(url, json=decision, headers=viewer)).status_code == 403
    assert (await client.put(url, json=decision, headers=admin_headers)).status_code == 200
