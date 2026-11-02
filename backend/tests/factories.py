"""Helpers for building game-record DataFrames in tests."""

import pandas as pd

from backend.services.innings import innings_to_outs

DEFAULTS = {
    "position": "OF",
    "opponent": "Tigers",
    "at_bats": 0,
    "hits": 0,
    "doubles": 0,
    "triples": 0,
    "home_runs": 0,
    "runs": 0,
    "rbi": 0,
    "strikeouts": 0,
    "walks": 0,
    "hit_by_pitch": 0,
    "sacrifice_flies": 0,
    "outs_pitched": 0,
    "earned_runs": 0,
    "hits_allowed": 0,
    "walks_allowed": 0,
    "strikeouts_pitched": 0,
    "home_runs_allowed": 0,
    "hit_batsmen": 0,
}


def row(player_id, player_name, team, game_id, game_date, ip=None, **stats):
    r = {
        **DEFAULTS,
        "player_id": player_id,
        "player_name": player_name,
        "team": team,
        "game_id": game_id,
        "game_date": game_date,
        **stats,
    }
    if ip is not None:
        r["outs_pitched"] = innings_to_outs(ip)
    return r


def frame(rows):
    df = pd.DataFrame(rows)
    df["game_date"] = pd.to_datetime(df["game_date"])
    df["id"] = range(1, len(df) + 1)
    return df
