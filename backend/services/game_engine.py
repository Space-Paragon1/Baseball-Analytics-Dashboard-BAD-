"""Game Mode scoring engine.

A game is a list of events; the current state is rebuilt by replaying them,
which makes undo trivial and keeps the stored data small.

Events:
  {"type": "pitcher", "side": "home"|"away", "name": str}
  {"type": "pa", "batter": str, "result": <RESULT>, "position": str|None}

Runners move station-to-station: on a single every runner moves up one base,
on a double two, and so on. Walks and hit-by-pitches only force runners.
Every run is earned (no errors are modelled) and is charged to the pitcher
who put that runner on base.
"""

from copy import deepcopy
from typing import Any, Callable, Dict, List, Optional

HIT_BASES = {"single": 1, "double": 2, "triple": 3, "home_run": 4}
RESULTS = ["single", "double", "triple", "home_run", "walk", "hit_by_pitch", "strikeout", "out", "sac_fly"]
SIDES = ("away", "home")
REGULATION_INNINGS = 9

_VERBS = {
    "single": "singled",
    "double": "doubled",
    "triple": "tripled",
    "home_run": "homered",
    "walk": "walked",
    "hit_by_pitch": "was hit by a pitch",
    "strikeout": "struck out",
    "out": "made an out",
    "sac_fly": "hit a sacrifice fly",
}

BATTING_FIELDS = [
    "plate_appearances",
    "at_bats",
    "hits",
    "doubles",
    "triples",
    "home_runs",
    "runs",
    "rbi",
    "walks",
    "strikeouts",
    "hit_by_pitch",
    "sacrifice_flies",
]
PITCHING_FIELDS = [
    "outs_pitched",
    "hits_allowed",
    "runs_allowed",
    "earned_runs",
    "walks_allowed",
    "strikeouts_pitched",
    "home_runs_allowed",
    "hit_batsmen",
]


class GameError(ValueError):
    """An event that isn't allowed in the current game state."""


def other(side: str) -> str:
    return "home" if side == "away" else "away"


def _key(name: str) -> str:
    return " ".join(name.split()).lower()


def new_state(home_team: str, away_team: str, game_date: str) -> Dict[str, Any]:
    return {
        "teams": {"home": home_team, "away": away_team},
        "game_date": game_date,
        "inning": 1,
        "half": "top",
        "outs": 0,
        "bases": [None, None, None],  # runner: {"name", "side", "pitcher"}
        "score": {"away": 0, "home": 0},
        "line_score": {"away": [0], "home": []},
        "pitchers": {"home": None, "away": None},
        "batting": {"away": {}, "home": {}},
        "pitching": {"away": {}, "home": {}},
        "plays": [],
        "final": False,
    }


def _batting_line(state, side: str, name: str) -> Dict[str, Any]:
    lines = state["batting"][side]
    k = _key(name)
    if k not in lines:
        lines[k] = {
            "name": " ".join(name.split()),
            "position": None,
            "order": len(lines),
            **{f: 0 for f in BATTING_FIELDS},
        }
    return lines[k]


def _pitching_line(state, side: str, name: str) -> Dict[str, Any]:
    lines = state["pitching"][side]
    k = _key(name)
    if k not in lines:
        lines[k] = {"name": " ".join(name.split()), "order": len(lines), **{f: 0 for f in PITCHING_FIELDS}}
    return lines[k]


def _end_half(state) -> None:
    state["outs"] = 0
    state["bases"] = [None, None, None]
    inning, score = state["inning"], state["score"]
    if state["half"] == "top":
        if inning >= REGULATION_INNINGS and score["home"] > score["away"]:
            state["final"] = True  # home team doesn't need to bat
            return
        state["half"] = "bottom"
        state["line_score"]["home"].append(0)
    else:
        if inning >= REGULATION_INNINGS and score["home"] != score["away"]:
            state["final"] = True
            return
        state["inning"] += 1
        state["half"] = "top"
        state["line_score"]["away"].append(0)


