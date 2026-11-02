"""Stat calculations over a DataFrame of game records (one row per player per game).

Players are identified by player_id. A player's displayed team is their most
recent team, and their position is the one they played most often.
"""

from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from backend.services.innings import outs_to_innings

# Linear weights for wOBA (FanGraphs, 2023 MLB season). Close enough for any
# modern season; real-season constants shift by only a few thousandths.
WOBA_WEIGHTS = {"bb": 0.696, "hbp": 0.726, "single": 0.883, "double": 1.244, "triple": 1.569, "hr": 2.004}

# Qualification for rate-stat leaderboards: MLB's per-game rule, plus a floor
# so a team with only a couple of games in the data can't crown a 2-game leader.
PA_PER_TEAM_GAME = 3.1
MIN_PA = 20
OUTS_PER_TEAM_GAME = 3  # 1 inning per team game
MIN_OUTS = 30  # 10 innings

BATTING_COUNTS = [
    "at_bats",
    "hits",
    "doubles",
    "triples",
    "home_runs",
    "runs",
    "rbi",
    "strikeouts",
    "walks",
    "hit_by_pitch",
    "sacrifice_flies",
]
PITCHING_COUNTS = [
    "outs_pitched",
    "earned_runs",
    "hits_allowed",
    "walks_allowed",
    "strikeouts_pitched",
    "home_runs_allowed",
    "hit_batsmen",
]


# ---------------------------------------------------------------- helpers


def _rate(num: pd.Series, den: pd.Series, digits: int, empty: Optional[float] = 0.0) -> pd.Series:
    """num / den rounded, with `empty` where the denominator is 0."""
    num = num.astype(float)
    den = den.astype(float)
    out = (num / den.where(den > 0)).round(digits)
    return out if empty is None else out.fillna(empty)


