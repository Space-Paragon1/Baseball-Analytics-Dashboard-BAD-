"""Alembic environment, used both by the `alembic` command and by the API on
startup (backend/migrate.py passes in an open connection)."""

from logging.config import fileConfig

from alembic import context

from backend.config import DATABASE_URL
from backend.database import Base
from backend.migrate import include_name

config = context.config
if config.config_file_name:  # only when run from the command line
    fileConfig(config.config_file_name, disable_existing_loggers=False)

OPTIONS = {
    "target_metadata": Base.metadata,
    # Batch mode lets ALTER-style changes work on SQLite, which can't alter
    # columns in place. On PostgreSQL it runs as normal ALTER TABLE statements.
    "render_as_batch": True,
    # Ignore tables that aren't ours, so autogenerate never drops them.
    "include_name": include_name,
}


def run_migrations_offline() -> None:
    """`alembic upgrade head --sql`: print the SQL instead of running it."""
    context.configure(url=DATABASE_URL, literal_binds=True, dialect_opts={"paramstyle": "named"}, **OPTIONS)
    with context.begin_transaction():
        context.run_migrations()


def _run(connection) -> None:
    context.configure(connection=connection, **OPTIONS)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connection = config.attributes.get("connection")
    if connection is not None:
        _run(connection)
        return
    from backend.database import engine

    with engine.connect() as connection:
        _run(connection)
        connection.commit()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
