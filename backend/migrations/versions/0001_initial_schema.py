"""Initial schema: the tables as they were in v3.0.

Revision ID: 0001
Revises:
Create Date: 2026-11-02
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "game_records",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("player_id", sa.Integer(), nullable=False),
        sa.Column("player_name", sa.String(), nullable=False),
        sa.Column("team", sa.String(), nullable=False),
        sa.Column("position", sa.String(), nullable=False),
        sa.Column("game_date", sa.Date(), nullable=False),
        sa.Column("game_id", sa.String(), nullable=False),
        sa.Column("opponent", sa.String(), nullable=False),
        sa.Column("at_bats", sa.Integer(), nullable=False),
        sa.Column("hits", sa.Integer(), nullable=False),
        sa.Column("doubles", sa.Integer(), nullable=False),
        sa.Column("triples", sa.Integer(), nullable=False),
        sa.Column("home_runs", sa.Integer(), nullable=False),
        sa.Column("runs", sa.Integer(), nullable=False),
        sa.Column("rbi", sa.Integer(), nullable=False),
        sa.Column("strikeouts", sa.Integer(), nullable=False),
        sa.Column("walks", sa.Integer(), nullable=False),
        sa.Column("hit_by_pitch", sa.Integer(), nullable=False),
        sa.Column("sacrifice_flies", sa.Integer(), nullable=False),
        sa.Column("outs_pitched", sa.Integer(), nullable=False),
        sa.Column("earned_runs", sa.Integer(), nullable=False),
        sa.Column("hits_allowed", sa.Integer(), nullable=False),
        sa.Column("walks_allowed", sa.Integer(), nullable=False),
        sa.Column("strikeouts_pitched", sa.Integer(), nullable=False),
        sa.Column("home_runs_allowed", sa.Integer(), nullable=False),
        sa.Column("hit_batsmen", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("game_id", "player_id", name="uq_game_player"),
    )
    with op.batch_alter_table("game_records", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_game_records_game_date"), ["game_date"], unique=False)
        batch_op.create_index(batch_op.f("ix_game_records_game_id"), ["game_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_game_records_id"), ["id"], unique=False)
        batch_op.create_index(batch_op.f("ix_game_records_player_id"), ["player_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_game_records_player_name"), ["player_name"], unique=False)
        batch_op.create_index(batch_op.f("ix_game_records_team"), ["team"], unique=False)

    op.create_table(
        "game_sessions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("home_team", sa.String(), nullable=False),
        sa.Column("away_team", sa.String(), nullable=False),
        sa.Column("game_date", sa.String(), nullable=False),
        sa.Column("events", sa.JSON(), nullable=False),
        sa.Column("saved", sa.Boolean(), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("username", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("is_admin", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_users_email"), ["email"], unique=True)
        batch_op.create_index(batch_op.f("ix_users_id"), ["id"], unique=False)
        batch_op.create_index(batch_op.f("ix_users_username"), ["username"], unique=True)


def downgrade() -> None:
    op.drop_table("users")
    op.drop_table("game_sessions")
    op.drop_table("game_records")
