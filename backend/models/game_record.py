from sqlalchemy import Column, Date, Integer, String, UniqueConstraint

from backend.database import Base


class GameRecord(Base):
    """One player's box-score line for one game (batting and/or pitching)."""

    __tablename__ = "game_records"
    __table_args__ = (UniqueConstraint("game_id", "player_id", name="uq_game_player"),)

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    player_id = Column(Integer, nullable=False, index=True)
    player_name = Column(String, nullable=False, index=True)
    team = Column(String, nullable=False, index=True)
    position = Column(String, nullable=False)
    game_date = Column(Date, nullable=False, index=True)
    game_id = Column(String, nullable=False, index=True)
    opponent = Column(String, nullable=False)

    # Batting
    at_bats = Column(Integer, nullable=False, default=0)
    hits = Column(Integer, nullable=False, default=0)
    doubles = Column(Integer, nullable=False, default=0)
    triples = Column(Integer, nullable=False, default=0)
    home_runs = Column(Integer, nullable=False, default=0)
    runs = Column(Integer, nullable=False, default=0)
    rbi = Column(Integer, nullable=False, default=0)
    strikeouts = Column(Integer, nullable=False, default=0)
    walks = Column(Integer, nullable=False, default=0)
    hit_by_pitch = Column(Integer, nullable=False, default=0)
    sacrifice_flies = Column(Integer, nullable=False, default=0)

    # Pitching. Innings are stored as outs so 5.1 + 5.2 adds up to 11.0, not 10.3.
    outs_pitched = Column(Integer, nullable=False, default=0)
    earned_runs = Column(Integer, nullable=False, default=0)
    hits_allowed = Column(Integer, nullable=False, default=0)
    walks_allowed = Column(Integer, nullable=False, default=0)
    strikeouts_pitched = Column(Integer, nullable=False, default=0)
    home_runs_allowed = Column(Integer, nullable=False, default=0)
    hit_batsmen = Column(Integer, nullable=False, default=0)