def _apply_pitcher(state, ev) -> None:
    side, name = ev.get("side"), (ev.get("name") or "").strip()
    if side not in SIDES:
        raise GameError("side must be 'home' or 'away'.")
    if not name:
        raise GameError("Enter the pitcher's name.")
    state["pitchers"][side] = " ".join(name.split())
    state["plays"].append(
        {
            "inning": state["inning"],
            "half": state["half"],
            "side": side,
            "runs": 0,
            "text": f"{state['pitchers'][side]} is now pitching for the {state['teams'][side]}.",
        }
    )


def _apply_pa(state, ev) -> None:
    if state["final"]:
        raise GameError("The game is over. Save it or undo the last play.")
    result = ev.get("result")
    if result not in RESULTS:
        raise GameError(f"Unknown result '{result}'.")
    batter = " ".join((ev.get("batter") or "").split())
    if not batter:
        raise GameError("Enter the batter's name.")

    bat_side = "away" if state["half"] == "top" else "home"
    fld_side = other(bat_side)
    pitcher = state["pitchers"][fld_side]
    if not pitcher:
        raise GameError(f"Set the {state['teams'][fld_side]} pitcher first.")

    runners = state["bases"]
    if result == "sac_fly" and (state["outs"] >= 2 or runners[2] is None):
        raise GameError("A sacrifice fly needs a runner on third and fewer than two outs.")

    b = _batting_line(state, bat_side, batter)
    if ev.get("position") and not b["position"]:
        b["position"] = str(ev["position"]).upper()
    p = _pitching_line(state, fld_side, pitcher)
    b["plate_appearances"] += 1
    me = {"name": b["name"], "side": bat_side, "pitcher": pitcher}
    scored: List[Dict[str, Any]] = []

    if result in HIT_BASES:
        n = HIT_BASES[result]
        b["at_bats"] += 1
        b["hits"] += 1
        p["hits_allowed"] += 1
        if result == "double":
            b["doubles"] += 1
        elif result == "triple":
            b["triples"] += 1
        elif result == "home_run":
            b["home_runs"] += 1
            p["home_runs_allowed"] += 1
        new = [None, None, None]
        for i in (2, 1, 0):  # lead runner first
            if runners[i]:
                if i + n >= 3:
                    scored.append(runners[i])
                else:
                    new[i + n] = runners[i]
        if n >= 4:
            scored.append(me)
        else:
            new[n - 1] = me
        state["bases"] = new
    elif result in ("walk", "hit_by_pitch"):
        if result == "walk":
            b["walks"] += 1
            p["walks_allowed"] += 1
        else:
            b["hit_by_pitch"] += 1
            p["hit_batsmen"] += 1
        new = list(runners)
        if new[0]:
            if new[1]:
                if new[2]:
                    scored.append(new[2])
                new[2] = new[1]
            new[1] = new[0]
        new[0] = me
        state["bases"] = new
    else:  # strikeout, out, sac_fly
        if result == "sac_fly":
            b["sacrifice_flies"] += 1
            scored.append(runners[2])
            state["bases"] = [runners[0], runners[1], None]
        else:
            b["at_bats"] += 1
            if result == "strikeout":
                b["strikeouts"] += 1
                p["strikeouts_pitched"] += 1
        state["outs"] += 1
        p["outs_pitched"] += 1

    # Walk-off: once the winning run scores the game ends, so extra runners'
    # runs don't count (home runs are the exception).
    walk_off_possible = bat_side == "home" and state["inning"] >= REGULATION_INNINGS
    if walk_off_possible and result != "home_run":
        needed = state["score"]["away"] - state["score"]["home"] + 1
        if needed > 0:
            scored = scored[:needed]

    for r in scored:
        _batting_line(state, r["side"], r["name"])["runs"] += 1
        charged = _pitching_line(state, fld_side, r["pitcher"])
        charged["runs_allowed"] += 1
        charged["earned_runs"] += 1
    b["rbi"] += len(scored)  # no errors or double plays are modelled, so every run is an RBI
    state["score"][bat_side] += len(scored)
    state["line_score"][bat_side][-1] += len(scored)

    text = f"{b['name']} {_VERBS[result]}."
    scorers = [r["name"] for r in scored if r is not me]
    if scorers:
        text += f" {', '.join(scorers)} scored."
    state["plays"].append(
        {"inning": state["inning"], "half": state["half"], "side": bat_side, "runs": len(scored), "text": text}
    )

    if walk_off_possible and state["score"]["home"] > state["score"]["away"]:
        state["final"] = True
    elif state["outs"] >= 3:
        _end_half(state)


