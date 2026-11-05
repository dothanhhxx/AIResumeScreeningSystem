"""CV upload → parse → extract (→ optional auto-score) pipeline through the API. Owner: Person B"""

import json

from conftest import DOCX_MIME, STRONG_CV, drain_pipeline, make_docx, upload


async def test_upload_runs_parse_and_extract_pipeline(client, admin_headers):
    response = await upload(client, admin_headers, "Nguyen Van Strong", STRONG_CV)
    assert response.status_code == 201, response.text
    cv = response.json()["data"]
    assert cv["status"] == "uploaded" and cv["file_type"] == "docx"

    await drain_pipeline()

    detail = (await client.get(f"/api/v1/cvs/{cv['id']}", headers=admin_headers)).json()["data"]
    assert detail["status"] == "extracted", detail.get("error_message")
    assert "FastAPI" in detail["raw_text"]
    data = json.loads(detail["structured_data"])
    assert {"Python", "FastAPI", "PostgreSQL", "Docker"} <= set(data["skills"])
    assert data["years_of_experience"] >= 7
    assert data["education"][0]["degree"] == "Bachelor"
    assert data["extraction_source"] == "heuristic"

    listing = (await client.get("/api/v1/cvs?status=extracted", headers=admin_headers)).json()["data"]
    assert listing["total"] == 1 and listing["items"][0]["id"] == cv["id"]


async def test_upload_without_candidate_name_auto_scans_identity_and_profile(client, admin_headers):
    files = {"file": ("resume_2026_backend.docx", make_docx(STRONG_CV), DOCX_MIME)}
    response = await client.post("/api/v1/cvs/upload", files=files, headers=admin_headers)
    assert response.status_code == 201, response.text

    await drain_pipeline()

    cv_id = response.json()["data"]["id"]
    detail = (await client.get(f"/api/v1/cvs/{cv_id}", headers=admin_headers)).json()["data"]
    assert detail["status"] == "extracted", detail.get("error_message")
    assert detail["candidate_name"] == "Nguyen Van Strong"
    assert detail["candidate_email"] == "strong@example.com"
    data = json.loads(detail["structured_data"])
    assert {"Python", "FastAPI", "PostgreSQL", "Docker"} <= set(data["skills"])


async def test_upload_with_job_id_auto_scores_and_ranks_against_job(client, admin_headers):
    job = (
        await client.post(
            "/api/v1/jobs",
            json={
                "title": "Senior Python Backend Engineer",
                "description": "Build and scale FastAPI services.",
                "required_skills": ["Python", "FastAPI", "PostgreSQL", "Docker"],
                "experience_years": 4,
            },
            headers=admin_headers,
        )
    ).json()["data"]

    files = {"file": ("CV_Strong_Backend.docx", make_docx(STRONG_CV), DOCX_MIME)}
    response = await client.post(
        "/api/v1/cvs/upload",
        data={"job_id": str(job["id"])},
        files=files,
        headers=admin_headers,
    )
    assert response.status_code == 201, response.text

    await drain_pipeline()

    cv_id = response.json()["data"]["id"]
    detail = (await client.get(f"/api/v1/cvs/{cv_id}", headers=admin_headers)).json()["data"]
    assert detail["status"] == "scored", detail.get("error_message")
    assert detail["candidate_name"] == "Nguyen Van Strong"

    ranking = (
        await client.get(f"/api/v1/matching/jobs/{job['id']}/results", headers=admin_headers)
    ).json()["data"]
    assert ranking["total"] == 1
    assert ranking["items"][0]["cv_id"] == cv_id
    assert ranking["items"][0]["rank"] == 1
    assert ranking["items"][0]["overall_score"] > 60


async def test_duplicate_and_unsupported_uploads_are_rejected(client, admin_headers):
    assert (await upload(client, admin_headers, "A", STRONG_CV)).status_code == 201
    duplicate = await upload(client, admin_headers, "B", STRONG_CV)
    assert duplicate.status_code == 409

    bad = await client.post(
        "/api/v1/cvs/upload",
        data={"candidate_name": "C"},
        files={"file": ("notes.txt", b"hello", "text/plain")},
        headers=admin_headers,
    )
    assert bad.status_code == 422


