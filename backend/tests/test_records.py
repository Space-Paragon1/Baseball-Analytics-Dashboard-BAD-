import io

import pytest

from backend.config import SAMPLE_DATA_PATH

RECORD = {
    "player_name": "New Guy",
    "team": "Eagles",
    "position": "ss",
    "game_date": "2025-07-01",
    "game_id": "G100",
    "opponent": "Tigers",
    "at_bats": 4,
    "hits": 2,
    "doubles": 1,
    "runs": 1,
    "rbi": 2,
}

HEADER = "player_name,team,position,game_date,game_id,opponent,at_bats,hits,innings_pitched\n"


def upload(client, headers, text, mode="replace", filename="data.csv"):
    return client.post(
        "/upload-csv",
        files={"file": (filename, io.BytesIO(text.encode("utf-8")), "text/csv")},
        data={"mode": mode},
        headers=headers,
    )


def count(client):
    return client.get("/records?page_size=1").json()["total"]


# ---------------------------------------------------------------- permissions


def test_writes_require_sign_in(client, seeded):
    assert client.post("/records", json=RECORD).status_code == 401
    assert client.put("/records/1", json=RECORD).status_code == 401
    assert client.delete("/records/1").status_code == 401
    assert upload(client, {}, HEADER + "A,Eagles,CF,2025-01-01,G1,Tigers,4,1,0\n").status_code == 401


def test_destructive_actions_require_admin(client, seeded, user_headers):
    assert client.delete("/records/1", headers=user_headers).status_code == 403
    assert upload(client, user_headers, HEADER + "A,Eagles,CF,2025-01-01,G1,Tigers,4,1,0\n").status_code == 403
    assert count(client) == 240


# ---------------------------------------------------------------- CRUD


def test_list_search_and_paginate(client, seeded):
    page = client.get("/records?page=2&page_size=10").json()
    assert page["total"] == 240 and len(page["items"]) == 10 and page["page"] == 2
    found = client.get("/records?search=rivera").json()
    assert found["total"] == 18
    assert all(r["player_name"] == "Marcus Rivera" for r in found["items"])
    assert client.get("/records?team=Wolves").json()["total"] == 75


def test_create_record_assigns_ids_and_normalizes(client, seeded, user_headers):
    r = client.post("/records", json=RECORD, headers=user_headers)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["position"] == "SS"
    assert body["player_id"] == 16  # next id after the 15 sample players

    existing = {**RECORD, "player_name": "marcus rivera", "game_id": "G101"}
    assert client.post("/records", json=existing, headers=user_headers).json()["player_id"] == 1


def test_duplicate_player_in_same_game_is_rejected(client, seeded, user_headers):
    assert client.post("/records", json=RECORD, headers=user_headers).status_code == 201
    assert client.post("/records", json=RECORD, headers=user_headers).status_code == 409


@pytest.mark.parametrize(
    "bad",
    [
        {"hits": 5},  # more hits than at-bats
        {"home_runs": 3},  # extra-base hits exceed hits
        {"opponent": "eagles"},  # playing yourself
        {"innings_pitched": 6.5},
        {"game_date": "07/01/2025"},
        {"at_bats": -1},
    ],
)
def test_create_record_validation(client, user_headers, bad):
    r = client.post("/records", json={**RECORD, **bad}, headers=user_headers)
    assert r.status_code == 422


def test_update_and_delete(client, seeded, admin_headers):
    rec = client.get("/records?search=rivera&page_size=1").json()["items"][0]
    changed = {**rec, "hits": 0, "doubles": 0, "triples": 0, "home_runs": 0}
    r = client.put(f"/records/{rec['id']}", json=changed, headers=admin_headers)
    assert r.status_code == 200 and r.json()["hits"] == 0
    assert r.json()["player_id"] == rec["player_id"]

    assert client.delete(f"/records/{rec['id']}", headers=admin_headers).status_code == 204
    assert client.delete(f"/records/{rec['id']}", headers=admin_headers).status_code == 404
    assert count(client) == 239


# ---------------------------------------------------------------- CSV upload


def test_upload_replace(client, seeded, admin_headers):
    text = HEADER + "A Player,Eagles,CF,2025-05-01,G1,Tigers,4,2,0\nB Player,Tigers,P,2025-05-01,G1,Eagles,0,0,6.1\n"
    r = upload(client, admin_headers, text)
    assert r.status_code == 200, r.text
    assert r.json()["rows_loaded"] == 2
    assert any("set to 0" in w for w in r.json()["warnings"])
    assert count(client) == 2
    pitcher = client.get("/stats/pitching").json()[0]
    assert pitcher["innings_pitched"] == 6.1 and pitcher["outs_pitched"] == 19


def test_bad_upload_changes_nothing(client, seeded, admin_headers):
    """The original bug: one bad cell used to wipe the whole database."""
    lines = SAMPLE_DATA_PATH.read_text().splitlines()
    cells = lines[5].split(",")
    cells[5] = "four"  # at_bats
    lines[5] = ",".join(cells)
    r = upload(client, admin_headers, "\n".join(lines))
    assert r.status_code == 400
    detail = r.json()["detail"]
    assert "No changes" in detail["message"]
    assert any(e.startswith("Row 6:") and "at_bats" in e for e in detail["errors"])
    assert count(client) == 240


def test_upload_blank_cells_are_zero(client, admin_headers):
    r = upload(client, admin_headers, HEADER + "A Player,Eagles,CF,2025-05-01,G1,Tigers,4,,\n")
    assert r.status_code == 200, r.text


def test_upload_append_updates_same_player_and_game(client, seeded, admin_headers):
    text = (
        HEADER
        + "Marcus Rivera,Eagles,CF,2025-03-15,G001,Tigers,5,5,0\nBrand New,Eagles,LF,2025-07-01,G900,Tigers,3,1,0\n"
    )
    r = upload(client, admin_headers, text, mode="append")
    assert r.status_code == 200, r.text
    assert "Added 1 new records and updated 1" in r.json()["message"]
    assert count(client) == 241
    g001 = client.get("/records?game_id=G001&search=rivera").json()["items"][0]
    assert (g001["at_bats"], g001["hits"]) == (5, 5)


@pytest.mark.parametrize(
    "text,needle",
    [
        ("player_name,team\nA,Eagles\n", "Missing required columns"),
        (HEADER, "no data rows"),
        (HEADER + "A,Eagles,CF,2025-05-01,G1,Tigers,4,1,0\nA,Eagles,CF,2025-05-01,G1,Tigers,4,1,0\n", "appears twice"),
    ],
)
def test_upload_rejects_bad_files(client, admin_headers, text, needle):
    r = upload(client, admin_headers, text)
    assert r.status_code == 400
    assert needle in " ".join(r.json()["detail"]["errors"])


def test_upload_rejects_non_csv_and_non_utf8(client, admin_headers):
    assert upload(client, admin_headers, "x", filename="data.txt").status_code == 400
    r = client.post(
        "/upload-csv", files={"file": ("d.csv", io.BytesIO(b"\xff\xfe\x00bad"), "text/csv")}, headers=admin_headers
    )
    assert r.status_code == 400
