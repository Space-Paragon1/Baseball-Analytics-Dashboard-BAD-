"""App settings, read once from environment variables (and backend/.env if present)."""

import logging
import os
import secrets
from datetime import date
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).parent / ".env")
except ImportError:  # python-dotenv is optional
    pass

logger = logging.getLogger("bad")

ROOT_DIR = Path(__file__).resolve().parent.parent
SAMPLE_DATA_PATH = ROOT_DIR / "data" / "sample_data.csv"


def _env(name: str, default: str = "") -> str:
    """Read an env var, treating an empty value the same as an unset one."""
    value = os.getenv(name, "").strip()
    return value or default


def _env_bool(name: str, default: bool) -> bool:
    value = _env(name)
    if not value:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


def _env_date(name: str) -> date | None:
    value = _env(name)
    return date.fromisoformat(value) if value else None


def normalize_database_url(url: str) -> str:
    """Point plain PostgreSQL URLs (including the postgres:// form some hosts hand
    out) at the psycopg 3 driver, which is the one in requirements.txt."""
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url.removeprefix(prefix)
    return url


DATABASE_URL = normalize_database_url(_env("DATABASE_URL", f"sqlite:///{ROOT_DIR / 'baseball.db'}"))

SECRET_KEY = _env("SECRET_KEY")
if not SECRET_KEY:
    # Safe default for local development: a random key per process.
    # Logins stop working after a restart, so production must set SECRET_KEY.
    SECRET_KEY = secrets.token_urlsafe(48)
    logger.warning("SECRET_KEY is not set; using a temporary random key. Set SECRET_KEY in production.")

ACCESS_TOKEN_EXPIRE_MINUTES = int(_env("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 12)))

# Comma-separated list of frontend origins allowed to call the API.
CORS_ORIGINS = [
    o.strip() for o in _env("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if o.strip()
]

# After the first (admin) account exists, new sign-ups are only allowed when this is true.
ALLOW_REGISTRATION = _env_bool("ALLOW_REGISTRATION", True)

# Load data/sample_data.csv on startup when the database is empty.
SEED_SAMPLE_DATA = _env_bool("SEED_SAMPLE_DATA", True)

# For demos: on startup, fill an empty database with real MLB games from this date
# range (YYYY-MM-DD, up to 250 games) instead of the sample CSV, which is still used if
# the import fails. SEED_MLB_TEAM_ID limits it to one team (ids: GET /import/mlb/teams).
SEED_MLB_START = _env_date("SEED_MLB_START")
SEED_MLB_END = _env_date("SEED_MLB_END") or SEED_MLB_START
SEED_MLB_TEAM_ID = int(_env("SEED_MLB_TEAM_ID", "0")) or None

# Largest CSV upload accepted, in megabytes.
MAX_UPLOAD_MB = int(_env("MAX_UPLOAD_MB", "10"))

# Failed sign-ins allowed per account (from one IP address) before a lockout.
# One IP address gets 4x this many across all accounts.
LOGIN_MAX_ATTEMPTS = int(_env("LOGIN_MAX_ATTEMPTS", "5"))
LOGIN_LOCKOUT_MINUTES = int(_env("LOGIN_LOCKOUT_MINUTES", "15"))