async def test_download_reprocess_and_delete(client, admin_headers):
    cv = (await upload(client, admin_headers, "Nguyen Van Strong", STRONG_CV)).json()["data"]
    await drain_pipeline()

    file_response = await client.get(f"/api/v1/cvs/{cv['id']}/file", headers=admin_headers)
    assert file_response.status_code == 200
    assert file_response.content[:2] == b"PK"  # DOCX is a zip archive

    again = await client.post(f"/api/v1/cvs/{cv['id']}/reprocess", headers=admin_headers)
    assert again.status_code == 202
    await drain_pipeline()
    detail = (await client.get(f"/api/v1/cvs/{cv['id']}", headers=admin_headers)).json()["data"]
    assert detail["status"] == "extracted"

    deleted = await client.delete(f"/api/v1/cvs/{cv['id']}", headers=admin_headers)
    assert deleted.status_code == 200
    assert (await client.get(f"/api/v1/cvs/{cv['id']}", headers=admin_headers)).status_code == 404


async def test_download_returns_original_bytes_and_unicode_file_name(client, admin_headers):
    original = make_docx(STRONG_CV)
    files = {"file": ("CV_Nguyễn_Văn_A (2026).docx", original, DOCX_MIME)}
    cv = (await client.post("/api/v1/cvs/upload", files=files, headers=admin_headers)).json()["data"]
    await drain_pipeline()

    response = await client.get(f"/api/v1/cvs/{cv['id']}/file", headers=admin_headers)
    assert response.status_code == 200
    assert response.content == original
    assert response.headers["content-type"].startswith(DOCX_MIME)
    disposition = response.headers["content-disposition"]
    assert "filename*=UTF-8''CV_Nguy%E1%BB%85n_V%C4%83n_A%20%282026%29.docx" in disposition
    assert disposition.encode("latin-1").isascii()


async def test_corrupt_file_ends_in_error_status(client, admin_headers):
    response = await client.post(
        "/api/v1/cvs/upload",
        data={"candidate_name": "Broken"},
        files={"file": ("broken.pdf", b"%PDF-1.4 not really a pdf", "application/pdf")},
        headers=admin_headers,
    )
    cv_id = response.json()["data"]["id"]
    await drain_pipeline()
    detail = (await client.get(f"/api/v1/cvs/{cv_id}", headers=admin_headers)).json()["data"]
    assert detail["status"] == "error"
    assert detail["error_message"]


async def test_download_survives_wiped_storage_and_reupload_restores_lost_file(client, admin_headers):
    """Container disks are wiped on redeploy: the database copy must still serve the file."""
    from sqlalchemy import delete

    from app.core.database import async_session_factory
    from app.models.cv_file import CVFile
    from app.services.storage_service import storage_service

    original = make_docx(STRONG_CV)
    files = {"file": ("CV Data Analyst - Đỗ Thanh Hải.docx", original, DOCX_MIME)}
    cv = (await client.post("/api/v1/cvs/upload", files=files, headers=admin_headers)).json()["data"]
    await drain_pipeline()

    # 1. Storage wiped (redeploy): still downloadable, and reprocessing still works.
    storage_service.delete_file(cv["file_url"])
    response = await client.get(f"/api/v1/cvs/{cv['id']}/file", headers=admin_headers)
    assert response.status_code == 200 and response.content == original
    assert (await client.post(f"/api/v1/cvs/{cv['id']}/reprocess", headers=admin_headers)).status_code == 202
    await drain_pipeline()
    detail = (await client.get(f"/api/v1/cvs/{cv['id']}", headers=admin_headers)).json()["data"]
    assert detail["status"] == "extracted", detail.get("error_message")

    # 2. A CV uploaded before the database copy existed, whose disk file is gone:
    #    a clear 404, then re-uploading the same file restores it.
    async with async_session_factory() as db:
        await db.execute(delete(CVFile).where(CVFile.cv_id == cv["id"]))
        await db.commit()
    missing = await client.get(f"/api/v1/cvs/{cv['id']}/file", headers=admin_headers)
    assert missing.status_code == 404
    assert "Upload the same file again" in missing.text

    again = await client.post("/api/v1/cvs/upload", files=files, headers=admin_headers)
    assert again.json()["data"]["id"] == cv["id"]
    await drain_pipeline()
    restored = await client.get(f"/api/v1/cvs/{cv['id']}/file", headers=admin_headers)
    assert restored.status_code == 200 and restored.content == original


async def test_download_backfills_database_copy_from_storage(client, admin_headers):
    from sqlalchemy import delete, select

    from app.core.database import async_session_factory
    from app.models.cv_file import CVFile

    cv = (await upload(client, admin_headers, "Legacy Upload", STRONG_CV)).json()["data"]
    await drain_pipeline()
    async with async_session_factory() as db:
        await db.execute(delete(CVFile).where(CVFile.cv_id == cv["id"]))
        await db.commit()

    response = await client.get(f"/api/v1/cvs/{cv['id']}/file", headers=admin_headers)
    assert response.status_code == 200
    async with async_session_factory() as db:
        stored = await db.scalar(select(CVFile.content).where(CVFile.cv_id == cv["id"]))
    assert stored == response.content
