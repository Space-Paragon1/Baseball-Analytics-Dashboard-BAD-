"""Bring the database schema up to date. Runs on API startup and from init_db.

- New database: every migration runs.
- Database already tracked by Alembic: only pending migrations run.
- Tables created before migrations existed (v3.0 used create_all): they're
  matched to a revision, marked ("stamped") as that revision, and upgraded
  from there. Existing data is kept.
- Anything else, such as a v2 database: startup stops with a clear message
  instead of guessing.
"""

import logging
from pathlib import Path
from typing import Optional

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import Connection, Engine, inspect, text

from backend import models  # noqa: F401  (registers tables with Base)
from backend.database import Base

logger = logging.getLogger("bad.migrate")

MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"
V3_REVISION = "0001"  # the schema v3.0 created without migrations
_PG_LOCK_KEY = 7_311_948  # any constant; serializes concurrent startups on PostgreSQL


class DatabaseVersionError(RuntimeError):
    """The database's tables don't match any version of the schema we know how to upgrade."""


def include_name(name: Optional[str], type_: str, parent_names: dict) -> bool:
    """Only look at this app's tables, so other tables in a shared database are left alone."""
    return type_ != "table" or name in Base.metadata.tables


def alembic_config(connection: Optional[Connection] = None) -> Config:
    cfg = Config()
    cfg.set_main_option("script_location", str(MIGRATIONS_DIR))
    if connection is not None:
        cfg.attributes["connection"] = connection
    return cfg


def _columns(connection: Connection, table: str) -> set:
    return {c["name"] for c in inspect(connection).get_columns(table)}


def untracked_revision(connection: Connection) -> Optional[str]:
    """For tables that exist without migration history, the revision they match.

    Returns None for a database without any of our tables.
    """
    ours = set(inspect(connection).get_table_names()) & set(Base.metadata.tables)
    if not ours:
        return None

    context = MigrationContext.configure(connection, opts={"include_name": include_name})
    diffs = compare_metadata(context, Base.metadata)
    if not diffs:
        return "head"  # created from the current models

    if ours == set(Base.metadata.tables):
        game_cols, user_cols = _columns(connection, "game_records"), _columns(connection, "users")
        if "outs_pitched" in game_cols and "is_admin" in user_cols and "is_active" not in user_cols:
            return V3_REVISION

    if "game_records" in ours and "innings_pitched" in _columns(connection, "game_records"):
        raise DatabaseVersionError(
            "This database was created by BAD v2 and can't be upgraded automatically "
            "(innings and players are stored differently). Back it up, then delete it or point "
            "DATABASE_URL at a new database and restart. The sample data reloads on its own."
        )
    raise DatabaseVersionError(
        "The database's tables don't match any known version of the schema, so it wasn't changed. "
        f"First differences: {diffs[:3]}"
    )


def migrate_database(engine: Engine) -> None:
    with engine.begin() as connection:
        if connection.dialect.name == "postgresql":
            # If several processes start at once, only one migrates at a time.
            connection.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": _PG_LOCK_KEY})

        cfg = alembic_config(connection)
        if not inspect(connection).has_table("alembic_version"):
            revision = untracked_revision(connection)
            if revision:
                logger.info("Found tables without migration history; marking them as revision %s.", revision)
                command.stamp(cfg, revision)
        command.upgrade(cfg, "head")
