from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
import pandas as pd
from typing import List, Dict, Any, Optional
from datetime import date

from backend.database import get_db
from backend.models.game_record import GameRecord
from backend.services.analytics import AnalyticsService

router = APIRouter()
analytics = AnalyticsService()


def records_to_df(
    db: Session,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> pd.DataFrame:
    query = db.query(GameRecord)

    if start_date:
        try:
            sd = date.fromisoformat(start_date)
            query = query.filter(GameRecord.game_date >= sd)
        except ValueError:
            pass

    if end_date:
        try:
            ed = date.fromisoformat(end_date)
            query = query.filter(GameRecord.game_date <= ed)
        except ValueError:
            pass

    records = query.all()
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


@router.get("/stats/batting")
def get_batting_leaderboard(
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    df = records_to_df(db, start_date, end_date)
    if df.empty:
        return []
    batting_df = analytics.calculate_batting_stats(df)
    return batting_df.sort_values("batting_avg", ascending=False).to_dict(orient="records")


@router.get("/stats/pitching")
def get_pitching_leaderboard(
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    df = records_to_df(db, start_date, end_date)
    if df.empty:
        return []
    pitching_df = analytics.calculate_pitching_stats(df)
    if pitching_df.empty:
        return []
    return pitching_df.sort_values("era", ascending=True).to_dict(orient="records")


@router.get("/stats/insights")
def get_insights(db: Session = Depends(get_db)) -> List[str]:
    df = records_to_df(db)
    if df.empty:
        return []
    batting_df = analytics.calculate_batting_stats(df)
    pitching_df = analytics.calculate_pitching_stats(df)
    team_df = analytics.calculate_team_stats(df)
    return analytics.generate_insights(batting_df, pitching_df, team_df)


@router.get("/stats/dashboard")
def get_dashboard(
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    df = records_to_df(db, start_date, end_date)
    if df.empty:
        return {
            "total_games": 0,
            "total_runs": 0,
            "league_batting_avg": 0.0,
            "top_performer": None,
            "top_pitcher": None,
            "teams": [],
            "recent_trend": [],
            "top5_batters": [],
        }

    total_games = df["game_id"].nunique()
    total_runs = int(df["runs"].sum())

    total_hits = int(df["hits"].sum())
    total_ab = int(df["at_bats"].sum())
    league_batting_avg = round(total_hits / total_ab, 3) if total_ab > 0 else 0.0

    batting_df = analytics.calculate_batting_stats(df)
    pitching_df = analytics.calculate_pitching_stats(df)
    team_df = analytics.calculate_team_stats(df)

    top_performer = None
    if not batting_df.empty:
        top = batting_df.sort_values("batting_avg", ascending=False).iloc[0]
        top_performer = {
            "player_name": top["player_name"],
            "team": top["team"],
            "batting_avg": top["batting_avg"],
            "home_runs": int(top["home_runs"]),
            "rbi": int(top["rbi"]),
        }

    top_pitcher = None
    if not pitching_df.empty:
        tp = pitching_df.sort_values("era", ascending=True).iloc[0]
        top_pitcher = {
            "player_name": tp["player_name"],
            "team": tp["team"],
            "era": tp["era"],
            "strikeouts_pitched": int(tp["strikeouts_pitched"]),
            "whip": tp["whip"],
        }

    teams_list = team_df.to_dict(orient="records") if not team_df.empty else []

    # Recent trend: runs per game date (all teams combined)
    runs_by_date = df.groupby("game_date").agg(
        total_runs=("runs", "sum"),
        total_hits=("hits", "sum"),
    ).reset_index().sort_values("game_date").tail(10)

    recent_trend = []
    for _, row in runs_by_date.iterrows():
        recent_trend.append({
            "game_date": str(row["game_date"]),
            "total_runs": int(row["total_runs"]),
            "total_hits": int(row["total_hits"]),
        })

    # Top 5 batters for bar chart
    top5_batters = []
    if not batting_df.empty:
        top5 = batting_df.sort_values("batting_avg", ascending=False).head(5)
        top5_batters = top5[["player_name", "team", "batting_avg", "home_runs", "rbi", "hits"]].to_dict(orient="records")

    return {
        "total_games": total_games,
        "total_runs": total_runs,
        "league_batting_avg": league_batting_avg,
        "top_performer": top_performer,
        "top_pitcher": top_pitcher,
        "teams": teams_list,
        "recent_trend": recent_trend,
        "top5_batters": top5_batters,
    }
