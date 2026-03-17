import io
import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_health_returns_200():
    """GET /health should return 200 with status ok."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


def test_get_players_returns_list():
    """GET /players should return a list."""
    response = client.get("/players")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_get_batting_stats_returns_sorted_list():
    """GET /stats/batting should return a list sorted by batting_avg descending."""
    response = client.get("/stats/batting")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if len(data) > 1:
        for i in range(len(data) - 1):
            assert data[i]["batting_avg"] >= data[i + 1]["batting_avg"]


def test_get_pitching_stats_returns_sorted_list():
    """GET /stats/pitching should return a list sorted by ERA ascending."""
    response = client.get("/stats/pitching")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if len(data) > 1:
        for i in range(len(data) - 1):
            assert data[i]["era"] <= data[i + 1]["era"]


def test_get_dashboard_returns_required_keys():
    """GET /stats/dashboard should include all required keys."""
    response = client.get("/stats/dashboard")
    assert response.status_code == 200
    data = response.json()
    required_keys = [
        "total_games", "total_runs", "league_batting_avg",
        "top_performer", "top_pitcher", "teams", "recent_trend", "top5_batters"
    ]
    for key in required_keys:
        assert key in data, f"Missing key: {key}"


def test_get_insights_returns_list_of_strings():
    """GET /stats/insights should return a list of strings."""
    response = client.get("/stats/insights")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    for item in data:
        assert isinstance(item, str)


def test_get_teams_returns_list():
    """GET /teams should return a list."""
    response = client.get("/teams")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_upload_csv_with_valid_csv():
    """POST /upload-csv with valid CSV should succeed."""
    csv_content = (
        "player_id,player_name,team,position,game_date,at_bats,hits,doubles,triples,"
        "home_runs,runs,rbi,strikeouts,walks,hit_by_pitch,innings_pitched,"
        "earned_runs,hits_allowed,walks_allowed,strikeouts_pitched,game_id,opponent\n"
        "1,Test Player,Eagles,OF,2025-05-01,4,2,0,0,1,2,2,1,0,0,0.0,0,0,0,0,G999,Tigers\n"
    )
    file_bytes = csv_content.encode("utf-8")
    response = client.post(
        "/upload-csv",
        files={"file": ("test.csv", io.BytesIO(file_bytes), "text/csv")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["rows_loaded"] >= 1


def test_upload_csv_with_missing_columns_returns_400():
    """POST /upload-csv with missing required columns should return 400."""
    csv_content = "player_id,player_name\n1,Bad Player\n"
    file_bytes = csv_content.encode("utf-8")
    response = client.post(
        "/upload-csv",
        files={"file": ("bad.csv", io.BytesIO(file_bytes), "text/csv")},
    )
    assert response.status_code == 400
    data = response.json()
    assert "missing" in data["detail"].lower() or "required" in data["detail"].lower()


def test_dashboard_date_filter():
    """GET /stats/dashboard with date params should return 200."""
    response = client.get("/stats/dashboard?start_date=2025-01-01&end_date=2025-12-31")
    assert response.status_code == 200


def test_batting_stats_date_filter():
    """GET /stats/batting with date params should return 200."""
    response = client.get("/stats/batting?start_date=2025-01-01&end_date=2025-12-31")
    assert response.status_code == 200


def test_pitching_stats_date_filter():
    """GET /stats/pitching with date params should return 200."""
    response = client.get("/stats/pitching?start_date=2025-01-01&end_date=2025-12-31")
    assert response.status_code == 200
