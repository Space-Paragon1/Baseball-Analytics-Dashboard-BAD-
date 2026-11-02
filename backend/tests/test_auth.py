from datetime import timedelta

from backend.routes import auth as auth_routes
from backend.services.auth_service import create_access_token
from backend.tests.conftest import bearer, register


def test_first_user_is_admin_and_later_users_are_not(client):
    first = register(client, "owner")
    second = register(client, "friend")
    assert first["user"]["is_admin"] is True
    assert second["user"]["is_admin"] is False


def test_register_rejects_duplicates_case_insensitively(client):
    register(client, "Alex")
    r = client.post(
        "/auth/register", json={"username": "alex", "email": "other@example.com", "password": "long-enough-pw"}
    )
    assert r.status_code == 409
    r = client.post(
        "/auth/register", json={"username": "someone", "email": "ALEX@example.com", "password": "long-enough-pw"}
    )
    assert r.status_code == 409


def test_register_validates_input(client):
    cases = [
        {"username": "ab", "email": "a@example.com", "password": "long-enough-pw"},  # too short
        {"username": "has space", "email": "a@example.com", "password": "long-enough-pw"},
        {"username": "valid", "email": "not-an-email", "password": "long-enough-pw"},
        {"username": "valid", "email": "a@example.com", "password": "short"},
        {"username": "valid", "email": "a@example.com", "password": "x" * 73},
    ]
    for body in cases:
        assert client.post("/auth/register", json=body).status_code == 422, body


def test_login_and_me(client):
    register(client, "player1", password="hunter2-hunter2")
    r = client.post("/auth/login", json={"username": "PLAYER1", "password": "hunter2-hunter2"})
    assert r.status_code == 200
    me = client.get("/auth/me", headers=bearer(r.json()["access_token"]))
    assert me.status_code == 200
    assert me.json()["username"] == "player1"
    assert "hashed_password" not in me.json()


def test_login_wrong_password_or_user(client):
    register(client, "player1", password="hunter2-hunter2")
    assert client.post("/auth/login", json={"username": "player1", "password": "nope-nope"}).status_code == 401
    assert client.post("/auth/login", json={"username": "ghost", "password": "nope-nope"}).status_code == 401


def test_bad_and_expired_tokens_are_rejected(client, db):
    assert client.get("/auth/me").status_code == 401
    assert client.get("/auth/me", headers=bearer("not-a-jwt")).status_code == 401
    register(client, "player1")
    from backend.models import User

    user = db.query(User).first()
    expired = create_access_token(user, expires_delta=timedelta(minutes=-1))
    assert client.get("/auth/me", headers=bearer(expired)).status_code == 401


def test_registration_can_be_closed_after_first_user(client, monkeypatch):
    monkeypatch.setattr(auth_routes, "ALLOW_REGISTRATION", False)
    assert client.get("/auth/config").json() == {"registration_open": True, "has_users": False}
    register(client, "owner")  # the admin can always be created
    r = client.post(
        "/auth/register", json={"username": "late", "email": "late@example.com", "password": "long-enough-pw"}
    )
    assert r.status_code == 403
    assert client.get("/auth/config").json()["registration_open"] is False
