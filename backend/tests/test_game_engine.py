import pytest

from backend.services import game_engine as engine


def game(*events):
    """Replay events after both starting pitchers are set."""
    base = [
        {"type": "pitcher", "side": "home", "name": "Home Ace"},
        {"type": "pitcher", "side": "away", "name": "Away Ace"},
    ]
    return engine.replay("Eagles", "Tigers", "2025-07-01", base + list(events))


def pa(batter, result, **extra):
    return {"type": "pa", "batter": batter, "result": result, **extra}


def three_outs(prefix="Out"):
    return [pa(f"{prefix}{i}", "out") for i in range(3)]


def runners(state):
    return [r["name"] if r else None for r in state["bases"]]


def bat(state, side, name):
    return state["batting"][side][name.lower()]


def pit(state, side, name):
    return state["pitching"][side][name.lower()]


def test_needs_a_pitcher_first():
    state = engine.new_state("Eagles", "Tigers", "2025-07-01")
    with pytest.raises(engine.GameError, match="pitcher first"):
        engine.apply_event(state, pa("Leadoff", "single"))


def test_single_moves_runners_one_base():
    s = game(pa("A", "single"), pa("B", "single"))
    assert runners(s) == ["B", "A", None]
    assert s["score"]["away"] == 0


def test_double_scores_runner_from_second():
    s = game(pa("A", "double"), pa("B", "double"))
    assert runners(s) == [None, "B", None]
    assert s["score"]["away"] == 1
    assert bat(s, "away", "B")["rbi"] == 1
    assert bat(s, "away", "A")["runs"] == 1


def test_grand_slam():
    s = game(pa("A", "walk"), pa("B", "walk"), pa("C", "walk"), pa("D", "home_run"))
    assert s["score"]["away"] == 4
    assert runners(s) == [None, None, None]
    d = bat(s, "away", "D")
    assert (d["home_runs"], d["rbi"], d["runs"], d["at_bats"]) == (1, 4, 1, 1)
    p = pit(s, "home", "Home Ace")
    assert (p["earned_runs"], p["home_runs_allowed"], p["walks_allowed"]) == (4, 1, 3)


def test_walks_only_force_runners():
    s = game(pa("A", "double"), pa("B", "walk"))
    assert runners(s) == ["B", "A", None]  # runner on 2nd isn't forced
    s = game(pa("A", "walk"), pa("B", "hit_by_pitch"), pa("C", "walk"), pa("D", "walk"))
    assert s["score"]["away"] == 1 and bat(s, "away", "D")["rbi"] == 1
    assert bat(s, "away", "B")["hit_by_pitch"] == 1 and bat(s, "away", "B")["at_bats"] == 0


def test_three_outs_switch_sides():
    s = game(pa("A", "single"), *three_outs())
    assert (s["inning"], s["half"], s["outs"]) == (1, "bottom", 0)
    assert runners(s) == [None, None, None]
    assert pit(s, "home", "Home Ace")["outs_pitched"] == 3
    s = game(*three_outs("T"), *three_outs("B"))
    assert (s["inning"], s["half"]) == (2, "top")
    assert s["line_score"] == {"away": [0, 0], "home": [0]}


def test_sac_fly():
    s = game(pa("A", "triple"), pa("B", "sac_fly"))
    assert s["score"]["away"] == 1 and s["outs"] == 1
    b = bat(s, "away", "B")
    assert (b["sacrifice_flies"], b["at_bats"], b["rbi"]) == (1, 0, 1)
    with pytest.raises(engine.GameError, match="runner on third"):
        game(pa("A", "single"), pa("B", "sac_fly"))


def test_runs_are_charged_to_the_pitcher_who_allowed_the_runner():
    s = game(
        pa("A", "single"),
        {"type": "pitcher", "side": "home", "name": "Reliever"},
        pa("B", "home_run"),
    )
    assert pit(s, "home", "Home Ace")["earned_runs"] == 1
    assert pit(s, "home", "Reliever")["earned_runs"] == 1
    assert pit(s, "home", "Reliever")["hits_allowed"] == 1


def test_game_ends_when_home_leads_after_top_of_ninth():
    events = []
    for inning in range(1, 9):
        events += three_outs(f"T{inning}")
        if inning == 1:
            events += [pa("H", "home_run")]
        events += three_outs(f"B{inning}")
    events += three_outs("T9")
    s = game(*events)
    assert s["final"] and s["score"] == {"away": 0, "home": 1}
    with pytest.raises(engine.GameError, match="over"):
        engine.apply_event(s, pa("Late", "single"))


def test_walk_off_only_counts_the_winning_run():
    events = []
    for inning in range(1, 9):
        events += three_outs(f"T{inning}") + three_outs(f"B{inning}")
    events += three_outs("T9") + [pa("R1", "walk"), pa("R2", "walk"), pa("R3", "walk"), pa("Hero", "triple")]
    s = game(*events)
    assert s["final"]
    assert s["score"]["home"] == 1  # only the winning run counts; the game is over
    assert bat(s, "home", "Hero")["rbi"] == 1
    assert bat(s, "home", "R1")["runs"] == 1 and bat(s, "home", "R2")["runs"] == 0


def test_walk_off_home_run_counts_every_run():
    events = []
    for inning in range(1, 9):
        events += three_outs(f"T{inning}") + three_outs(f"B{inning}")
    events += three_outs("T9") + [pa("R1", "walk"), pa("Hero", "home_run")]
    s = game(*events)
    assert s["final"] and s["score"]["home"] == 2


def test_extra_innings_continue_when_tied():
    events = []
    for inning in range(1, 10):
        events += three_outs(f"T{inning}") + three_outs(f"B{inning}")
    s = game(*events)
    assert not s["final"] and s["inning"] == 10


def test_try_event_leaves_state_untouched_on_error():
    s = game(pa("A", "single"))
    with pytest.raises(engine.GameError):
        engine.try_event(s, pa("B", "sac_fly"))
    assert s["outs"] == 0 and runners(s) == ["A", None, None]


def test_box_score_rows_merge_two_way_players():
    s = game(
        pa("A", "single"),
        *three_outs(),
        pa("Home Ace", "double"),  # the home pitcher bats
    )
    rows = engine.box_score_rows(s, "GM-1", lambda name, team: None)
    ace = [r for r in rows if r["player_name"] == "Home Ace"]
    assert len(ace) == 1
    assert ace[0]["doubles"] == 1 and ace[0]["innings_pitched"] == "1.0"
    a = next(r for r in rows if r["player_name"] == "A")
    assert a["team"] == "Tigers" and a["opponent"] == "Eagles" and a["position"] == "UT"
    away_ace = next(r for r in rows if r["player_name"] == "Away Ace")
    assert away_ace["position"] == "P"
