"""Admin user management and changing your own password."""

from datetime import UTC, datetime, timedelta

import jwt

from backend.config import ACCESS_TOKEN_EXPIRE_MINUTES, SECRET_KEY
from backend.models import GameSession, User
from backend.routes import auth as auth_routes
from backend.tests.conftest import bearer, register

PASSWORD = "correct-horse-battery"


def _login(client, username, password=PASSWORD):
    return client.post("/auth/login", json={"username": username, "password": password})


def _user_id(client, admin_headers, username):
    return next(u["id"] for u in client.get("/users", headers=admin_headers).json() if u["username"] == username)


# ---------------------------------------------------------------- access


def test_only_admins_can_manage_users(client, admin_headers, user_headers):
    assert client.get("/users").status_code == 401
    assert client.get("/users", headers=user_headers).status_code == 403
    users = client.get("/users", headers=admin_headers).json()
    assert [(u["username"], u["is_admin"], u["is_active"]) for u in users] == [
        ("admin", True, True),
        ("scorer", False, True),
    ]
    # Timestamps carry their time zone, so browsers show the right local time.
    assert users[0]["created_at"].endswith(("Z", "+00:00"))
    assert users[0]["last_login_at"].endswith(("Z", "+00:00"))
    assert "hashed_password" not in users[0]


def test_admins_cannot_change_reset_or_delete_themselves(client, admin_headers):
    me = _user_id(client, admin_headers, "admin")
    assert client.patch(f"/users/{me}", json={"is_admin": False}, headers=admin_headers).status_code == 400
    assert client.patch(f"/users/{me}", json={"is_active": False}, headers=admin_headers).status_code == 400
    assert client.post(f"/users/{me}/reset-password", headers=admin_headers).status_code == 400
    assert client.delete(f"/users/{me}", headers=admin_headers).status_code == 400


def test_missing_user_is_404(client, admin_headers):
    assert client.patch("/users/999", json={"is_admin": True}, headers=admin_headers).status_code == 404
    assert client.delete("/users/999", headers=admin_headers).status_code == 404


# ---------------------------------------------------------------- adding users


def test_admin_can_add_a_user_with_a_generated_password_even_when_signup_is_closed(client, admin_headers, monkeypatch):
    monkeypatch.setattr(auth_routes, "ALLOW_REGISTRATION", False)
    r = client.post("/users", json={"username": "newbie", "email": "NewBie@Example.com"}, headers=admin_headers)
    assert r.status_code == 201
    body = r.json()
    assert body["user"]["email"] == "newbie@example.com"
    assert body["user"]["is_admin"] is False
    temp = body["temporary_password"]
    assert len(temp) >= 16
    assert _login(client, "newbie", temp).status_code == 200


def test_admin_can_choose_the_password_and_role(client, admin_headers):
    r = client.post(
        "/users",
        json={"username": "coach", "email": "coach@example.com", "password": "chosen-password", "is_admin": True},
        headers=admin_headers,
    )
    assert r.status_code == 201
    assert r.json()["temporary_password"] is None
    assert r.json()["user"]["is_admin"] is True
    assert _login(client, "coach", "chosen-password").status_code == 200


def test_adding_a_duplicate_or_invalid_user_is_rejected(client, admin_headers):
    taken = {"username": "ADMIN", "email": "x@example.com"}
    assert client.post("/users", json=taken, headers=admin_headers).status_code == 409
    for bad in [
        {"username": "a b", "email": "x@example.com"},
        {"username": "valid", "email": "nope"},
        {"username": "valid", "email": "x@example.com", "password": "short"},
    ]:
        assert client.post("/users", json=bad, headers=admin_headers).status_code == 422, bad


# ---------------------------------------------------------------- roles and status


def test_promoting_and_demoting_applies_immediately(client, admin_headers, user_headers):
    scorer = _user_id(client, admin_headers, "scorer")
    r = client.patch(f"/users/{scorer}", json={"is_admin": True}, headers=admin_headers)
    assert r.json()["is_admin"] is True
    assert client.get("/users", headers=user_headers).status_code == 200  # same token, new rights

    client.patch(f"/users/{scorer}", json={"is_admin": False}, headers=admin_headers)
    assert client.get("/users", headers=user_headers).status_code == 403


