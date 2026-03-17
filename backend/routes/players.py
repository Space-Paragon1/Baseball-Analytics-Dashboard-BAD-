from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import pandas as pd
from typing import List, Dict, Any, Optional

from backend.database import get_db
from backend.models.game_record import GameRecord
from backend.services.analytics import AnalyticsService

router = APIRouter()
analytics = AnalyticsService()


def records_to_df(db: Session) -> pd.DataFrame:
    records = db.query(GameRecord).all()
    if not records:
        return pd.DataFrame()
    data = [
        {
            "player_id": r.player_id,
            "player_name": r.player_name,
            "team": r.team,
            "position": r.position,
            "game_date": r.game_date,
            "at_bats": r.at_bats,
            "hits": r.hits,
            "doubles": r.doubles,
            "triples": r.triples,
            "home_runs": r.home_runs,
            "runs": r.runs,
            "rbi": r.rbi,
            "strikeouts": r.strikeouts,
            "walks": r.walks,
            "hit_by_pitch": r.hit_by_pitch,
            "innings_pitched": r.innings_pitched,
            "earned_runs": r.earned_runs,
            "hits_allowed": r.hits_allowed,
            "walks_allowed": r.walks_allowed,
            "strikeouts_pitched": r.strikeouts_pitched,
            "game_id": r.game_id,
            "opponent": r.opponent,
        }
        for r in records
    ]
    return pd.DataFrame(data)


@router.get("/players")
def list_players(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    df = records_to_df(db)
    if df.empty:
        return []
    batting_df = analytics.calculate_batting_stats(df)
    if batting_df.empty:
        return []
    return batting_df.to_dict(orient="records")


@router.get("/players/compare")
def compare_players(
    players: List[str] = Query(default=[]),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    if len(players) < 2:
        raise HTTPException(status_code=400, detail="Provide at least 2 player names.")
    if len(players) > 3:
        raise HTTPException(status_code=400, detail="Maximum 3 players can be compared.")

    df = records_to_df(db)
    if df.empty:
        raise HTTPException(status_code=404, detail="No data found")

    batting_df = analytics.calculate_batting_stats(df)
    pitching_df = analytics.calculate_pitching_stats(df)

    results = []
    for name in players:
        batting_row = batting_df[batting_df["player_name"].str.lower() == name.lower()]
        pitching_row = (
            pitching_df[pitching_df["player_name"].str.lower() == name.lower()]
            if not pitching_df.empty and "player_name" in pitching_df.columns
            else pd.DataFrame()
        )

        if batting_row.empty:
            raise HTTPException(status_code=404, detail=f"Player '{name}' not found.")

        row = batting_row.iloc[0].to_dict()
        if not pitching_row.empty:
            pitch = pitching_row.iloc[0].to_dict()
            row["innings_pitched"] = pitch.get("innings_pitched", 0)
            row["earned_runs"] = pitch.get("earned_runs", 0)
            row["hits_allowed"] = pitch.get("hits_allowed", 0)
            row["walks_allowed"] = pitch.get("walks_allowed", 0)
            row["strikeouts_pitched"] = pitch.get("strikeouts_pitched", 0)
            row["era"] = pitch.get("era", None)
            row["whip"] = pitch.get("whip", None)
            row["k_per_9"] = pitch.get("k_per_9", None)
        else:
            row["era"] = None
            row["whip"] = None
            row["k_per_9"] = None
        results.append(row)

    return results


@router.get("/players/{player_name}")
def get_player(player_name: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    df = records_to_df(db)
    if df.empty:
        raise HTTPException(status_code=404, detail="Player not found")

    player_df = df[df["player_name"].str.lower() == player_name.lower()]
    if player_df.empty:
        raise HTTPException(status_code=404, detail="Player not found")

    batting_df = analytics.calculate_batting_stats(df)
    pitching_df = analytics.calculate_pitching_stats(df)

    batting_row = batting_df[batting_df["player_name"].str.lower() == player_name.lower()]
    pitching_row = pitching_df[pitching_df["player_name"].str.lower() == player_name.lower()]

    result: Dict[str, Any] = {}

    if not batting_row.empty:
        result["batting"] = batting_row.iloc[0].to_dict()

    if not pitching_row.empty:
        result["pitching"] = pitching_row.iloc[0].to_dict()

    game_logs = player_df.sort_values("game_date").to_dict(orient="records")
    for log in game_logs:
        if hasattr(log.get("game_date"), "isoformat"):
            log["game_date"] = log["game_date"].isoformat()

    result["game_logs"] = game_logs
    result["player_name"] = player_name
    result["team"] = player_df.iloc[0]["team"]
    result["position"] = player_df.iloc[0]["position"]

    return result


@router.get("/players/{player_name}/trend")
def get_player_trend(
    player_name: str,
    stat: str = "batting_avg",
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    df = records_to_df(db)
    if df.empty:
        raise HTTPException(status_code=404, detail="Player not found")

    player_df = df[df["player_name"].str.lower() == player_name.lower()]
    if player_df.empty:
        raise HTTPException(status_code=404, detail="Player not found")

    trend = analytics.get_performance_trend(df, player_df.iloc[0]["player_name"], stat)
    return trend
