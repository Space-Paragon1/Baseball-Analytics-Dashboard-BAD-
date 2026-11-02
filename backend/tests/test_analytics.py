import pandas as pd
import pytest

from backend.services import analytics
from backend.services.innings import innings_to_outs, outs_to_innings
from backend.tests.factories import frame, row


def sample():
    return frame(
        [
            row(
                1,
                "John Doe",
                "Eagles",
                "G001",
                "2025-04-01",
                at_bats=4,
                hits=2,
                doubles=1,
                home_runs=1,
                runs=2,
                rbi=3,
                strikeouts=1,
                walks=1,
            ),
            row(
                2,
                "Jane Smith",
                "Tigers",
                "G001",
                "2025-04-01",
                position="P",
                ip="7.0",
                earned_runs=2,
                hits_allowed=5,
                walks_allowed=2,
                strikeouts_pitched=8,
                home_runs_allowed=1,
                opponent="Eagles",
            ),
            row(
                1,
                "John Doe",
                "Eagles",
                "G002",
                "2025-04-03",
                at_bats=5,
                hits=1,
                triples=1,
                runs=1,
                rbi=1,
                strikeouts=2,
                hit_by_pitch=1,
                sacrifice_flies=1,
                opponent="Wolves",
            ),
            row(
                3,
                "Bob Pitcher",
                "Wolves",
                "G002",
                "2025-04-03",
                position="P",
                ip="9.0",
                earned_runs=1,
                hits_allowed=3,
                walks_allowed=1,
                strikeouts_pitched=12,
                opponent="Eagles",
            ),
        ]
    )


# ---------------------------------------------------------------- innings


@pytest.mark.parametrize("ip,outs", [(0, 0), ("6.0", 18), (6.1, 19), ("6.2", 20), (6.333, 19), (6.67, 20), ("", 0)])
def test_innings_to_outs(ip, outs):
    assert innings_to_outs(ip) == outs


@pytest.mark.parametrize("bad", ["6.5", "abc", -1, "6.3"])
def test_innings_rejects_invalid(bad):
    with pytest.raises(ValueError):
        innings_to_outs(bad)


def test_outs_to_innings_round_trip():
    assert outs_to_innings(20) == 6.2
    assert outs_to_innings(33) == 11.0


# ---------------------------------------------------------------- batting


def test_batting_rate_stats():
    john = analytics.calculate_batting_stats(sample()).set_index("player_id").loc[1]
    # 3 H in 9 AB; 1 BB, 1 HBP, 1 SF -> 12 PA
    assert john["plate_appearances"] == 12
    assert john["batting_avg"] == pytest.approx(3 / 9, abs=0.001)
    assert john["obp"] == pytest.approx((3 + 1 + 1) / 12, abs=0.001)  # SF counts in the denominator
    assert john["slg"] == pytest.approx((2 + 3 + 4) / 9, abs=0.001)
    assert john["ops"] == pytest.approx(john["obp"] + john["slg"], abs=0.001)
    assert john["iso"] == pytest.approx(john["slg"] - john["batting_avg"], abs=0.001)
    # BABIP = (H - HR) / (AB - K - HR + SF) = 2 / (9 - 3 - 1 + 1)
    assert john["babip"] == pytest.approx(2 / 6, abs=0.001)
    assert john["k_pct"] == pytest.approx(3 / 12, abs=0.001)
    w = analytics.WOBA_WEIGHTS
    woba = (w["bb"] + w["hbp"] + w["double"] + w["triple"] + w["hr"]) / 12
    assert john["woba"] == pytest.approx(woba, abs=0.001)


def test_batting_groups_by_player_id_not_position():
    """A player logged at a different position must not show up twice."""
    df = frame(
        [
            row(1, "Marcus Rivera", "Eagles", "G1", "2025-04-01", position="CF", at_bats=4, hits=1),
            row(1, "Marcus Rivera", "Eagles", "G2", "2025-04-02", position="CF", at_bats=4, hits=2),
            row(1, "Marcus Rivera", "Eagles", "G3", "2025-04-03", position="IF", at_bats=1, hits=1),
        ]
    )
    result = analytics.calculate_batting_stats(df)
    assert len(result) == 1
    assert result.iloc[0]["position"] == "CF"  # most-played position
    assert result.iloc[0]["at_bats"] == 9


def test_player_shows_latest_team_after_trade():
    df = frame(
        [
            row(1, "Traded Guy", "Eagles", "G1", "2025-04-01", at_bats=4, hits=1),
            row(1, "Traded Guy", "Tigers", "G2", "2025-05-01", at_bats=4, hits=1, opponent="Eagles"),
        ]
    )
    assert analytics.calculate_batting_stats(df).iloc[0]["team"] == "Tigers"


def test_walk_only_games_count_toward_obp():
    df = frame(
        [
            row(1, "Patient", "Eagles", "G1", "2025-04-01", at_bats=4, hits=1),
            row(1, "Patient", "Eagles", "G2", "2025-04-02", walks=2),  # 0 AB but 2 PA
        ]
    )
    p = analytics.calculate_batting_stats(df).iloc[0]
    assert p["games_played"] == 2
    assert p["obp"] == pytest.approx(3 / 6, abs=0.001)


def test_small_samples_are_not_qualified():
    rows = [row(1, "Regular", "Eagles", f"G{i}", f"2025-04-{i:02d}", at_bats=4, hits=1) for i in range(1, 11)]
    rows.append(row(2, "Cameo", "Eagles", "G10", "2025-04-10", at_bats=1, hits=1))
    result = analytics.calculate_batting_stats(frame(rows)).set_index("player_name")
    assert result.loc["Cameo", "batting_avg"] == 1.0
    assert not result.loc["Cameo", "qualified"]
    assert result.loc["Regular", "qualified"]
    assert analytics.qualified_or_all(result.reset_index())["player_name"].tolist() == ["Regular"]


