from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.common import DateRange, date_range
from backend.services import analytics
from backend.services.innings import outs_to_innings
from backend.services.records import load_df

router = APIRouter(prefix="/players", tags=["Players"])


def _row(df, player_id: int):
    if df.empty:
        return None
    match = df[df["player_id"] == player_id]
    return None if match.empty else analytics.to_records(match.head(1))[0]


@router.get("")
def list_players(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """Every player in the data: id, name, current team and main position."""
    df = load_df(db)
    if df.empty:
        return []
    ident = analytics.player_identity(df).reset_index().sort_values("player_name")
    return analytics.to_records(ident)


@router.get("/compare")
def compare_players(
    ids: List[int] = Query(default=[], description="2-3 player ids"),
    dates: DateRange = Depends(date_range),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    ids = list(dict.fromkeys(ids))  # drop duplicates, keep order
    if not 2 <= len(ids) <= 3:
        raise HTTPException(status_code=400, detail="Pick 2 or 3 different players to compare.")

    df = load_df(db, dates.start_date, dates.end_date)
    batting = analytics.calculate_batting_stats(df)
    pitching = analytics.calculate_pitching_stats(df)
    ident = analytics.player_identity(df) if not df.empty else None

    results = []
    for pid in ids:
        if ident is None or pid not in ident.index:
            raise HTTPException(status_code=404, detail=f"Player {pid} not found.")
        info = ident.loc[pid]
        results.append(
            {
                "player_id": pid,
                "player_name": info["player_name"],
                "team": info["team"],
                "position": info["position"],
                "batting": _row(batting, pid),
                "pitching": _row(pitching, pid),
            }
        )
    return results


@router.get("/{player_id}")
def get_player(player_id: int, dates: DateRange = Depends(date_range), db: Session = Depends(get_db)) -> Dict[str, Any]:
    df = load_df(db, dates.start_date, dates.end_date)
    player_df = df[df["player_id"] == player_id] if not df.empty else df
    if player_df.empty:
        raise HTTPException(status_code=404, detail="Player not found.")

    info = analytics.player_identity(player_df).iloc[0]
    logs = player_df.sort_values(["game_date", "id"]).copy()
    logs["innings_pitched"] = logs["outs_pitched"].map(outs_to_innings)
    return {
        "player_id": player_id,
        "player_name": info["player_name"],
        "team": info["team"],
        "position": info["position"],
        "batting": _row(analytics.calculate_batting_stats(df), player_id),
        "pitching": _row(analytics.calculate_pitching_stats(df), player_id),
        "game_logs": analytics.to_records(logs.drop(columns=["outs_pitched"])),
    }


@router.get("/{player_id}/trend")
def get_player_trend(
    player_id: int,
    stat: str = "batting_avg",
    dates: DateRange = Depends(date_range),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    df = load_df(db, dates.start_date, dates.end_date)
    if df.empty or not (df["player_id"] == player_id).any():
        raise HTTPException(status_code=404, detail="Player not found.")
    try:
        return analytics.performance_trend(df, player_id, stat)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None
