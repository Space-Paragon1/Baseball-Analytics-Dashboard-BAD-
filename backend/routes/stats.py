from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.common import DateRange, date_range
from backend.services import analytics
from backend.services.records import load_df

router = APIRouter(prefix="/stats", tags=["Stats"])


def _filter(df, team: Optional[str], qualified_only: bool):
    if df.empty:
        return df
    if team:
        df = df[df["team"].str.lower() == team.lower()]
    if qualified_only:
        df = df[df["qualified"]]
    return df


@router.get("/batting")
def batting_leaderboard(
    dates: DateRange = Depends(date_range),
    team: Optional[str] = None,
    qualified_only: bool = False,
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    df = load_df(db, dates.start_date, dates.end_date)
    return analytics.to_records(_filter(analytics.calculate_batting_stats(df), team, qualified_only))


@router.get("/pitching")
def pitching_leaderboard(
    dates: DateRange = Depends(date_range),
    team: Optional[str] = None,
    qualified_only: bool = False,
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    df = load_df(db, dates.start_date, dates.end_date)
    return analytics.to_records(_filter(analytics.calculate_pitching_stats(df), team, qualified_only))


@router.get("/insights")
def insights(dates: DateRange = Depends(date_range), db: Session = Depends(get_db)) -> List[str]:
    df = load_df(db, dates.start_date, dates.end_date)
    if df.empty:
        return []
    return analytics.generate_insights(
        analytics.calculate_batting_stats(df),
        analytics.calculate_pitching_stats(df),
        analytics.calculate_team_stats(df),
    )


@router.get("/dashboard")
def dashboard(
    dates: DateRange = Depends(date_range),
    trend_points: int = Query(default=15, ge=1, le=200),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    df = load_df(db, dates.start_date, dates.end_date)
    summary = analytics.league_summary(df)
    if df.empty:
        return {
            **summary,
            "top_performer": None,
            "top_pitcher": None,
            "teams": [],
            "recent_trend": [],
            "top5_batters": [],
        }

    batting = analytics.calculate_batting_stats(df)
    pitching = analytics.calculate_pitching_stats(df)
    teams = analytics.calculate_team_stats(df)

    top_performer = top_pitcher = None
    top5 = []
    if not batting.empty:
        qb = analytics.qualified_or_all(batting)
        top_performer = analytics.to_records(
            qb.sort_values("batting_avg", ascending=False).head(1)[
                ["player_id", "player_name", "team", "batting_avg", "ops", "home_runs", "rbi"]
            ]
        )[0]
        top5 = analytics.to_records(
            qb.sort_values("ops", ascending=False).head(5)[
                ["player_id", "player_name", "team", "batting_avg", "obp", "slg", "ops", "home_runs", "rbi", "hits"]
            ]
        )
    if not pitching.empty:
        qp = analytics.qualified_or_all(pitching).dropna(subset=["era"])
        if not qp.empty:
            top_pitcher = analytics.to_records(
                qp.sort_values("era").head(1)[
                    ["player_id", "player_name", "team", "era", "fip", "whip", "strikeouts_pitched", "innings_pitched"]
                ]
            )[0]

    by_date = (
        df.groupby("game_date")
        .agg(games=("game_id", "nunique"), total_runs=("runs", "sum"), total_hits=("hits", "sum"))
        .reset_index()
        .sort_values("game_date")
        .tail(trend_points)
    )
    by_date["runs_per_game"] = (by_date["total_runs"] / by_date["games"]).round(2)

    return {
        **summary,
        "top_performer": top_performer,
        "top_pitcher": top_pitcher,
        "teams": analytics.to_records(teams),
        "recent_trend": analytics.to_records(by_date),
        "top5_batters": top5,
    }
