import pytest
import pandas as pd
from backend.services.analytics import AnalyticsService

analytics = AnalyticsService()


def make_sample_df():
    """Create a sample DataFrame for testing."""
    return pd.DataFrame([
        {
            "player_id": 1, "player_name": "John Doe", "team": "Eagles", "position": "OF",
            "game_date": "2025-04-01", "at_bats": 4, "hits": 2, "doubles": 1, "triples": 0,
            "home_runs": 1, "runs": 2, "rbi": 3, "strikeouts": 1, "walks": 1, "hit_by_pitch": 0,
            "innings_pitched": 0.0, "earned_runs": 0, "hits_allowed": 0,
            "walks_allowed": 0, "strikeouts_pitched": 0, "game_id": "G001", "opponent": "Tigers",
        },
        {
            "player_id": 2, "player_name": "Jane Smith", "team": "Tigers", "position": "P",
            "game_date": "2025-04-01", "at_bats": 3, "hits": 1, "doubles": 0, "triples": 0,
            "home_runs": 0, "runs": 0, "rbi": 0, "strikeouts": 1, "walks": 0, "hit_by_pitch": 0,
            "innings_pitched": 7.0, "earned_runs": 2, "hits_allowed": 5,
            "walks_allowed": 2, "strikeouts_pitched": 8, "game_id": "G001", "opponent": "Eagles",
        },
        {
            "player_id": 1, "player_name": "John Doe", "team": "Eagles", "position": "OF",
            "game_date": "2025-04-03", "at_bats": 5, "hits": 1, "doubles": 0, "triples": 1,
            "home_runs": 0, "runs": 1, "rbi": 1, "strikeouts": 2, "walks": 0, "hit_by_pitch": 1,
            "innings_pitched": 0.0, "earned_runs": 0, "hits_allowed": 0,
            "walks_allowed": 0, "strikeouts_pitched": 0, "game_id": "G002", "opponent": "Wolves",
        },
        {
            "player_id": 3, "player_name": "Bob Pitcher", "team": "Wolves", "position": "P",
            "game_date": "2025-04-03", "at_bats": 0, "hits": 0, "doubles": 0, "triples": 0,
            "home_runs": 0, "runs": 0, "rbi": 0, "strikeouts": 0, "walks": 0, "hit_by_pitch": 0,
            "innings_pitched": 9.0, "earned_runs": 1, "hits_allowed": 3,
            "walks_allowed": 1, "strikeouts_pitched": 12, "game_id": "G002", "opponent": "Eagles",
        },
    ])


def make_zero_df():
    """Create a DataFrame with zero at_bats for division-by-zero testing."""
    return pd.DataFrame([
        {
            "player_id": 1, "player_name": "Zero Batter", "team": "Eagles", "position": "P",
            "game_date": "2025-04-01", "at_bats": 0, "hits": 0, "doubles": 0, "triples": 0,
            "home_runs": 0, "runs": 0, "rbi": 0, "strikeouts": 0, "walks": 0, "hit_by_pitch": 0,
            "innings_pitched": 0.0, "earned_runs": 0, "hits_allowed": 0,
            "walks_allowed": 0, "strikeouts_pitched": 0, "game_id": "G001", "opponent": "Tigers",
        },
    ])


# ---- Batting Average Tests ----

def test_batting_average_calculation():
    """John Doe: 3 hits / 9 at_bats = 0.333."""
    df = make_sample_df()
    result = analytics.calculate_batting_stats(df)
    john = result[result["player_name"] == "John Doe"].iloc[0]
    assert john["batting_avg"] == pytest.approx(3 / 9, abs=0.001)


def test_batting_average_zero_at_bats():
    """Player with 0 at_bats should have batting_avg = 0.0, not raise error."""
    df = make_zero_df()
    result = analytics.calculate_batting_stats(df)
    assert result.empty  # no batters (at_bats == 0 filtered out)


# ---- OBP Tests ----

def test_obp_calculation():
    """OBP = (H + BB + HBP) / (AB + BB + HBP)."""
    df = make_sample_df()
    result = analytics.calculate_batting_stats(df)
    john = result[result["player_name"] == "John Doe"].iloc[0]
    # hits=3, walks=1, hbp=1, ab=9
    expected_obp = (3 + 1 + 1) / (9 + 1 + 1)
    assert john["obp"] == pytest.approx(expected_obp, abs=0.001)


