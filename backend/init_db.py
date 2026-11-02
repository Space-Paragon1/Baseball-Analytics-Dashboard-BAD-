"""Create the database tables and load the sample data (if the database is empty).

Run from the project root:
    python -m backend.init_db
"""

from backend import models  # noqa: F401  (registers tables with Base)
from backend.database import Base, SessionLocal, engine
from backend.services.records import seed_sample_data


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    print("Tables ready.")
    with SessionLocal() as db:
        loaded = seed_sample_data(db)
    print(f"Loaded {loaded} sample records." if loaded else "Database already has data; skipped sample load.")


if __name__ == "__main__":
    init_db()
