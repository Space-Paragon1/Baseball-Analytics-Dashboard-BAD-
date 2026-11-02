from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.config import MAX_UPLOAD_MB
from backend.database import get_db
from backend.models import GameRecord, User
from backend.schemas import GameRecordIn, GameRecordOut, ImportResult, RecordPage
from backend.services.auth_service import require_admin, require_user
from backend.services.records import CSVError, PlayerIdAllocator, parse_csv, save_records

router = APIRouter(tags=["Records"])

_DUPLICATE = "This player already has a record for that game. Edit the existing record instead."


@router.get("/records", response_model=RecordPage)
def list_records(
    search: Optional[str] = Query(default=None, description="Matches player name, game id or opponent"),
    team: Optional[str] = None,
    game_id: Optional[str] = None,
    player_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    db: Session = Depends(get_db),
) -> RecordPage:
    stmt = select(GameRecord)
    if search:
        like = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(GameRecord.player_name).like(like),
                func.lower(GameRecord.game_id).like(like),
                func.lower(GameRecord.opponent).like(like),
            )
        )
    if team:
        stmt = stmt.where(func.lower(GameRecord.team) == team.lower())
    if game_id:
        stmt = stmt.where(GameRecord.game_id == game_id)
    if player_id:
        stmt = stmt.where(GameRecord.player_id == player_id)
    if start_date:
        stmt = stmt.where(GameRecord.game_date >= start_date)
    if end_date:
        stmt = stmt.where(GameRecord.game_date <= end_date)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(
        stmt.order_by(GameRecord.game_date.desc(), GameRecord.game_id, GameRecord.team, GameRecord.player_name)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return RecordPage(items=[GameRecordOut.from_model(r) for r in rows], total=total, page=page, page_size=page_size)


@router.post("/records", response_model=GameRecordOut, status_code=status.HTTP_201_CREATED)
def create_record(body: GameRecordIn, db: Session = Depends(get_db), _: User = Depends(require_user)) -> GameRecordOut:
    pid = PlayerIdAllocator(db).resolve(body.player_name, body.team, body.player_id)
    record = GameRecord(player_id=pid, **body.db_fields())
    db.add(record)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=_DUPLICATE) from None
    db.refresh(record)
    return GameRecordOut.from_model(record)


@router.put("/records/{record_id}", response_model=GameRecordOut)
def update_record(
    record_id: int, body: GameRecordIn, db: Session = Depends(get_db), _: User = Depends(require_user)
) -> GameRecordOut:
    record = db.get(GameRecord, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found.")

    if body.player_id:
        pid = body.player_id
    elif body.player_name.strip().lower() == record.player_name.strip().lower():
        pid = record.player_id  # same player, maybe a new team or position
    else:
        pid = PlayerIdAllocator(db).resolve(body.player_name, body.team)

    record.player_id = pid
    for key, value in body.db_fields().items():
        setattr(record, key, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=_DUPLICATE) from None
    db.refresh(record)
    return GameRecordOut.from_model(record)


@router.delete("/records/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_record(record_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)) -> None:
    record = db.get(GameRecord, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found.")
    db.delete(record)
    db.commit()


@router.post("/upload-csv", response_model=ImportResult)
def upload_csv(
    file: UploadFile = File(...),
    mode: Literal["replace", "append"] = Form(default="replace"),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> ImportResult:
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a .csv file.")
    limit = MAX_UPLOAD_MB * 1024 * 1024
    contents = file.file.read(limit + 1)
    if len(contents) > limit:
        raise HTTPException(status_code=413, detail=f"File is larger than {MAX_UPLOAD_MB} MB.")

    try:
        items, warnings = parse_csv(contents)
        inserted, replaced = save_records(db, items, mode=mode)
    except CSVError as e:
        # Nothing was written: validation runs before the database is touched.
        raise HTTPException(
            status_code=400,
            detail={"message": "No changes were made. Fix these rows and try again.", "errors": e.errors},
        ) from None

    if mode == "replace":
        message = f"Replaced all data with {inserted} records."
    else:
        message = f"Added {inserted - replaced} new records" + (f" and updated {replaced}." if replaced else ".")
    return ImportResult(message=message, rows_loaded=inserted, mode=mode, warnings=warnings)
