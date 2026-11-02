"""Create or upgrade the database tables and load the sample data (if the database is empty).

The API does this on startup too. Run from the project root:
    python -m backend.init_db
"""

import sys

from backend.database import SessionLocal, engine
from backend.migrate import DatabaseVersionError, migrate_database
from backend.services.records import seed_sample_data


def init_db() -> None:
    try:
        migrate_database(engine)
    except DatabaseVersionError as exc:
        sys.exit(f"Database not upgraded: {exc}")
    print("Database schema is up to date.")
    with SessionLocal() as db:
        loaded = seed_sample_data(db)
    print(f"Loaded {loaded} sample records." if loaded else "Database already has data; skipped sample load.")


if __name__ == "__main__":
    init_db()
