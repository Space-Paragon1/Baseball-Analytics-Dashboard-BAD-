"""Import real MLB box scores from the public MLB Stats API (statsapi.mlb.com).

No API key is needed. Data is (c) MLB Advanced Media and is for personal,
non-commercial use under MLB's terms: http://gdx.mlb.com/components/copyright.txt
"""

import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from functools import lru_cache
from typing import Any, Dict, List, Optional, Tuple

import httpx

from backend.services.innings import outs_to_innings

MLB_API = "https://statsapi.mlb.com/api/v1"
GAME_TYPES = {"R", "F", "D", "L", "W"}  # regular season and postseason rounds
FINAL_CODES = {"F", "O"}  # Final, Game Over (excludes postponed/cancelled)
MAX_GAMES = 250
MAX_DAYS = 366
_HEADERS = {"User-Agent": "BaseballAnalyticsDashboard/3.0"}


class MLBImportError(Exception):
    """The request can't be imported (bad range, too many games)."""


class MLBUnavailable(MLBImportError):
    """The MLB API couldn't be reached or returned an error."""


def get_json(path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """GET a Stats API path, retrying briefly on network errors and 5xx."""
    last: Optional[Exception] = None
    for attempt in range(3):
        try:
            r = httpx.get(f"{MLB_API}{path}", params=params, headers=_HEADERS, timeout=20)
            if r.status_code < 500:
                r.raise_for_status()
                return r.json()
            last = MLBUnavailable(f"MLB API returned {r.status_code}")
        except httpx.HTTPError as e:
            last = e
        time.sleep(0.5 * (attempt + 1))
    raise MLBUnavailable(f"Couldn't reach the MLB Stats API ({last}). Try again in a minute.")


@lru_cache(maxsize=8)
def list_teams(season: int) -> Tuple[Dict[str, Any], ...]:
    data = get_json("/teams", {"sportId": 1, "season": season})
    teams = [
        {
            "id": t["id"],
            "name": t["name"],
            "team_name": t.get("teamName", t["name"]),
            "abbreviation": t.get("abbreviation", ""),
        }
        for t in data.get("teams", [])
    ]
    return tuple(sorted(teams, key=lambda t: t["name"]))


def find_games(start: date, end: date, team_id: Optional[int] = None) -> List[Tuple[int, str]]:
    """(gamePk, official date) for completed MLB games in the range."""
    params: Dict[str, Any] = {"sportId": 1, "startDate": start.isoformat(), "endDate": end.isoformat()}
    if team_id:
        params["teamId"] = team_id
    data = get_json("/schedule", params)
    games: Dict[int, str] = {}
    for day in data.get("dates", []):
        for g in day.get("games", []):
            if g.get("gameType") in GAME_TYPES and g.get("status", {}).get("codedGameState") in FINAL_CODES:
                games[g["gamePk"]] = g.get("officialDate") or day["date"]
    return sorted(games.items(), key=lambda kv: (kv[1], kv[0]))


def _n(stats: Dict[str, Any], key: str) -> int:
    try:
        return int(stats.get(key) or 0)
    except (TypeError, ValueError):
        return 0


def parse_boxscore(box: Dict[str, Any], game_pk: int, game_date: str) -> List[Dict[str, Any]]:
    """Box score JSON -> rows in our record format (one per player who batted or pitched)."""
    rows = []
    teams = box["teams"]
    names = {side: teams[side]["team"].get("teamName") or teams[side]["team"]["name"] for side in ("away", "home")}
    for side, opp in (("away", "home"), ("home", "away")):
        for player in teams[side].get("players", {}).values():
            stats = player.get("stats") or {}
            bat, pit = stats.get("batting") or {}, stats.get("pitching") or {}
            # Keep pinch runners who scored without batting, or team runs won't add up.
            if not (_n(bat, "plateAppearances") or _n(bat, "runs") or _n(pit, "battersFaced") or _n(pit, "outs")):
                continue  # on the roster but didn't bat, run or pitch
            outs = _n(pit, "outs")
            rows.append(
                {
                    "player_id": player["person"]["id"],
                    "player_name": player["person"]["fullName"],
                    "team": names[side],
                    "opponent": names[opp],
                    "position": (player.get("position") or {}).get("abbreviation") or "UT",
                    "game_date": game_date,
                    "game_id": f"MLB-{game_pk}",
                    "at_bats": _n(bat, "atBats"),
                    "hits": _n(bat, "hits"),
                    "doubles": _n(bat, "doubles"),
                    "triples": _n(bat, "triples"),
                    "home_runs": _n(bat, "homeRuns"),
                    "runs": _n(bat, "runs"),
                    "rbi": _n(bat, "rbi"),
                    "strikeouts": _n(bat, "strikeOuts"),
                    "walks": _n(bat, "baseOnBalls"),
                    "hit_by_pitch": _n(bat, "hitByPitch"),
                    "sacrifice_flies": _n(bat, "sacFlies"),
                    "innings_pitched": outs_to_innings(outs),
                    "earned_runs": _n(pit, "earnedRuns"),
                    "hits_allowed": _n(pit, "hits"),
                    "walks_allowed": _n(pit, "baseOnBalls"),
                    "strikeouts_pitched": _n(pit, "strikeOuts"),
                    "home_runs_allowed": _n(pit, "homeRuns"),
                    "hit_batsmen": _n(pit, "hitBatsmen") or _n(pit, "hitByPitch"),
                }
            )
    return rows


def fetch_rows(start: date, end: date, team_id: Optional[int] = None) -> Tuple[List[Dict[str, Any]], int]:
    """All box-score rows for completed games in the range. Returns (rows, games)."""
    if end < start:
        raise MLBImportError("The start date must be on or before the end date.")
    if (end - start).days >= MAX_DAYS:
        raise MLBImportError("Pick a range of one year or less.")
    games = find_games(start, end, team_id)
    if len(games) > MAX_GAMES:
        raise MLBImportError(
            f"That range has {len(games)} games; the limit is {MAX_GAMES} per import. "
            "Pick a shorter range or a single team."
        )

    def one(game: Tuple[int, str]) -> List[Dict[str, Any]]:
        pk, day = game
        return parse_boxscore(get_json(f"/game/{pk}/boxscore"), pk, day)

    with ThreadPoolExecutor(max_workers=8) as pool:
        batches = list(pool.map(one, games))
    return [row for batch in batches for row in batch], len(games)
