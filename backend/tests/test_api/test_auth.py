"""Auth API + audit log tests. Owner: Person A"""

from conftest import ADMIN


async def _login(client, email: str, password: str) -> dict[str, str]:
    response = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return {"Authorization": f"Bearer {response.json()['data']['access_token']}"}


async def test_first_account_becomes_admin_and_can_login(client):
    response = await client.post("/api/v1/auth/register", json={**ADMIN, "role": "viewer"})
    assert response.status_code == 201
    assert response.json()["data"]["role"] == "admin"

    login = await client.post(
        "/api/v1/auth/login", json={"email": "ADMIN@example.com ", "password": ADMIN["password"]}
    )
    assert login.status_code == 200
    token = login.json()["data"]
    assert token["token_type"] == "bearer" and token["expires_in"] > 0

    me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token['access_token']}"})
    assert me.json()["data"]["email"] == ADMIN["email"]


async def test_wrong_password_and_missing_token_are_rejected(client, admin_headers):
    bad = await client.post("/api/v1/auth/login", json={"email": ADMIN["email"], "password": "wrong-password"})
    assert bad.status_code == 401
    assert bad.json()["success"] is False

    assert (await client.get("/api/v1/auth/me")).status_code == 401
    garbage = await client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-token"})
    assert garbage.status_code == 401


async def test_only_admin_can_create_accounts(client, admin_headers):
    new_user = {"email": "x@example.com", "password": "Password1", "full_name": "X"}
    assert (await client.post("/api/v1/auth/register", json=new_user)).status_code == 403

    recruiter = {"email": "rec@example.com", "password": "Password1", "full_name": "Rec", "role": "recruiter"}
    created = await client.post("/api/v1/auth/register", json=recruiter, headers=admin_headers)
    assert created.status_code == 201 and created.json()["data"]["role"] == "recruiter"

    duplicate = await client.post("/api/v1/auth/register", json=recruiter, headers=admin_headers)
    assert duplicate.status_code == 409

    rec_headers = await _login(client, "rec@example.com", "Password1")
    forbidden = await client.post("/api/v1/auth/register", json=new_user, headers=rec_headers)
    assert forbidden.status_code == 403
    assert (await client.get("/api/v1/audit", headers=rec_headers)).status_code == 403


async def test_viewer_cannot_write(client, admin_headers):
    viewer = {"email": "view@example.com", "password": "Password1", "full_name": "View", "role": "viewer"}
    await client.post("/api/v1/auth/register", json=viewer, headers=admin_headers)
    headers = await _login(client, viewer["email"], viewer["password"])
    job = {"title": "T", "description": "D"}
    assert (await client.post("/api/v1/jobs", json=job, headers=headers)).status_code == 403


async def test_audit_log_records_auth_events(client, admin_headers):
    response = await client.get("/api/v1/audit", headers=admin_headers)
    assert response.status_code == 200
    actions = [item["action"] for item in response.json()["data"]["items"]]
    assert "register" in actions and "login" in actions

    filtered = await client.get("/api/v1/audit?action=login", headers=admin_headers)
    assert {item["action"] for item in filtered.json()["data"]["items"]} == {"login"}