def test_qualification_has_a_minimum_for_tiny_samples():
    # Two team games: 3.1 PA/game would be 6.2 PA, but the floor is 20.
    rows = [row(1, "Hot Week", "Eagles", f"G{i}", f"2025-04-0{i}", at_bats=4, hits=3) for i in (1, 2)]
    rows.append(row(2, "Spot Start", "Eagles", "G1", "2025-04-01", position="P", ip="6.0"))
    df = frame(rows)
    assert not analytics.calculate_batting_stats(df).iloc[0]["qualified"]
    assert not analytics.calculate_pitching_stats(df).iloc[0]["qualified"]


def test_zero_at_bats_has_no_batting_line():
    df = frame([row(1, "Bench", "Eagles", "G1", "2025-04-01")])
    assert analytics.calculate_batting_stats(df).empty


# ---------------------------------------------------------------- pitching


def test_pitching_rate_stats():
    jane = analytics.calculate_pitching_stats(sample()).set_index("player_id").loc[2]
    assert jane["era"] == pytest.approx(2 * 9 / 7, abs=0.01)
    assert jane["whip"] == pytest.approx(7 / 7, abs=0.01)
    assert jane["k_per_9"] == pytest.approx(8 * 9 / 7, abs=0.01)
    assert jane["k_bb"] == pytest.approx(4.0, abs=0.01)


def test_innings_add_up_in_thirds():
    df = frame(
        [
            row(1, "Starter", "Eagles", "G1", "2025-04-01", position="P", ip="5.1", earned_runs=1),
            row(1, "Starter", "Eagles", "G2", "2025-04-06", position="P", ip="5.2", earned_runs=1),
        ]
    )
    p = analytics.calculate_pitching_stats(df).iloc[0]
    assert p["innings_pitched"] == 11.0  # not 10.3
    assert p["era"] == pytest.approx(2 * 9 / 11, abs=0.01)


def test_pitcher_with_no_outs_has_null_era():
    df = frame([row(1, "Rough Day", "Eagles", "G1", "2025-04-01", position="P", earned_runs=3, hits_allowed=3)])
    p = analytics.calculate_pitching_stats(df).iloc[0]
    assert pd.isna(p["era"])
    assert analytics.to_records(analytics.calculate_pitching_stats(df))[0]["era"] is None


def test_fip_is_calibrated_to_league_era():
    df = sample()
    pitching = analytics.calculate_pitching_stats(df)
    ip = pitching["outs_pitched"] / 3
    league_era = 9 * pitching["earned_runs"].sum() / ip.sum()
    weighted_fip = (pitching["fip"] * ip).sum() / ip.sum()
    assert weighted_fip == pytest.approx(league_era, abs=0.02)


def test_pitching_sorted_by_era():
    eras = analytics.calculate_pitching_stats(sample())["era"].tolist()
    assert eras == sorted(eras)


# ---------------------------------------------------------------- teams


def test_team_standings_and_run_differential():
    df = frame(
        [
            row(1, "A", "Eagles", "G1", "2025-04-01", at_bats=4, hits=2, runs=5, opponent="Tigers"),
            row(2, "B", "Tigers", "G1", "2025-04-01", at_bats=4, hits=1, runs=2, opponent="Eagles"),
            row(1, "A", "Eagles", "G2", "2025-04-02", at_bats=4, hits=1, runs=1, opponent="Tigers"),
            row(2, "B", "Tigers", "G2", "2025-04-02", at_bats=4, hits=1, runs=1, opponent="Eagles"),
        ]
    )
    teams = analytics.calculate_team_stats(df).set_index("team")
    assert (teams.loc["Eagles", "wins"], teams.loc["Eagles", "losses"], teams.loc["Eagles", "ties"]) == (1, 0, 1)
    assert teams.loc["Eagles", "run_diff"] == 3
    assert teams.loc["Tigers", "runs_allowed"] == 6
    assert analytics.calculate_team_stats(df).iloc[0]["team"] == "Eagles"


def test_results_unknown_when_opponent_missing():
    df = frame([row(1, "A", "Eagles", "G1", "2025-04-01", at_bats=4, runs=3, opponent="Ghosts")])
    results = analytics.game_results(df)
    assert results.iloc[0]["result"] is None


def test_team_batting_average():
    teams = analytics.calculate_team_stats(sample()).set_index("team")
    assert teams.loc["Eagles", "batting_avg"] == pytest.approx(3 / 9, abs=0.001)


# ---------------------------------------------------------------- insights & trends


def test_insights_are_strings():
    df = sample()
    insights = analytics.generate_insights(
        analytics.calculate_batting_stats(df),
        analytics.calculate_pitching_stats(df),
        analytics.calculate_team_stats(df),
    )
    assert insights and all(isinstance(i, str) for i in insights)


def test_empty_inputs():
    empty = pd.DataFrame()
    assert analytics.calculate_batting_stats(empty).empty
    assert analytics.calculate_pitching_stats(empty).empty
    assert analytics.calculate_team_stats(empty).empty
    assert analytics.generate_insights(empty, empty, empty) == []
    assert analytics.league_summary(empty)["total_games"] == 0


def test_trend_has_cumulative_average():
    trend = analytics.performance_trend(sample(), 1, "batting_avg")
    assert [t["value"] for t in trend] == [0.5, 0.2]
    assert trend[-1]["cumulative"] == pytest.approx(3 / 9, abs=0.001)


def test_trend_rejects_unknown_stat():
    with pytest.raises(ValueError):
        analytics.performance_trend(sample(), 1, "not_a_stat")
