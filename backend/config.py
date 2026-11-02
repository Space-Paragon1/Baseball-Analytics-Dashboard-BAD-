"""App settings, read once from environment variables (and backend/.env if present)."""

import logging
import os
import secrets
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


DATABASE_URL = _env("DATABASE_URL", f"sqlite:///{ROOT_DIR / 'baseball.db'}")

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

# Largest CSV upload accepted, in megabytes.
MAX_UPLOAD_MB = int(_env("MAX_UPLOAD_MB", "10"))
