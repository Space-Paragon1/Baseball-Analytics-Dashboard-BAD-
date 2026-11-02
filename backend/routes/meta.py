from typing import Any, Dict

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import GameRecord
from backend.services import analytics
from backend.services.records import load_df

router = APIRouter(tags=["Meta"])


@router.get("/meta")
def meta(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Lookup data for filters and forms: teams, players, positions, date range."""
    first, last, total = db.execute(
        select(func.min(GameRecord.game_date), func.max(GameRecord.game_date), func.count(GameRecord.id))
    ).one()
    teams = db.scalars(select(GameRecord.team).distinct().order_by(GameRecord.team)).all()
    positions = db.scalars(select(GameRecord.position).distinct().order_by(GameRecord.position)).all()

    players = []
    if total:
        df = load_df(db)
        players = analytics.to_records(analytics.player_identity(df).reset_index().sort_values("player_name"))

    return {
        "total_records": total,
        "teams": teams,
        "positions": positions,
        "players": players,
        "date_range": {"min": first.isoformat() if first else None, "max": last.isoformat() if last else None},
    }
