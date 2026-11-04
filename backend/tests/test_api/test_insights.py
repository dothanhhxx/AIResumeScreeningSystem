"""Analytics, screening history, system info and password change."""

from conftest import ADMIN, STRONG_CV, WEAK_CV, drain_pipeline, upload

JOB = {
    "title": "Senior Python Backend Engineer",
    "description": "Build and operate Python APIs.",
    "required_skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "Kubernetes"],
    "experience_years": 4,
}


async def _scored_job(client, headers) -> tuple[int, list[dict]]:
    job = (await client.post("/api/v1/jobs", json=JOB, headers=headers)).json()["data"]
    await upload(client, headers, "Nguyen Van Strong", STRONG_CV)
    await upload(client, headers, "Tran Thi Weak", WEAK_CV)
    await drain_pipeline()
    await client.post("/api/v1/matching/run", json={"job_id": job["id"]}, headers=headers)
    await drain_pipeline()
    ranking = await client.get(f"/api/v1/matching/jobs/{job['id']}/results", headers=headers)
    return job["id"], ranking.json()["data"]["items"]


async def test_analytics_aggregates_scores_decisions_and_gaps(client, admin_headers):
    job_id, (strong, weak) = await _scored_job(client, admin_headers)
    await client.put(
        f"/api/v1/matching/results/{weak['id']}/decision",
        json={"status": "rejected", "reason": "Different field"},
        headers=admin_headers,
    )

    response = await client.get("/api/v1/dashboard/analytics", headers=admin_headers)
    assert response.status_code == 200, response.text
    data = response.json()["data"]

    assert data["scored_matches"] == 2 and data["decided_matches"] == 1
    assert data["decision_funnel"]["rejected"] == 1 and data["decision_funnel"]["pending"] == 1
    assert sum(data["score_bands"].values()) == 2
    assert sum(b["count"] for b in data["score_distribution"]) == 2
    assert len(data["score_distribution"]) == 10
    assert data["total_cvs"] == 2 and data["cv_status_counts"]["scored"] == 2

    job = next(j for j in data["jobs"] if j["id"] == job_id)
    assert job["candidates"] == 2 and job["top_score"] == round(strong["overall_score"], 1)
    assert "Kubernetes" in {g["skill"] for g in data["top_missing_skills"]}

    assert len(data["activity"]) == 14
    today = data["activity"][-1]
    assert today["cvs_uploaded"] == 2 and today["matches_scored"] == 2 and today["decisions_made"] == 1

    assert (await client.get("/api/v1/dashboard/analytics?days=3", headers=admin_headers)).status_code == 422


async def test_history_lists_outcomes_with_filters(client, admin_headers):
    _, (strong, weak) = await _scored_job(client, admin_headers)
    await client.put(
        f"/api/v1/matching/results/{strong['id']}/decision",
        json={"status": "shortlisted", "reason": "Strong API work", "score_override": 90},
        headers=admin_headers,
    )

    history = (await client.get("/api/v1/matching/history", headers=admin_headers)).json()["data"]
    assert history["total"] == 2
    # SQLite timestamps have one-second resolution, so don't assert on row order here.
    first = next(i for i in history["items"] if i["result_id"] == strong["id"])
    assert first["decision_status"] == "shortlisted" and first["effective_score"] == 90
    assert first["decided_by_name"] == ADMIN["full_name"] and first["decision_reason"] == "Strong API work"

    pending = (await client.get("/api/v1/matching/history?decision_status=pending", headers=admin_headers)).json()
    assert [i["result_id"] for i in pending["data"]["items"]] == [weak["id"]]

    found = (await client.get("/api/v1/matching/history?search=weak", headers=admin_headers)).json()["data"]
    assert [i["candidate_name"] for i in found["items"]] == ["Tran Thi Weak"]


async def test_system_info_reports_engine_without_secrets(client, admin_headers):
    response = await client.get("/api/v1/system/info", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["llm_provider"] == "heuristic" and data["llm_active"] is False
    assert set(data["score_weights"]) == {"rule", "semantic", "llm"}
    assert "key" not in str(data).lower()
    assert (await client.get("/api/v1/system/info")).status_code == 401


async def test_change_password(client, admin_headers):
    url = "/api/v1/auth/password"
    wrong_body = {"current_password": "nope", "new_password": "Brandnew123"}
    wrong = await client.put(url, json=wrong_body, headers=admin_headers)
    assert wrong.status_code == 400  # not 401: the session is still valid
    same = {"current_password": ADMIN["password"], "new_password": ADMIN["password"]}
    assert (await client.put(url, json=same, headers=admin_headers)).status_code == 400
    short = {"current_password": ADMIN["password"], "new_password": "short"}
    assert (await client.put(url, json=short, headers=admin_headers)).status_code == 422

    ok = await client.put(url, json={"current_password": ADMIN["password"], "new_password": "Brandnew123"},
                          headers=admin_headers)
    assert ok.status_code == 200

    old = await client.post("/api/v1/auth/login", json={"email": ADMIN["email"], "password": ADMIN["password"]})
    assert old.status_code == 401
    new = await client.post("/api/v1/auth/login", json={"email": ADMIN["email"], "password": "Brandnew123"})
    assert new.status_code == 200
    audit = (await client.get("/api/v1/audit?action=password_change", headers=admin_headers)).json()["data"]
    assert audit["total"] == 1
