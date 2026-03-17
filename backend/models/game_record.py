from sqlalchemy import Column, Integer, String, Float, Date
from backend.database import Base


class GameRecord(Base):
    __tablename__ = "game_records"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    player_id = Column(Integer, nullable=False)
    player_name = Column(String, nullable=False, index=True)
    team = Column(String, nullable=False, index=True)
    position = Column(String, nullable=False)
    game_date = Column(Date, nullable=False)
    at_bats = Column(Integer, default=0)
    hits = Column(Integer, default=0)
    doubles = Column(Integer, default=0)
    triples = Column(Integer, default=0)
    home_runs = Column(Integer, default=0)
    runs = Column(Integer, default=0)
    rbi = Column(Integer, default=0)
    strikeouts = Column(Integer, default=0)
    walks = Column(Integer, default=0)
    hit_by_pitch = Column(Integer, default=0)
    innings_pitched = Column(Float, default=0.0)
    earned_runs = Column(Integer, default=0)
    hits_allowed = Column(Integer, default=0)
    walks_allowed = Column(Integer, default=0)
    strikeouts_pitched = Column(Integer, default=0)
    game_id = Column(String, nullable=False, index=True)
    opponent = Column(String, nullable=False)
