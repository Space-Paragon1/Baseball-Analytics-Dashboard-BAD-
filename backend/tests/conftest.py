"""Test setup: every test gets a fresh in-memory database, so the suite never
touches a real baseball.db."""

import os

# Must be set before any backend module is imported.
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SEED_SAMPLE_DATA"] = "false"
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-the-test-suite-only")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from backend.database import Base, SessionLocal, engine  # noqa: E402
from backend.main import app  # noqa: E402
from backend.services.records import seed_sample_data  # noqa: E402


@pytest.fixture()
def db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        yield session


@pytest.fixture()
def seeded(db):
    seed_sample_data(db)
    return db


@pytest.fixture()
def client(db):
    with TestClient(app) as c:
        yield c


def register(client: TestClient, username: str, password: str = "correct-horse-battery") -> dict:
    r = client.post(
        "/auth/register", json={"username": username, "email": f"{username}@example.com", "password": password}
    )
    assert r.status_code == 201, r.text
    return r.json()


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def admin_headers(client):
    """The first account registered becomes the admin."""
    return bearer(register(client, "admin")["access_token"])


@pytest.fixture()
def user_headers(client, admin_headers):
    """A regular (non-admin) signed-in user."""
    return bearer(register(client, "scorer")["access_token"])