def test_disabling_signs_the_user_out_and_blocks_sign_in(client, admin_headers, user_headers):
    scorer = _user_id(client, admin_headers, "scorer")
    r = client.patch(f"/users/{scorer}", json={"is_active": False}, headers=admin_headers)
    assert r.json()["is_active"] is False
    assert client.get("/auth/me", headers=user_headers).status_code == 401
    r = _login(client, "scorer")
    assert r.status_code == 403
    assert "disabled" in r.json()["detail"]

    client.patch(f"/users/{scorer}", json={"is_active": True}, headers=admin_headers)
    assert _login(client, "scorer").status_code == 200
    # The old token stays invalid after re-enabling.
    assert client.get("/auth/me", headers=user_headers).status_code == 401


# ---------------------------------------------------------------- passwords


def test_reset_password_signs_out_and_replaces_the_old_password(client, admin_headers, user_headers):
    scorer = _user_id(client, admin_headers, "scorer")
    r = client.post(f"/users/{scorer}/reset-password", headers=admin_headers)
    assert r.status_code == 200
    temp = r.json()["temporary_password"]
    assert client.get("/auth/me", headers=user_headers).status_code == 401
    assert _login(client, "scorer").status_code == 401
    assert _login(client, "scorer", temp).status_code == 200


def test_change_password_keeps_this_session_and_ends_the_others(client):
    first = register(client, "alex")["access_token"]
    second = _login(client, "alex").json()["access_token"]

    r = client.post(
        "/auth/change-password",
        json={"current_password": PASSWORD, "new_password": "brand-new-password"},
        headers=bearer(first),
    )
    assert r.status_code == 200
    fresh = r.json()["access_token"]

    assert client.get("/auth/me", headers=bearer(fresh)).status_code == 200
    assert client.get("/auth/me", headers=bearer(first)).status_code == 401
    assert client.get("/auth/me", headers=bearer(second)).status_code == 401
    assert _login(client, "alex").status_code == 401
    assert _login(client, "alex", "brand-new-password").status_code == 200


def test_change_password_validation(client):
    token = bearer(register(client, "alex")["access_token"])
    cases = [
        ({"current_password": PASSWORD, "new_password": PASSWORD}, 422),  # same as before
        ({"current_password": PASSWORD, "new_password": "short"}, 422),
        ({"current_password": "wrong-password", "new_password": "brand-new-password"}, 400),
    ]
    for body, expected in cases:
        assert client.post("/auth/change-password", json=body, headers=token).status_code == expected, body
    # A wrong current password must not end the session (the frontend signs out on 401).
    assert client.get("/auth/me", headers=token).status_code == 200


def test_tokens_from_before_token_versions_still_work(client, db):
    """Tokens issued by v3.0 have no "ver" claim; they stay valid until they expire."""
    register(client, "alex")
    user = db.query(User).one()
    now = datetime.now(UTC)
    payload = {"sub": str(user.id), "iat": now, "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)}
    old_style = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    assert client.get("/auth/me", headers=bearer(old_style)).status_code == 200


# ---------------------------------------------------------------- deleting


def test_deleting_a_user_ends_their_session_and_keeps_their_games(client, db, admin_headers, user_headers):
    started = client.post(
        "/game-mode/start",
        json={"home_team": "Eagles", "away_team": "Tigers", "game_date": "2025-06-01"},
        headers=user_headers,
    ).json()
    scorer = _user_id(client, admin_headers, "scorer")

    assert client.delete(f"/users/{scorer}", headers=admin_headers).status_code == 204
    assert client.get("/auth/me", headers=user_headers).status_code == 401
    assert _login(client, "scorer").status_code == 401
    db.expire_all()
    game = db.get(GameSession, started["id"])
    assert game is not None and game.created_by is None
