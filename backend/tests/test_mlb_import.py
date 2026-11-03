"""MLB import tests use a fake API (no network)."""

from datetime import date

import pytest

from backend.models import GameRecord
from backend.services import mlb_import
from backend.services.records import seed_mlb_games


def player(pid, name, pos, batting=None, pitching=None):
    return {
        "person": {"id": pid, "fullName": name},
        "position": {"abbreviation": pos},
        "stats": {"batting": batting or {}, "pitching": pitching or {}},
    }


def boxscore(away="Cardinals", home="Rangers"):
    return {
        "teams": {
            "away": {
                "team": {"id": 138, "name": f"St. Louis {away}", "teamName": away},
                "players": {
                    "ID1": player(
                        660001,
                        "Lead Off",
                        "CF",
                        batting={
                            "plateAppearances": 4,
                            "atBats": 3,
                            "hits": 1,
                            "doubles": 1,
                            "baseOnBalls": 1,
                            "strikeOuts": 1,
                            "runs": 1,
                        },
                    ),
                    "ID2": player(
                        660002,
                        "Ace Starter",
                        "P",
                        pitching={
                            "outs": 19,
                            "battersFaced": 27,
                            "hits": 6,
                            "earnedRuns": 3,
                            "baseOnBalls": 2,
                            "strikeOuts": 7,
                            "homeRuns": 1,
                            "hitBatsmen": 1,
                        },
                    ),
                    "ID3": player(660003, "Bench Guy", "C"),  # didn't play
                    "ID6": player(660006, "Pinch Runner", "PR", batting={"plateAppearances": 0, "runs": 1}),
                },
            },
            "home": {
                "team": {"id": 140, "name": f"Texas {home}", "teamName": home},
                "players": {
                    "ID4": player(
                        660004,
                        "Slugger",
                        "DH",
                        batting={
                            "plateAppearances": 4,
                            "atBats": 4,
                            "hits": 2,
                            "homeRuns": 1,
                            "rbi": 2,
                            "runs": 1,
                            "sacFlies": 0,
                        },
                    ),
                    "ID5": player(
                        660005, "Opener", "P", pitching={"outs": 0, "battersFaced": 3, "hits": 2, "earnedRuns": 2}
                    ),
                },
            },
        }
    }


def schedule(*games):
    return {
        "dates": [
            {
                "date": d,
                "games": [{"gamePk": pk, "officialDate": d, "gameType": gt, "status": {"codedGameState": code}}],
            }
            for pk, d, gt, code in games
        ]
    }


@pytest.fixture()
def fake_api(monkeypatch):
    calls = []
    sched = schedule(
        (1001, "2025-06-01", "R", "F"),
        (1002, "2025-06-02", "R", "D"),  # postponed
        (1003, "2025-06-03", "S", "F"),  # spring training
        (1004, "2025-06-04", "F", "O"),  # postseason, game over
    )

    def get_json(path, params=None):
        calls.append(path)
        if path == "/schedule":
            return sched
        if path.startswith("/game/"):
            return boxscore()
        raise AssertionError(path)

    monkeypatch.setattr(mlb_import, "get_json", get_json)
    return calls


def test_parse_boxscore():
    rows = mlb_import.parse_boxscore(boxscore(), 777, "2025-06-01")
    by_name = {r["player_name"]: r for r in rows}
    # bench guy skipped; pinch runner kept because he scored
    assert set(by_name) == {"Lead Off", "Ace Starter", "Slugger", "Opener", "Pinch Runner"}
    ace = by_name["Ace Starter"]
    assert ace["innings_pitched"] == 6.1 and ace["home_runs_allowed"] == 1 and ace["hit_batsmen"] == 1
    assert ace["team"] == "Cardinals" and ace["opponent"] == "Rangers" and ace["game_id"] == "MLB-777"
    assert by_name["Lead Off"]["walks"] == 1 and by_name["Lead Off"]["player_id"] == 660001


def test_fetch_rows_skips_unfinished_and_spring_games(fake_api):
    rows, games = mlb_import.fetch_rows(date(2025, 6, 1), date(2025, 6, 30))
    assert games == 2
    assert {r["game_id"] for r in rows} == {"MLB-1001", "MLB-1004"}


def test_fetch_rows_limits(fake_api, monkeypatch):
    with pytest.raises(mlb_import.MLBImportError, match="one year"):
        mlb_import.fetch_rows(date(2024, 1, 1), date(2025, 6, 1))
    monkeypatch.setattr(mlb_import, "MAX_GAMES", 1)
    with pytest.raises(mlb_import.MLBImportError, match="limit is 1"):
        mlb_import.fetch_rows(date(2025, 6, 1), date(2025, 6, 30))


def test_import_route(client, seeded, admin_headers, user_headers, fake_api):
    body = {"start_date": "2025-06-01", "end_date": "2025-06-30"}
    assert client.post("/import/mlb", json=body).status_code == 401
    assert client.post("/import/mlb", json=body, headers=user_headers).status_code == 403

    r = client.post("/import/mlb", json=body, headers=admin_headers)
    assert r.status_code == 200, r.text
    assert r.json()["games"] == 2 and r.json()["rows_loaded"] == 10
    total = client.get("/records?page_size=1").json()["total"]
    assert total == 250

    # Re-importing the same games updates them instead of duplicating
    client.post("/import/mlb", json=body, headers=admin_headers)
    assert client.get("/records?page_size=1").json()["total"] == 250

    pitching = {p["player_name"]: p for p in client.get("/stats/pitching").json()}
    assert pitching["Opener"]["era"] is None  # 0 outs recorded
    assert pitching["Ace Starter"]["innings_pitched"] == 12.2  # 2 x 6.1


def test_import_replace_mode(client, seeded, admin_headers, fake_api):
    body = {"start_date": "2025-06-01", "end_date": "2025-06-30", "mode": "replace"}
    assert client.post("/import/mlb", json=body, headers=admin_headers).status_code == 200
    assert client.get("/meta").json()["teams"] == ["Cardinals", "Rangers"]


def test_import_reports_api_outage(client, admin_headers, monkeypatch):
    def down(path, params=None):
        raise mlb_import.MLBUnavailable("Couldn't reach the MLB Stats API")

    monkeypatch.setattr(mlb_import, "get_json", down)
    r = client.post("/import/mlb", json={"start_date": "2025-06-01", "end_date": "2025-06-02"}, headers=admin_headers)
    assert r.status_code == 502


def test_seed_mlb_games_fills_empty_database(db, fake_api):
    assert seed_mlb_games(db, date(2025, 6, 1), date(2025, 6, 30)) == 10
    assert {r.game_id for r in db.query(GameRecord)} == {"MLB-1001", "MLB-1004"}


def test_seed_mlb_games_keeps_existing_data(seeded, fake_api):
    before = seeded.query(GameRecord).count()
    assert seed_mlb_games(seeded, date(2025, 6, 1), date(2025, 6, 30)) == 0
    assert seeded.query(GameRecord).count() == before
    assert fake_api == []  # didn't call MLB at all


def test_seed_mlb_games_survives_an_outage(db, monkeypatch):
    def down(path, params=None):
        raise mlb_import.MLBUnavailable("Couldn't reach the MLB Stats API")

    monkeypatch.setattr(mlb_import, "get_json", down)
    assert seed_mlb_games(db, date(2025, 6, 1), date(2025, 6, 30)) == 0
    assert db.query(GameRecord).count() == 0
