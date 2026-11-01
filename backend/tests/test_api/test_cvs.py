"""CV upload → parse → extract pipeline through the API. Owner: Person B"""

import json

from conftest import STRONG_CV, drain_pipeline, upload


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
