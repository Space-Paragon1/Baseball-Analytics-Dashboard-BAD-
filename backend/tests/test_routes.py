"""Read-only endpoints against the sample data."""

import pytest


def test_health(client):
    assert client.get("/health").json()["status"] == "ok"


def test_meta(client, seeded):
    meta = client.get("/meta").json()
    assert meta["teams"] == ["Eagles", "Tigers", "Wolves"]
    assert meta["total_records"] == 240
    assert len(meta["players"]) == 15
    assert meta["date_range"] == {"min": "2025-03-15", "max": "2025-06-14"}


def test_empty_database_is_handled(client):
    assert client.get("/stats/batting").json() == []
    assert client.get("/stats/dashboard").json()["total_games"] == 0
    assert client.get("/teams").json() == []
    assert client.get("/meta").json()["players"] == []


def test_dashboard(client, seeded):
    d = client.get("/stats/dashboard").json()
    assert d["total_games"] == 24
    assert d["top_performer"]["player_id"]
    assert d["top_pitcher"]["era"] is not None
    assert len(d["top5_batters"]) == 5
    assert len(d["teams"]) == 3 and "wins" in d["teams"][0]


def test_batting_leaderboard_sorted_and_filterable(client, seeded):
    rows = client.get("/stats/batting").json()
    avgs = [r["batting_avg"] for r in rows]
    assert avgs == sorted(avgs, reverse=True)
    assert {"woba", "iso", "babip", "k_pct", "qualified"} <= rows[0].keys()
    eagles = client.get("/stats/batting?team=eagles").json()
    assert eagles and all(r["team"] == "Eagles" for r in eagles)


def test_pitching_leaderboard(client, seeded):
    rows = client.get("/stats/pitching").json()
    eras = [r["era"] for r in rows]
    assert eras == sorted(eras)
    assert {"fip", "k_bb", "hr_per_9", "innings_pitched"} <= rows[0].keys()


def test_date_filter_narrows_results(client, seeded):
    all_games = client.get("/stats/dashboard").json()["total_games"]
    april = client.get("/stats/dashboard?start_date=2025-04-01&end_date=2025-04-30").json()["total_games"]
    assert 0 < april < all_games


@pytest.mark.parametrize("query", ["start_date=not-a-date", "start_date=2025-05-01&end_date=2025-04-01"])
def test_bad_dates_are_rejected(client, seeded, query):
    assert client.get(f"/stats/batting?{query}").status_code == 422


def test_insights_follow_date_filter(client, seeded):
    all_time = client.get("/stats/insights").json()
    one_game = client.get("/stats/insights?start_date=2025-03-15&end_date=2025-03-15").json()
    assert all_time and one_game and all_time != one_game


def test_teams(client, seeded):
    teams = client.get("/teams").json()
    total_w = sum(t["wins"] for t in teams)
    total_l = sum(t["losses"] for t in teams)
    assert total_w == total_l  # every win is someone's loss
    detail = client.get("/teams/eagles").json()
    assert detail["team"] == "Eagles"
    assert len(detail["roster_batting"]) == 4 and len(detail["roster_pitching"]) == 1
    games = client.get("/teams/Eagles/games").json()
    assert {g["result"] for g in games} <= {"W", "L", "T"}
    assert client.get("/teams/Nobody").status_code == 404


def test_player_detail_trend_and_compare(client, seeded):
    p = client.get("/players/1").json()
    assert p["player_name"] == "Marcus Rivera" and p["batting"] and p["pitching"] is None
    assert len(p["game_logs"]) == 18
    trend = client.get("/players/1/trend?stat=ops").json()
    assert len(trend) == 18 and "cumulative" in trend[0]
    assert client.get("/players/1/trend?stat=bogus").status_code == 400
    assert client.get("/players/999").status_code == 404

    cmp = client.get("/players/compare?ids=1&ids=3").json()
    assert cmp[0]["batting"] and cmp[1]["pitching"]
    assert client.get("/players/compare?ids=1").status_code == 400
    assert client.get("/players/compare?ids=1&ids=1").status_code == 400
    assert client.get("/players/compare?ids=1&ids=999").status_code == 404


def test_exports(client, seeded):
    csv = client.get("/export/batting-csv?qualified_only=true")
    assert csv.status_code == 200 and csv.headers["content-type"].startswith("text/csv")
    assert "woba" in csv.text.splitlines()[0]
    assert client.get("/export/pitching-csv").status_code == 200
    pdf = client.get("/export/player-pdf/3")
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    assert client.get("/export/player-pdf/999").status_code == 404


def test_csv_export_neutralizes_formulas(client, admin_headers):
    record = {
        "player_name": "=HYPERLINK(1)",
        "team": "Eagles",
        "position": "CF",
        "game_date": "2025-05-01",
        "game_id": "G1",
        "opponent": "Tigers",
        "at_bats": 4,
        "hits": 1,
    }
    assert client.post("/records", json=record, headers=admin_headers).status_code == 201
    text = client.get("/export/batting-csv").text
    assert "'=HYPERLINK(1)" in text


def test_pdf_handles_markup_in_names(client, admin_headers):
    record = {
        "player_name": "<b>Bold</b> & Co",
        "team": "Eagles",
        "position": "CF",
        "game_date": "2025-05-01",
        "game_id": "G1",
        "opponent": "Tigers",
        "at_bats": 4,
        "hits": 1,
    }
    pid = client.post("/records", json=record, headers=admin_headers).json()["player_id"]
    r = client.get(f"/export/player-pdf/{pid}")
    assert r.status_code == 200
    assert 'filename="b_Bold_b_Co_player_card.pdf"' in r.headers["content-disposition"]
