import uuid
from datetime import date
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import GameRecord, GameSession, User
from backend.schemas import GameRecordIn
from backend.services import game_engine as engine
from backend.services.auth_service import require_user
from backend.services.records import CSVError, format_validation_error, save_records

router = APIRouter(prefix="/game-mode", tags=["Game Mode"])


class StartGameBody(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    home_team: str = Field(min_length=1, max_length=60)
    away_team: str = Field(min_length=1, max_length=60)
    game_date: date

    @model_validator(mode="after")
    def _different(self):
        if self.home_team.lower() == self.away_team.lower():
            raise ValueError("Pick two different teams.")
        return self


class PitcherBody(BaseModel):
    side: Literal["home", "away"]
    name: str = Field(min_length=1, max_length=100)


class PlateAppearanceBody(BaseModel):
    batter: str = Field(min_length=1, max_length=100)
    result: Literal[tuple(engine.RESULTS)]  # type: ignore[valid-type]
    position: Optional[str] = Field(default=None, max_length=10)


def _get(db: Session, game_id: str) -> GameSession:
    session = db.get(GameSession, game_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Game not found.")
    return session


def _state(session: GameSession) -> Dict[str, Any]:
    return engine.replay(session.home_team, session.away_team, session.game_date, session.events or [])


def _response(session: GameSession, state: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": session.id,
        "saved": session.saved,
        "can_undo": bool(session.events) and not session.saved,
        **engine.public_state(state),
    }


def _add_event(db: Session, game_id: str, event: Dict[str, Any]) -> Dict[str, Any]:
    session = _get(db, game_id)
    if session.saved:
        raise HTTPException(status_code=400, detail="This game has already been saved.")
    try:
        state = engine.try_event(_state(session), event)
    except engine.GameError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None
    session.events = [*(session.events or []), event]  # reassign so SQLAlchemy sees the change
    db.commit()
    return _response(session, state)


@router.post("/start", status_code=status.HTTP_201_CREATED)
def start_game(
    body: StartGameBody, db: Session = Depends(get_db), user: User = Depends(require_user)
) -> Dict[str, Any]:
    session = GameSession(
        id=f"GM-{uuid.uuid4().hex[:8].upper()}",
        home_team=body.home_team,
        away_team=body.away_team,
        game_date=body.game_date.isoformat(),
        events=[],
        created_by=user.id,
    )
    db.add(session)
    db.commit()
    return _response(session, _state(session))


@router.get("/sessions")
def list_sessions(db: Session = Depends(get_db), _: User = Depends(require_user)) -> List[Dict[str, Any]]:
    """Unsaved games, newest first, so a game can be resumed after a refresh."""
    sessions = db.scalars(
        select(GameSession).where(GameSession.saved.is_(False)).order_by(GameSession.updated_at.desc())
    ).all()
    out = []
    for s in sessions:
        st = _state(s)
        out.append(
            {
                "id": s.id,
                "home_team": s.home_team,
                "away_team": s.away_team,
                "game_date": s.game_date,
                "score": st["score"],
                "inning": st["inning"],
                "half": st["half"],
                "final": st["final"],
            }
        )
    return out


@router.get("/{game_id}")
def get_game(game_id: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    session = _get(db, game_id)
    return _response(session, _state(session))


@router.post("/{game_id}/pitcher")
def set_pitcher(game_id: str, body: PitcherBody, db: Session = Depends(get_db), _: User = Depends(require_user)):
    return _add_event(db, game_id, {"type": "pitcher", "side": body.side, "name": body.name})


@router.post("/{game_id}/plate-appearance")
def plate_appearance(
    game_id: str, body: PlateAppearanceBody, db: Session = Depends(get_db), _: User = Depends(require_user)
):
    return _add_event(
        db, game_id, {"type": "pa", "batter": body.batter, "result": body.result, "position": body.position}
    )


@router.post("/{game_id}/undo")
def undo(game_id: str, db: Session = Depends(get_db), _: User = Depends(require_user)) -> Dict[str, Any]:
    session = _get(db, game_id)
    if session.saved:
        raise HTTPException(status_code=400, detail="This game has already been saved.")
    if not session.events:
        raise HTTPException(status_code=400, detail="Nothing to undo.")
    session.events = session.events[:-1]
    db.commit()
    return _response(session, _state(session))


@router.post("/{game_id}/save")
def save_game(game_id: str, db: Session = Depends(get_db), _: User = Depends(require_user)) -> Dict[str, Any]:
    session = _get(db, game_id)
    if session.saved:
        raise HTTPException(status_code=400, detail="This game has already been saved.")
    state = _state(session)

    def position_for(name: str, team: str) -> Optional[str]:
        return db.scalar(
            select(GameRecord.position)
            .where(func.lower(GameRecord.player_name) == name.lower(), func.lower(GameRecord.team) == team.lower())
            .group_by(GameRecord.position)
            .order_by(func.count().desc())
            .limit(1)
        )

    rows = engine.box_score_rows(state, session.id, position_for)
    if not rows:
        raise HTTPException(status_code=400, detail="Log at least one plate appearance before saving.")
    try:
        items = [GameRecordIn(**r) for r in rows]
        inserted, _ = save_records(db, items, mode="append")
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=format_validation_error(e)) from None
    except CSVError as e:
        raise HTTPException(status_code=400, detail=" ".join(e.errors)) from None

    session.saved = True
    db.commit()
    return {
        "success": True,
        "message": f"Saved {inserted} player records.",
        "records_saved": inserted,
        **_response(session, state),
    }


@router.delete("/{game_id}", status_code=status.HTTP_204_NO_CONTENT)
def discard_game(game_id: str, db: Session = Depends(get_db), _: User = Depends(require_user)) -> None:
    db.delete(_get(db, game_id))
    db.commit()