def to_records(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """DataFrame -> JSON-safe list of dicts (NaN -> None, dates -> ISO strings)."""
    if df.empty:
        return []
    out = df.copy()
    for col in out.columns:
        if pd.api.types.is_datetime64_any_dtype(out[col]):
            out[col] = out[col].dt.strftime("%Y-%m-%d")
    out = out.astype(object).where(out.notna(), None)
    return out.to_dict(orient="records")


def player_identity(df: pd.DataFrame) -> pd.DataFrame:
    """player_id -> latest name, latest team, and most-played position."""
    ordered = df.sort_values(["game_date", "id"] if "id" in df.columns else ["game_date"])
    latest = ordered.groupby("player_id").tail(1).set_index("player_id")[["player_name", "team"]]

    pos = (
        ordered.groupby(["player_id", "position"])
        .agg(n=("game_id", "size"), last=("game_date", "max"))
        .reset_index()
        .sort_values(["player_id", "n", "last"], ascending=[True, False, False])
        .drop_duplicates("player_id")
        .set_index("player_id")["position"]
    )
    return latest.join(pos)


def team_games(df: pd.DataFrame) -> pd.Series:
    """Number of games each team played in the data."""
    if df.empty:
        return pd.Series(dtype=int)
    return df.groupby("team")["game_id"].nunique()


def _plate_appearances(df: pd.DataFrame) -> pd.Series:
    return df["at_bats"] + df["walks"] + df["hit_by_pitch"] + df["sacrifice_flies"]


def _pitched(df: pd.DataFrame) -> pd.Series:
    return (df[PITCHING_COUNTS].sum(axis=1)) > 0


# ---------------------------------------------------------------- batting


def calculate_batting_stats(df: pd.DataFrame) -> pd.DataFrame:
    """Season batting lines per player, sorted by batting average."""
    if df.empty:
        return pd.DataFrame()
    batters = df[_plate_appearances(df) > 0]
    if batters.empty:
        return pd.DataFrame()

    g = batters.groupby("player_id").agg(
        games_played=("game_id", "nunique"),
        **{c: (c, "sum") for c in BATTING_COUNTS},
    )
    g = player_identity(df).join(g, how="inner")

    singles = g["hits"] - g["doubles"] - g["triples"] - g["home_runs"]
    total_bases = singles + 2 * g["doubles"] + 3 * g["triples"] + 4 * g["home_runs"]
    pa = g["at_bats"] + g["walks"] + g["hit_by_pitch"] + g["sacrifice_flies"]

    g["plate_appearances"] = pa
    g["total_bases"] = total_bases
    g["batting_avg"] = _rate(g["hits"], g["at_bats"], 3)
    g["obp"] = _rate(g["hits"] + g["walks"] + g["hit_by_pitch"], pa, 3)
    g["slg"] = _rate(total_bases, g["at_bats"], 3)
    g["ops"] = (g["obp"] + g["slg"]).round(3)
    g["iso"] = (g["slg"] - g["batting_avg"]).round(3)
    g["babip"] = _rate(
        g["hits"] - g["home_runs"],
        g["at_bats"] - g["strikeouts"] - g["home_runs"] + g["sacrifice_flies"],
        3,
    )
    g["k_pct"] = _rate(g["strikeouts"], pa, 3)
    g["bb_pct"] = _rate(g["walks"], pa, 3)
    w = WOBA_WEIGHTS
    woba_num = (
        w["bb"] * g["walks"]
        + w["hbp"] * g["hit_by_pitch"]
        + w["single"] * singles
        + w["double"] * g["doubles"]
        + w["triple"] * g["triples"]
        + w["hr"] * g["home_runs"]
    )
    g["woba"] = _rate(woba_num, pa, 3)

    games = team_games(df)
    g["qualified"] = pa >= (PA_PER_TEAM_GAME * g["team"].map(games).fillna(0)).clip(lower=MIN_PA)

    g = g.reset_index().sort_values(["batting_avg", "plate_appearances"], ascending=[False, False])
    return g.reset_index(drop=True)


# ---------------------------------------------------------------- pitching


def fip_constant(df: pd.DataFrame) -> Optional[float]:
    """League FIP constant so that league-average FIP equals league ERA."""
    p = df[_pitched(df)] if not df.empty else df
    outs = p["outs_pitched"].sum() if not p.empty else 0
    if outs <= 0:
        return None
    ip = outs / 3
    lg_era = 9 * p["earned_runs"].sum() / ip
    raw = (
        13 * p["home_runs_allowed"].sum()
        + 3 * (p["walks_allowed"].sum() + p["hit_batsmen"].sum())
        - 2 * p["strikeouts_pitched"].sum()
    ) / ip
    return float(lg_era - raw)


def calculate_pitching_stats(df: pd.DataFrame) -> pd.DataFrame:
    """Season pitching lines per player, sorted by ERA (lowest first)."""
    if df.empty:
        return pd.DataFrame()
    pitchers = df[_pitched(df)]
    if pitchers.empty:
        return pd.DataFrame()

    g = pitchers.groupby("player_id").agg(
        games=("game_id", "nunique"),
        **{c: (c, "sum") for c in PITCHING_COUNTS},
    )
    g = player_identity(df).join(g, how="inner")

    ip = g["outs_pitched"] / 3
    g["innings_pitched"] = g["outs_pitched"].map(outs_to_innings)
    g["era"] = _rate(9 * g["earned_runs"], ip, 2, empty=None)
    g["whip"] = _rate(g["walks_allowed"] + g["hits_allowed"], ip, 2, empty=None)
    g["k_per_9"] = _rate(9 * g["strikeouts_pitched"], ip, 2, empty=None)
    g["bb_per_9"] = _rate(9 * g["walks_allowed"], ip, 2, empty=None)
    g["hr_per_9"] = _rate(9 * g["home_runs_allowed"], ip, 2, empty=None)
    g["k_bb"] = _rate(g["strikeouts_pitched"], g["walks_allowed"], 2, empty=None)

    c = fip_constant(df)
    if c is None:
        g["fip"] = np.nan
    else:
        raw = _rate(
            13 * g["home_runs_allowed"] + 3 * (g["walks_allowed"] + g["hit_batsmen"]) - 2 * g["strikeouts_pitched"],
            ip,
            6,
            empty=None,
        )
        g["fip"] = (raw + c).round(2)

    games = team_games(df)
    g["qualified"] = g["outs_pitched"] >= (OUTS_PER_TEAM_GAME * g["team"].map(games).fillna(0)).clip(lower=MIN_OUTS)

    g = g.reset_index().sort_values(["era", "outs_pitched"], ascending=[True, False], na_position="last")
    return g.reset_index(drop=True)


# ---------------------------------------------------------------- teams


def game_results(df: pd.DataFrame) -> pd.DataFrame:
    """One row per team per game with runs scored/allowed and W/L/T.

    Runs allowed come from the opponent's rows for the same game; when the
    opponent isn't in the data the result is left blank.
    """
    if df.empty:
        return pd.DataFrame()
    per = (
        df.groupby(["game_id", "team"])
        .agg(
            game_date=("game_date", "min"),
            opponent=("opponent", "first"),
            runs_scored=("runs", "sum"),
            hits=("hits", "sum"),
            home_runs=("home_runs", "sum"),
        )
        .reset_index()
    )
    opp = per[["game_id", "team", "runs_scored"]].rename(columns={"team": "opponent", "runs_scored": "runs_allowed"})
    per = per.merge(opp, on=["game_id", "opponent"], how="left")
    result = np.where(
        per["runs_scored"] > per["runs_allowed"],
        "W",
        np.where(per["runs_scored"] < per["runs_allowed"], "L", "T"),
    )
    per["result"] = pd.Series(result, index=per.index, dtype=object).where(per["runs_allowed"].notna(), None)
    return per.sort_values(["game_date", "game_id"]).reset_index(drop=True)


def calculate_team_stats(df: pd.DataFrame) -> pd.DataFrame:
    """Team batting, pitching and standings, sorted by winning percentage."""
    if df.empty:
        return pd.DataFrame()

    bat = df.groupby("team").agg(
        games=("game_id", "nunique"),
        **{f"total_{c}": (c, "sum") for c in BATTING_COUNTS},
    )
    pa = bat["total_at_bats"] + bat["total_walks"] + bat["total_hit_by_pitch"] + bat["total_sacrifice_flies"]
    singles = bat["total_hits"] - bat["total_doubles"] - bat["total_triples"] - bat["total_home_runs"]
    tb = singles + 2 * bat["total_doubles"] + 3 * bat["total_triples"] + 4 * bat["total_home_runs"]
    bat["batting_avg"] = _rate(bat["total_hits"], bat["total_at_bats"], 3)
    bat["obp"] = _rate(bat["total_hits"] + bat["total_walks"] + bat["total_hit_by_pitch"], pa, 3)
    bat["slg"] = _rate(tb, bat["total_at_bats"], 3)
    bat["ops"] = (bat["obp"] + bat["slg"]).round(3)

    pit = df.groupby("team").agg(**{f"total_{c}": (c, "sum") for c in PITCHING_COUNTS})
    ip = pit["total_outs_pitched"] / 3
    pit["innings_pitched"] = pit["total_outs_pitched"].map(outs_to_innings)
    pit["team_era"] = _rate(9 * pit["total_earned_runs"], ip, 2, empty=None)
    pit["team_whip"] = _rate(pit["total_walks_allowed"] + pit["total_hits_allowed"], ip, 2, empty=None)

    res = game_results(df)
    known = res[res["result"].notna()]
    rec = known.groupby("team").agg(
        wins=("result", lambda s: int((s == "W").sum())),
        losses=("result", lambda s: int((s == "L").sum())),
        ties=("result", lambda s: int((s == "T").sum())),
        runs_allowed=("runs_allowed", "sum"),
        runs_scored_known=("runs_scored", "sum"),
    )

    out = bat.join(pit).join(rec)
    for col in ("wins", "losses", "ties"):
        out[col] = out[col].fillna(0).astype(int)
    decided = out["wins"] + out["losses"]
    out["win_pct"] = _rate(out["wins"] + 0.5 * out["ties"], decided + out["ties"], 3)
    out["run_diff"] = (out["runs_scored_known"] - out["runs_allowed"]).astype("Int64")
    rs, ra = out["runs_scored_known"].astype(float), out["runs_allowed"].astype(float)
    exp = 1.83  # Pythagorean expectation exponent
    out["pythag_pct"] = _rate(rs**exp, rs**exp + ra**exp, 3, empty=None)
    out["runs_allowed"] = out["runs_allowed"].astype("Int64")
    out = out.drop(columns=["runs_scored_known"])

    out = out.reset_index().sort_values(["win_pct", "run_diff"], ascending=[False, False], na_position="last")
    return out.reset_index(drop=True)


# ---------------------------------------------------------------- league


def league_summary(df: pd.DataFrame) -> Dict[str, Any]:
    if df.empty:
        return {"total_games": 0, "total_runs": 0, "league_batting_avg": 0.0, "league_ops": 0.0, "league_era": None}
    ab = df["at_bats"].sum()
    h = df["hits"].sum()
    pa = _plate_appearances(df).sum()
    singles = h - df["doubles"].sum() - df["triples"].sum() - df["home_runs"].sum()
    tb = singles + 2 * df["doubles"].sum() + 3 * df["triples"].sum() + 4 * df["home_runs"].sum()
    obp = (h + df["walks"].sum() + df["hit_by_pitch"].sum()) / pa if pa else 0.0
    slg = tb / ab if ab else 0.0
    outs = df["outs_pitched"].sum()
    return {
        "total_games": int(df["game_id"].nunique()),
        "total_runs": int(df["runs"].sum()),
        "league_batting_avg": round(float(h / ab), 3) if ab else 0.0,
        "league_ops": round(float(obp + slg), 3),
        "league_era": round(float(27 * df["earned_runs"].sum() / outs), 2) if outs else None,
    }


# ---------------------------------------------------------------- insights


def _leader(df: pd.DataFrame, col: str, ascending: bool = False) -> Optional[pd.Series]:
    d = df.dropna(subset=[col])
    if d.empty:
        return None
    return d.sort_values(col, ascending=ascending).iloc[0]


def qualified_or_all(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty or "qualified" not in df.columns:
        return df
    q = df[df["qualified"]]
    return q if not q.empty else df


def fmt_avg(v: float) -> str:
    s = f"{v:.3f}"
    return s[1:] if s.startswith("0") else s


def generate_insights(batting: pd.DataFrame, pitching: pd.DataFrame, teams: pd.DataFrame) -> List[str]:
    """Plain-English observations about the data."""
    insights: List[str] = []

    if not batting.empty:
        qb = qualified_or_all(batting)
        if (p := _leader(qb, "batting_avg")) is not None:
            insights.append(f"{p['player_name']} leads qualified batters with a {fmt_avg(p['batting_avg'])} average.")
        if (p := _leader(batting, "home_runs")) is not None and p["home_runs"] > 0:
            insights.append(f"{p['player_name']} leads the league with {int(p['home_runs'])} home runs.")
        if (p := _leader(batting, "rbi")) is not None and p["rbi"] > 0:
            insights.append(f"{p['player_name']} tops the RBI chart with {int(p['rbi'])} runs batted in.")
        if (p := _leader(qb, "woba")) is not None:
            insights.append(
                f"{p['player_name']} has the best wOBA ({fmt_avg(p['woba'])}) and an OPS of {p['ops']:.3f}."
            )
        if (p := _leader(qb, "iso")) is not None and p["iso"] > 0:
            insights.append(f"{p['player_name']} has the most raw power, with an ISO of {fmt_avg(p['iso'])}.")

    if not pitching.empty:
        qp = qualified_or_all(pitching)
        if (p := _leader(qp, "era", ascending=True)) is not None:
            insights.append(f"{p['player_name']} leads qualified pitchers with a {p['era']:.2f} ERA.")
        if (p := _leader(qp, "fip", ascending=True)) is not None and pd.notna(p.get("era")):
            gap = p["era"] - p["fip"]
            if gap >= 0.5:
                insights.append(
                    f"{p['player_name']} has the best FIP ({p['fip']:.2f}), well below a {p['era']:.2f} ERA, "
                    "so better results may be ahead."
                )
            elif gap <= -0.5:
                insights.append(
                    f"{p['player_name']} has the best FIP ({p['fip']:.2f}), but a {p['era']:.2f} ERA "
                    "suggests some good fortune so far."
                )
            else:
                insights.append(f"{p['player_name']} has the best FIP at {p['fip']:.2f}.")
        if (p := _leader(pitching, "strikeouts_pitched")) is not None and p["strikeouts_pitched"] > 0:
            insights.append(f"{p['player_name']} leads in strikeouts with {int(p['strikeouts_pitched'])}.")

    if not teams.empty:
        t = teams.iloc[0]
        if (t["wins"] + t["losses"]) > 0:
            insights.append(
                f"The {t['team']} have the best record at {int(t['wins'])}-{int(t['losses'])}"
                + (f" with a {int(t['run_diff']):+d} run differential." if pd.notna(t["run_diff"]) else ".")
            )
        if (b := _leader(teams, "ops")) is not None:
            insights.append(f"The {b['team']} have the best team offense ({b['ops']:.3f} OPS).")

    return insights


# ---------------------------------------------------------------- trends

TREND_STATS = {"batting_avg", "ops", "hits", "home_runs", "rbi", "era", "whip", "strikeouts_pitched"}


def performance_trend(df: pd.DataFrame, player_id: int, stat: str = "batting_avg") -> List[Dict[str, Any]]:
    """Game-by-game values plus the season-to-date (cumulative) value."""
    if stat not in TREND_STATS:
        raise ValueError(f"Unknown stat '{stat}'. Choose from: {', '.join(sorted(TREND_STATS))}")
    p = df[df["player_id"] == player_id].sort_values(["game_date", "id"] if "id" in df.columns else ["game_date"])
    if stat in ("era", "whip", "strikeouts_pitched"):
        p = p[_pitched(p)]
    else:
        p = p[_plate_appearances(p) > 0]
    if p.empty:
        return []

    c = p[BATTING_COUNTS + PITCHING_COUNTS].cumsum()
    ip, cip = p["outs_pitched"] / 3, c["outs_pitched"] / 3

    def ops(x):
        pa = x["at_bats"] + x["walks"] + x["hit_by_pitch"] + x["sacrifice_flies"]
        singles = x["hits"] - x["doubles"] - x["triples"] - x["home_runs"]
        tb = singles + 2 * x["doubles"] + 3 * x["triples"] + 4 * x["home_runs"]
        return _rate(x["hits"] + x["walks"] + x["hit_by_pitch"], pa, 3) + _rate(tb, x["at_bats"], 3)

    if stat == "batting_avg":
        value, cumulative = _rate(p["hits"], p["at_bats"], 3, None), _rate(c["hits"], c["at_bats"], 3, None)
    elif stat == "ops":
        value, cumulative = ops(p).round(3), ops(c).round(3)
    elif stat == "era":
        value, cumulative = _rate(9 * p["earned_runs"], ip, 2, None), _rate(9 * c["earned_runs"], cip, 2, None)
    elif stat == "whip":
        value = _rate(p["walks_allowed"] + p["hits_allowed"], ip, 2, None)
        cumulative = _rate(c["walks_allowed"] + c["hits_allowed"], cip, 2, None)
    else:
        value, cumulative = p[stat], c[stat]

    out = pd.DataFrame(
        {
            "game_date": p["game_date"],
            "game_id": p["game_id"],
            "opponent": p["opponent"],
            "value": value,
            "cumulative": cumulative,
        }
    )
    return to_records(out)
