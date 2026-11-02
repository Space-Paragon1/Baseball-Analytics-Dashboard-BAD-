from datetime import UTC, datetime

from sqlalchemy import JSON, Boolean, Column, DateTime, Integer, String

from backend.database import Base


def _now():
    return datetime.now(UTC)


class GameSession(Base):
    """A Game Mode game in progress. State is rebuilt by replaying `events`."""

    __tablename__ = "game_sessions"

    id = Column(String, primary_key=True)
    home_team = Column(String, nullable=False)
    away_team = Column(String, nullable=False)
    game_date = Column(String, nullable=False)
    events = Column(JSON, nullable=False, default=list)
    saved = Column(Boolean, nullable=False, default=False)
    created_by = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)
