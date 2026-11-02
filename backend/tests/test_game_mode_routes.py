START = {"home_team": "Eagles", "away_team": "Tigers", "game_date": "2025-07-01"}


def start(client, headers):
    r = client.post("/game-mode/start", json=START, headers=headers)
    assert r.status_code == 201, r.text
    gid = r.json()["id"]
    client.post(f"/game-mode/{gid}/pitcher", json={"side": "home", "name": "Derek Simmons"}, headers=headers)
    client.post(f"/game-mode/{gid}/pitcher", json={"side": "away", "name": "Sam Patel"}, headers=headers)
    return gid


def pa(client, headers, gid, batter, result):
    return client.post(f"/game-mode/{gid}/plate-appearance", json={"batter": batter, "result": result}, headers=headers)


def test_game_mode_requires_sign_in(client):
    assert client.post("/game-mode/start", json=START).status_code == 401


def test_start_validates_teams(client, user_headers):
    bad = {**START, "away_team": "eagles"}
    assert client.post("/game-mode/start", json=bad, headers=user_headers).status_code == 422


def test_full_flow_scores_and_persists(client, user_headers):
    gid = start(client, user_headers)
    pa(client, user_headers, gid, "Luis Ortega", "double")
    r = pa(client, user_headers, gid, "Mike Torres", "home_run")
    state = r.json()
    assert state["score"] == {"away": 2, "home": 0}
    assert state["bases"] == [None, None, None]
    assert state["plays"][0]["text"].startswith("Mike Torres homered")

    # State lives in the database, not in memory
    again = client.get(f"/game-mode/{gid}").json()
    assert again["score"] == state["score"]
    sessions = client.get("/game-mode/sessions", headers=user_headers).json()
    assert [s["id"] for s in sessions] == [gid]


def test_invalid_play_returns_400_and_changes_nothing(client, user_headers):
    gid = start(client, user_headers)
    r = pa(client, user_headers, gid, "Luis Ortega", "sac_fly")
    assert r.status_code == 400
    assert client.get(f"/game-mode/{gid}").json()["outs"] == 0


def test_undo(client, user_headers):
    gid = start(client, user_headers)
    pa(client, user_headers, gid, "Luis Ortega", "home_run")
    r = client.post(f"/game-mode/{gid}/undo", headers=user_headers)
    assert r.json()["score"]["away"] == 0


def test_save_merges_into_existing_players(client, seeded, user_headers):
    """Saved games must not create duplicate leaderboard rows (the old 'IF' bug)."""
    gid = start(client, user_headers)
    for _ in range(3):
        pa(client, user_headers, gid, "Luis Ortega", "out")
    pa(client, user_headers, gid, "Marcus Rivera", "single")

    r = client.post(f"/game-mode/{gid}/save", headers=user_headers)
    assert r.status_code == 200, r.text
    assert r.json()["records_saved"] == 4  # 2 batters + 2 pitchers

    batting = client.get("/stats/batting").json()
    rivera = [b for b in batting if b["player_name"] == "Marcus Rivera"]
    assert len(rivera) == 1
    assert rivera[0]["position"] == "CF" and rivera[0]["player_id"] == 1

    records = client.get(f"/records?game_id={gid}").json()["items"]
    simmons = next(rec for rec in records if rec["player_name"] == "Derek Simmons")
    assert simmons["player_id"] == 3 and simmons["position"] == "SP" and simmons["innings_pitched"] == 1.0

    assert client.post(f"/game-mode/{gid}/save", headers=user_headers).status_code == 400
    assert pa(client, user_headers, gid, "Late", "single").status_code == 400
    assert client.get("/game-mode/sessions", headers=user_headers).json() == []


def test_cannot_save_empty_game(client, user_headers):
    gid = start(client, user_headers)
    assert client.post(f"/game-mode/{gid}/save", headers=user_headers).status_code == 400


def test_discard(client, user_headers):
    gid = start(client, user_headers)
    assert client.delete(f"/game-mode/{gid}", headers=user_headers).status_code == 204
    assert client.get(f"/game-mode/{gid}").status_code == 404
