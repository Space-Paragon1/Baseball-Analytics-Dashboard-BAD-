"""Migrations: fresh installs, adopting databases made before migrations existed,
refusing ones we can't upgrade, and keeping the models and migrations in sync.

Runs on a temporary SQLite file, or on TEST_DATABASE_URL when that is set.
"""

import os

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect, text

from backend import database
from backend.database import Base
from backend.migrate import DatabaseVersionError, alembic_config, include_name, migrate_database

HEAD = ScriptDirectory.from_config(alembic_config()).get_current_head()


def _wipe(engine) -> None:
    Base.metadata.drop_all(engine)
    with engine.begin() as conn:
        for table in ("alembic_version", "other_app_table"):
            conn.execute(text(f"DROP TABLE IF EXISTS {table}"))


@pytest.fixture()
def engine(tmp_path):
    if os.environ.get("TEST_DATABASE_URL"):
        eng = database.engine
    else:
        eng = create_engine(f"sqlite:///{tmp_path / 'migrations.db'}")
    _wipe(eng)
    yield eng
    _wipe(eng)
    if eng is not database.engine:
        eng.dispose()


def _revision(engine):
    with engine.connect() as conn:
        return MigrationContext.configure(conn).get_current_revision()


def _drift(engine):
    with engine.connect() as conn:
        return compare_metadata(MigrationContext.configure(conn, opts={"include_name": include_name}), Base.metadata)


def _tables(engine):
    return set(inspect(engine).get_table_names())


def test_head_revision_is_the_latest_migration():
    assert HEAD == "0002"


def test_fresh_database_gets_every_migration_and_matches_the_models(engine):
    migrate_database(engine)
    assert _revision(engine) == HEAD
    assert _drift(engine) == []  # a model change without a migration fails here


def test_running_twice_changes_nothing(engine):
    migrate_database(engine)
    migrate_database(engine)
    assert _revision(engine) == HEAD


def test_v3_database_is_adopted_and_keeps_its_data(engine):
    # Recreate a v3.0 database: the 0001 tables, with no migration history.
    with engine.begin() as conn:
        command.upgrade(alembic_config(conn), "0001")
        conn.execute(text("DROP TABLE alembic_version"))
        conn.execute(
            text(
                "INSERT INTO users (username, email, hashed_password, is_admin) "
                "VALUES ('owner', 'owner@example.com', 'x', :t)"
            ),
            {"t": True},
        )
        conn.execute(
            text(
                "INSERT INTO game_records (player_id, player_name, team, position, game_date, game_id, opponent, "
                "at_bats, hits, doubles, triples, home_runs, runs, rbi, strikeouts, walks, hit_by_pitch, "
                "sacrifice_flies, outs_pitched, earned_runs, hits_allowed, walks_allowed, strikeouts_pitched, "
                "home_runs_allowed, hit_batsmen) VALUES (1, 'A', 'Eagles', 'CF', '2025-04-01', 'G1', 'Tigers', "
                "4, 2, 0, 0, 1, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)"
            )
        )

    migrate_database(engine)

    assert _revision(engine) == HEAD
    assert _drift(engine) == []
    with engine.connect() as conn:
        user = conn.execute(text("SELECT username, is_active, token_version FROM users")).one()
        assert (user.username, bool(user.is_active), user.token_version) == ("owner", True, 0)
        assert conn.execute(text("SELECT COUNT(*) FROM game_records")).scalar() == 1


def test_tables_made_from_the_current_models_are_marked_up_to_date(engine):
    Base.metadata.create_all(engine)
    migrate_database(engine)
    assert _revision(engine) == HEAD


def test_v2_database_is_refused_and_left_untouched(engine):
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE game_records (id INTEGER PRIMARY KEY, innings_pitched FLOAT)"))
    with pytest.raises(DatabaseVersionError, match="v2"):
        migrate_database(engine)
    assert _tables(engine) == {"game_records"}


def test_other_apps_tables_are_ignored(engine):
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE other_app_table (id INTEGER PRIMARY KEY)"))
    migrate_database(engine)
    assert "other_app_table" in _tables(engine)
    assert _drift(engine) == []


def test_every_migration_can_be_undone(engine):
    migrate_database(engine)
    with engine.begin() as conn:
        command.downgrade(alembic_config(conn), "base")
    assert _tables(engine) & set(Base.metadata.tables) == set()
    migrate_database(engine)
    assert _revision(engine) == HEAD
