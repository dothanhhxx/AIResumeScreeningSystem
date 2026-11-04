"""Admin user management: list, edit, role change, lock, reset password, delete."""

from conftest import ADMIN, STRONG_CV, drain_pipeline, upload


async def _create(client, admin_headers, email: str, role: str = "recruiter") -> int:
    body = {"email": email, "password": "Password1", "full_name": email.split("@")[0], "role": role}
    response = await client.post("/api/v1/auth/register", json=body, headers=admin_headers)
    assert response.status_code == 201, response.text
    return response.json()["data"]["id"]


async def _login(client, email: str, password: str = "Password1"):
    return await client.post("/api/v1/auth/login", json={"email": email, "password": password})


def _auth(response) -> dict[str, str]:
    return {"Authorization": f"Bearer {response.json()['data']['access_token']}"}


async def _me(client, admin_headers) -> int:
    return (await client.get("/api/v1/auth/me", headers=admin_headers)).json()["data"]["id"]


async def test_only_admins_can_manage_users(client, admin_headers):
    user_id = await _create(client, admin_headers, "rec@example.com")
    await _create(client, admin_headers, "view@example.com", role="viewer")
    rec = _auth(await _login(client, "rec@example.com"))
    viewer = _auth(await _login(client, "view@example.com"))

    for headers in (rec, viewer):
        assert (await client.get("/api/v1/users", headers=headers)).status_code == 403
        patch = await client.patch(f"/api/v1/users/{user_id}", json={"role": "admin"}, headers=headers)
        assert patch.status_code == 403
        assert (await client.delete(f"/api/v1/users/{user_id}", headers=headers)).status_code == 403
    assert (await client.get("/api/v1/users")).status_code == 401


async def test_admin_lists_users_with_activity(client, admin_headers):
    await _create(client, admin_headers, "rec@example.com")
    await upload(client, admin_headers, "Nguyen Van Strong", STRONG_CV)
    await drain_pipeline()

    users = (await client.get("/api/v1/users", headers=admin_headers)).json()["data"]
    by_email = {u["email"]: u for u in users}
    assert by_email[ADMIN["email"]]["cvs_uploaded"] == 1
    assert by_email[ADMIN["email"]]["last_login_at"] is not None
    assert by_email["rec@example.com"]["last_login_at"] is None

    viewers = (await client.get("/api/v1/users?role=viewer", headers=admin_headers)).json()["data"]
    assert viewers == []
    found = (await client.get("/api/v1/users?search=rec@", headers=admin_headers)).json()["data"]
    assert [u["email"] for u in found] == ["rec@example.com"]


async def test_admin_changes_role_and_details(client, admin_headers):
    user_id = await _create(client, admin_headers, "view@example.com", role="viewer")

    promoted = await client.patch(
        f"/api/v1/users/{user_id}",
        json={"role": "recruiter", "full_name": "  Mai Tran ", "email": "Mai@Example.com"},
        headers=admin_headers,
    )
    assert promoted.status_code == 200, promoted.text
    data = promoted.json()["data"]
    assert data["role"] == "recruiter" and data["full_name"] == "Mai Tran" and data["email"] == "mai@example.com"

    # The new role takes effect on the next request; no re-login needed for the server checks.
    headers = _auth(await _login(client, "mai@example.com"))
    job = {"title": "T", "description": "D"}
    assert (await client.post("/api/v1/jobs", json=job, headers=headers)).status_code == 201

    taken = await client.patch(f"/api/v1/users/{user_id}", json={"email": ADMIN["email"]}, headers=admin_headers)
    assert taken.status_code == 409

    audit = (await client.get("/api/v1/audit?action=user_update", headers=admin_headers)).json()["data"]
    assert audit["total"] == 1


async def test_lock_signs_user_out_and_blocks_login(client, admin_headers):
    user_id = await _create(client, admin_headers, "rec@example.com")
    headers = _auth(await _login(client, "rec@example.com"))
    assert (await client.get("/api/v1/jobs", headers=headers)).status_code == 200

    locked = await client.patch(f"/api/v1/users/{user_id}", json={"is_active": False}, headers=admin_headers)
    assert locked.status_code == 200 and locked.json()["data"]["is_active"] is False
    assert (await client.get("/api/v1/jobs", headers=headers)).status_code == 401  # existing session ends
    assert (await _login(client, "rec@example.com")).status_code == 401

    await client.patch(f"/api/v1/users/{user_id}", json={"is_active": True}, headers=admin_headers)
    assert (await _login(client, "rec@example.com")).status_code == 200


async def test_admin_resets_password(client, admin_headers):
    user_id = await _create(client, admin_headers, "rec@example.com")
    short = await client.patch(f"/api/v1/users/{user_id}", json={"password": "short"}, headers=admin_headers)
    assert short.status_code == 422
    reset = await client.patch(f"/api/v1/users/{user_id}", json={"password": "Brandnew123"}, headers=admin_headers)
    assert reset.status_code == 200
    assert (await _login(client, "rec@example.com")).status_code == 401
    assert (await _login(client, "rec@example.com", "Brandnew123")).status_code == 200


async def test_admin_cannot_lock_themselves_out(client, admin_headers):
    me = await _me(client, admin_headers)
    for body in ({"role": "recruiter"}, {"is_active": False}):
        response = await client.patch(f"/api/v1/users/{me}", json=body, headers=admin_headers)
        assert response.status_code == 400, body
    assert (await client.delete(f"/api/v1/users/{me}", headers=admin_headers)).status_code == 400

    # Editing their own name is still fine.
    renamed = await client.patch(f"/api/v1/users/{me}", json={"full_name": "Head of HR"}, headers=admin_headers)
    assert renamed.status_code == 200


async def test_workspace_keeps_an_active_admin(client, admin_headers):
    second = await _create(client, admin_headers, "admin2@example.com", role="admin")
    second_headers = _auth(await _login(client, "admin2@example.com"))
    me = await _me(client, admin_headers)

    # Two admins: one may demote the other.
    demote = await client.patch(f"/api/v1/users/{me}", json={"role": "viewer"}, headers=second_headers)
    assert demote.status_code == 200
    # Now admin2 is the last admin and cannot be demoted or locked by anyone (only they could, and self is blocked).
    lock_self = await client.patch(f"/api/v1/users/{second}", json={"is_active": False}, headers=second_headers)
    assert lock_self.status_code == 400


async def test_delete_only_without_hiring_activity(client, admin_headers):
    idle = await _create(client, admin_headers, "idle@example.com")
    await _login(client, "idle@example.com")  # a sign-in alone does not block deletion
    busy = await _create(client, admin_headers, "busy@example.com")
    busy_headers = _auth(await _login(client, "busy@example.com"))
    await client.post("/api/v1/jobs", json={"title": "T", "description": "D"}, headers=busy_headers)

    blocked = await client.delete(f"/api/v1/users/{busy}", headers=admin_headers)
    assert blocked.status_code == 409

    deleted = await client.delete(f"/api/v1/users/{idle}", headers=admin_headers)
    assert deleted.status_code == 200
    emails = {u["email"] for u in (await client.get("/api/v1/users", headers=admin_headers)).json()["data"]}
    assert "idle@example.com" not in emails and "busy@example.com" in emails
    assert (await _login(client, "idle@example.com")).status_code == 401

    audit = (await client.get("/api/v1/audit?action=user_delete", headers=admin_headers)).json()["data"]
    assert audit["items"][0]["detail"]["email"] == "idle@example.com"
    assert (await client.delete(f"/api/v1/users/{idle}", headers=admin_headers)).status_code == 404
