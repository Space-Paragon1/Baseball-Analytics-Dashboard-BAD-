from datetime import date
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ValidationError
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User
from backend.schemas import GameRecordIn
from backend.services import mlb_import
from backend.services.auth_service import require_admin
from backend.services.records import CSVError, format_validation_error, save_records

router = APIRouter(prefix="/import/mlb", tags=["MLB Import"])


class MLBImportBody(BaseModel):
    start_date: date
    end_date: date
    team_id: Optional[int] = None
    mode: Literal["append", "replace"] = "append"


@router.get("/teams")
def mlb_teams(season: int = Query(default_factory=lambda: date.today().year, ge=1901, le=2100)) -> List[Dict[str, Any]]:
    try:
        return list(mlb_import.list_teams(season))
    except mlb_import.MLBImportError as e:
        raise HTTPException(status_code=502, detail=str(e)) from None


@router.post("")
def import_mlb(body: MLBImportBody, db: Session = Depends(get_db), _: User = Depends(require_admin)) -> Dict[str, Any]:
    try:
        rows, games = mlb_import.fetch_rows(body.start_date, body.end_date, body.team_id)
    except mlb_import.MLBUnavailable as e:
        raise HTTPException(status_code=502, detail=str(e)) from None
    except mlb_import.MLBImportError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None
    if not rows:
        raise HTTPException(status_code=404, detail="No completed MLB games found in that range.")

    try:
        items = [GameRecordIn(**r) for r in rows]
        inserted, replaced = save_records(db, items, mode=body.mode)
    except ValidationError as e:
        raise HTTPException(status_code=502, detail=f"Unexpected data from MLB: {format_validation_error(e)}") from None
    except CSVError as e:
        raise HTTPException(status_code=502, detail=" ".join(e.errors)) from None

    if body.mode == "replace":
        message = f"Replaced all data with {games} MLB games ({inserted} player lines)."
    elif replaced:
        message = f"Imported {games} MLB games ({inserted} player lines, {replaced} updated)."
    else:
        message = f"Imported {games} MLB games ({inserted} player lines)."
    return {"success": True, "message": message, "games": games, "rows_loaded": inserted, "mode": body.mode}
