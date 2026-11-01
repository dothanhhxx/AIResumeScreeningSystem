"""End-to-end: JD → CVs → matching → ranking → recruiter decision → dashboard. Owner: Person D"""

from conftest import STRONG_CV, WEAK_CV, drain_pipeline, upload

JOB = {
    "title": "Senior Python Backend Engineer",
    "department": "Engineering",
    "location": "Hanoi",
    "description": "Build and operate Python APIs for our hiring platform.",
    "requirements": "Strong API design, async Python, relational databases.",
    "required_skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "Kubernetes"],
    "experience_years": 4,
    "education_level": "Bachelor",
}


async def _setup(client, headers) -> int:
    job = (await client.post("/api/v1/jobs", json=JOB, headers=headers)).json()["data"]
    await client.patch(f"/api/v1/jobs/{job['id']}", json={"status": "active"}, headers=headers)
    await upload(client, headers, "Nguyen Van Strong", STRONG_CV)
    await upload(client, headers, "Tran Thi Weak", WEAK_CV)
    await drain_pipeline()
    return job["id"]


async def _ranking(client, headers, job_id: int, query: str = "") -> dict:
    response = await client.get(f"/api/v1/matching/jobs/{job_id}/results{query}", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()["data"]


async def test_matching_ranks_candidates_with_evidence(client, admin_headers):
    job_id = await _setup(client, admin_headers)

    run = await client.post("/api/v1/matching/run", json={"job_id": job_id}, headers=admin_headers)
    assert run.status_code == 202
    assert run.json()["data"]["queued"] == 2
    await drain_pipeline()

    ranking = await _ranking(client, admin_headers, job_id)
    assert ranking["total"] == 2 and ranking["pending_cvs"] == 0
    first, second = ranking["items"]
    assert first["candidate"]["candidate_name"] == "Nguyen Van Strong"
    assert first["rank"] == 1 and second["rank"] == 2
    assert first["overall_score"] > second["overall_score"] + 20
    assert "Kubernetes" in first["missing_skills"]
    assert {"Python", "FastAPI"} <= set(first["matched_skills"])
    assert first["model_name"] == "heuristic"
    assert first["semantic_score"] is not None and first["llm_score"] is None

    evidence = {e["requirement"]: e for e in first["details"]["evidence"]}
    assert evidence["Python"]["status"] == "found" and "Python" in evidence["Python"]["quote"]
    assert evidence["Kubernetes"]["status"] == "not_found"
    assert first["details"]["interview_questions"]

    # PII never reaches the stored evidence
    assert "0912345678" not in str(first["details"])
    assert "strong@example.com" not in str(first["details"])

    detail = await client.get(f"/api/v1/matching/results/{first['id']}", headers=admin_headers)
    assert detail.status_code == 200

    # Re-running updates the same rows instead of duplicating them
    await client.post("/api/v1/matching/run", json={"job_id": job_id}, headers=admin_headers)
    await drain_pipeline()
    assert (await _ranking(client, admin_headers, job_id))["total"] == 2


async def test_decision_override_reorders_ranking_and_feeds_dashboard(client, admin_headers):
    job_id = await _setup(client, admin_headers)
    await client.post("/api/v1/matching/run", json={"job_id": job_id}, headers=admin_headers)
    await drain_pipeline()
    weak = (await _ranking(client, admin_headers, job_id))["items"][1]

    saved = await client.put(
        f"/api/v1/matching/results/{weak['id']}/decision",
        json={"status": "shortlisted", "reason": "Portfolio shows backend work", "score_override": 99},
        headers=admin_headers,
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["data"]["score_override"] == 99

    ranking = await _ranking(client, admin_headers, job_id)
    assert ranking["items"][0]["id"] == weak["id"]
    assert ranking["items"][0]["effective_score"] == 99
    assert ranking["items"][0]["decision"]["status"] == "shortlisted"

    shortlisted = await _ranking(client, admin_headers, job_id, "?decision_status=shortlisted")
    assert [i["id"] for i in shortlisted["items"]] == [weak["id"]]

    summary = (await client.get("/api/v1/dashboard/summary", headers=admin_headers)).json()["data"]
    assert summary["active_jobs"] == 1 and summary["total_cvs"] == 2
    assert summary["shortlisted"] == 1 and summary["needs_review"] == 1
    assert summary["recent_jobs"][0]["candidates"] == 2
    assert summary["review_queue"][0]["candidate_name"] == "Nguyen Van Strong"

    audit = (await client.get("/api/v1/audit?resource_type=match_result", headers=admin_headers)).json()["data"]
    assert "decision_create" in {i["action"] for i in audit["items"]}


async def test_matching_requires_job_ownership(client, admin_headers):
    recruiter = {"email": "rec@example.com", "password": "Password1", "full_name": "Rec", "role": "recruiter"}
    await client.post("/api/v1/auth/register", json=recruiter, headers=admin_headers)
    login = await client.post("/api/v1/auth/login", json={"email": recruiter["email"], "password": "Password1"})
    rec_headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}
    job = (await client.post("/api/v1/jobs", json=JOB, headers=admin_headers)).json()["data"]

    run = await client.post("/api/v1/matching/run", json={"job_id": job["id"]}, headers=rec_headers)
    assert run.status_code == 404
    ranking = await client.get(f"/api/v1/matching/jobs/{job['id']}/results", headers=rec_headers)
    assert ranking.status_code == 404
