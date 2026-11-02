from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.common import DateRange, date_range
from backend.services import analytics
from backend.services.records import load_df

router = APIRouter(prefix="/teams", tags=["Teams"])


@router.get("")
def list_teams(dates: DateRange = Depends(date_range), db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """Standings plus team batting and pitching, best record first."""
    df = load_df(db, dates.start_date, dates.end_date)
    return analytics.to_records(analytics.calculate_team_stats(df))


@router.get("/{team_name}")
def get_team(team_name: str, dates: DateRange = Depends(date_range), db: Session = Depends(get_db)) -> Dict[str, Any]:
    df = load_df(db, dates.start_date, dates.end_date)
    team_df = df[df["team"].str.lower() == team_name.lower()] if not df.empty else df
    if team_df.empty:
        raise HTTPException(status_code=404, detail="Team not found.")

    # Team stats need opponents' rows for runs allowed, so compute on everything.
    teams = analytics.calculate_team_stats(df)
    stats = teams[teams["team"].str.lower() == team_name.lower()]

    # Roster lines count only games played for this team.
    return {
        "team": team_df.iloc[0]["team"],
        "stats": analytics.to_records(stats)[0] if not stats.empty else {},
        "roster_batting": analytics.to_records(analytics.calculate_batting_stats(team_df)),
        "roster_pitching": analytics.to_records(analytics.calculate_pitching_stats(team_df)),
    }


@router.get("/{team_name}/games")
def get_team_games(
    team_name: str, dates: DateRange = Depends(date_range), db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    df = load_df(db, dates.start_date, dates.end_date)
    results = analytics.game_results(df)
    if results.empty:
        raise HTTPException(status_code=404, detail="Team not found.")
    team_games = results[results["team"].str.lower() == team_name.lower()]
    if team_games.empty:
        raise HTTPException(status_code=404, detail="Team not found.")
    return analytics.to_records(team_games)