def apply_event(state: Dict[str, Any], ev: Dict[str, Any]) -> None:
    if ev.get("type") == "pitcher":
        _apply_pitcher(state, ev)
    elif ev.get("type") == "pa":
        _apply_pa(state, ev)
    else:
        raise GameError(f"Unknown event type '{ev.get('type')}'.")


def replay(home_team: str, away_team: str, game_date: str, events: List[Dict[str, Any]]) -> Dict[str, Any]:
    state = new_state(home_team, away_team, game_date)
    for ev in events:
        apply_event(state, ev)
    return state


def try_event(state: Dict[str, Any], ev: Dict[str, Any]) -> Dict[str, Any]:
    """Apply an event to a copy, so a rejected event leaves `state` untouched."""
    nxt = deepcopy(state)
    apply_event(nxt, ev)
    return nxt


def public_state(state: Dict[str, Any]) -> Dict[str, Any]:
    """Shape the state for the API (lists instead of keyed dicts)."""

    def ordered(lines):
        return [
            {k: v for k, v in line.items() if k != "order"} for line in sorted(lines.values(), key=lambda x: x["order"])
        ]

    batting_side = "away" if state["half"] == "top" else "home"
    return {
        "teams": state["teams"],
        "game_date": state["game_date"],
        "inning": state["inning"],
        "half": state["half"],
        "outs": state["outs"],
        "bases": [r["name"] if r else None for r in state["bases"]],
        "score": state["score"],
        "line_score": state["line_score"],
        "pitchers": state["pitchers"],
        "batting_side": batting_side,
        "batting": {s: ordered(state["batting"][s]) for s in SIDES},
        "pitching": {s: ordered(state["pitching"][s]) for s in SIDES},
        "plays": list(reversed(state["plays"])),
        "final": state["final"],
    }


def box_score_rows(
    state: Dict[str, Any],
    game_id: str,
    position_for: Callable[[str, str], Optional[str]],
) -> List[Dict[str, Any]]:
    """One record per player per team, batting and pitching merged."""
    rows = []
    for side in SIDES:
        team, opponent = state["teams"][side], state["teams"][other(side)]
        people: Dict[str, Dict[str, Any]] = {}
        for k, line in state["batting"][side].items():
            people.setdefault(k, {"name": line["name"]})["bat"] = line
        for k, line in state["pitching"][side].items():
            people.setdefault(k, {"name": line["name"]})["pit"] = line
        for person in people.values():
            bat, pit = person.get("bat", {}), person.get("pit", {})
            position = bat.get("position") or position_for(person["name"], team) or ("P" if pit and not bat else "UT")
            outs = pit.get("outs_pitched", 0)
            rows.append(
                {
                    "player_name": person["name"],
                    "team": team,
                    "opponent": opponent,
                    "position": position,
                    "game_date": state["game_date"],
                    "game_id": game_id,
                    **{f: bat.get(f, 0) for f in BATTING_FIELDS if f != "plate_appearances"},
                    "innings_pitched": f"{outs // 3}.{outs % 3}",
                    **{f: pit.get(f, 0) for f in PITCHING_FIELDS if f not in ("outs_pitched", "runs_allowed")},
                }
            )
    return rows
