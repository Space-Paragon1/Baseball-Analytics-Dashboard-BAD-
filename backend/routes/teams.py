from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import pandas as pd
from typing import List, Dict, Any

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


@router.get("/teams")
def list_teams(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    df = records_to_df(db)
    if df.empty:
        return []
    team_df = analytics.calculate_team_stats(df)
    return team_df.to_dict(orient="records")


@router.get("/teams/{team_name}")
def get_team(team_name: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    df = records_to_df(db)
    if df.empty:
        raise HTTPException(status_code=404, detail="Team not found")

    team_df = df[df["team"].str.lower() == team_name.lower()]
    if team_df.empty:
        raise HTTPException(status_code=404, detail="Team not found")

    actual_team_name = team_df.iloc[0]["team"]
    team_stats_df = analytics.calculate_team_stats(df)
    team_stats_row = team_stats_df[team_stats_df["team"].str.lower() == team_name.lower()]

    batting_df = analytics.calculate_batting_stats(df)
    pitching_df = analytics.calculate_pitching_stats(df)

    roster_batting = batting_df[batting_df["team"].str.lower() == team_name.lower()].to_dict(orient="records")
    roster_pitching = pitching_df[pitching_df["team"].str.lower() == team_name.lower()].to_dict(orient="records")

    players_in_team = team_df["player_name"].unique().tolist()

    result: Dict[str, Any] = {
        "team": actual_team_name,
        "players": players_in_team,
        "roster_batting": roster_batting,
        "roster_pitching": roster_pitching,
        "stats": team_stats_row.iloc[0].to_dict() if not team_stats_row.empty else {},
    }
    return result


@router.get("/teams/{team_name}/games")
def get_team_games(team_name: str, db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    df = records_to_df(db)
    if df.empty:
        raise HTTPException(status_code=404, detail="Team not found")

    team_df = df[df["team"].str.lower() == team_name.lower()]
    if team_df.empty:
        raise HTTPException(status_code=404, detail="Team not found")

    game_summary = team_df.groupby(["game_id", "game_date", "opponent"]).agg(
        runs_scored=("runs", "sum"),
        hits_total=("hits", "sum"),
        home_runs_total=("home_runs", "sum"),
    ).reset_index().sort_values("game_date")

    result = game_summary.to_dict(orient="records")
    for row in result:
        if hasattr(row.get("game_date"), "isoformat"):
            row["game_date"] = row["game_date"].isoformat()
    return result