# ---- SLG Tests ----

def test_slg_calculation():
    """SLG = (1B + 2*2B + 3*3B + 4*HR) / AB."""
    df = make_sample_df()
    result = analytics.calculate_batting_stats(df)
    john = result[result["player_name"] == "John Doe"].iloc[0]
    # doubles=1, triples=1, home_runs=1, hits=3, ab=9
    singles = 3 - 1 - 1 - 1  # 0
    total_bases = singles + 2 * 1 + 3 * 1 + 4 * 1  # 0 + 2 + 3 + 4 = 9
    expected_slg = 9 / 9
    assert john["slg"] == pytest.approx(expected_slg, abs=0.001)


# ---- OPS Tests ----

def test_ops_equals_obp_plus_slg():
    """OPS must equal OBP + SLG."""
    df = make_sample_df()
    result = analytics.calculate_batting_stats(df)
    for _, row in result.iterrows():
        assert row["ops"] == pytest.approx(row["obp"] + row["slg"], abs=0.001)


# ---- ERA Tests ----

def test_era_calculation():
    """ERA = (earned_runs * 9) / innings_pitched."""
    df = make_sample_df()
    result = analytics.calculate_pitching_stats(df)
    jane = result[result["player_name"] == "Jane Smith"].iloc[0]
    expected_era = (2 * 9) / 7.0
    assert jane["era"] == pytest.approx(expected_era, abs=0.01)


def test_era_zero_innings_pitched():
    """ERA should be 0.0 when innings_pitched = 0 (no pitchers in data)."""
    df = make_zero_df()
    result = analytics.calculate_pitching_stats(df)
    assert result.empty  # innings_pitched == 0 filtered out


# ---- WHIP Tests ----

def test_whip_calculation():
    """WHIP = (walks_allowed + hits_allowed) / innings_pitched."""
    df = make_sample_df()
    result = analytics.calculate_pitching_stats(df)
    bob = result[result["player_name"] == "Bob Pitcher"].iloc[0]
    expected_whip = (1 + 3) / 9.0
    assert bob["whip"] == pytest.approx(expected_whip, abs=0.01)


# ---- Insights Tests ----

def test_generate_insights_returns_list_of_strings():
    """generate_insights should return a non-empty list of strings."""
    df = make_sample_df()
    batting_df = analytics.calculate_batting_stats(df)
    pitching_df = analytics.calculate_pitching_stats(df)
    team_df = analytics.calculate_team_stats(df)
    insights = analytics.generate_insights(batting_df, pitching_df, team_df)
    assert isinstance(insights, list)
    assert len(insights) > 0
    for item in insights:
        assert isinstance(item, str)


# ---- Team Stats Tests ----

def test_calculate_team_stats_returns_correct_teams():
    """Team stats should include all teams present in data."""
    df = make_sample_df()
    result = analytics.calculate_team_stats(df)
    teams = set(result["team"].tolist())
    assert "Eagles" in teams
    assert "Tigers" in teams


def test_calculate_team_stats_batting_avg():
    """Team batting average should be total_hits / total_at_bats."""
    df = make_sample_df()
    result = analytics.calculate_team_stats(df)
    eagles = result[result["team"] == "Eagles"].iloc[0]
    # John Doe: 3 hits, 9 ab
    assert eagles["batting_avg"] == pytest.approx(3 / 9, abs=0.001)


# ---- Empty DataFrame Tests ----

def test_empty_dataframe_batting():
    """calculate_batting_stats should return empty DataFrame when input is empty."""
    result = analytics.calculate_batting_stats(pd.DataFrame())
    assert result.empty


def test_empty_dataframe_pitching():
    """calculate_pitching_stats should return empty DataFrame when input is empty."""
    result = analytics.calculate_pitching_stats(pd.DataFrame())
    assert result.empty


def test_empty_dataframe_insights():
    """generate_insights should return empty list when all DataFrames are empty."""
    result = analytics.generate_insights(pd.DataFrame(), pd.DataFrame(), pd.DataFrame())
    assert result == []
