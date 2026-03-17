from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import pandas as pd
import io
from typing import Dict, Any, Optional
from datetime import date

from backend.database import get_db
from backend.models.game_record import GameRecord

router = APIRouter()

REQUIRED_COLUMNS = {
    "player_id", "player_name", "team", "position", "game_date",
    "at_bats", "hits", "doubles", "triples", "home_runs",
    "runs", "rbi", "strikeouts", "walks", "hit_by_pitch",
    "innings_pitched", "earned_runs", "hits_allowed",
    "walks_allowed", "strikeouts_pitched", "game_id", "opponent"
}


@router.post("/upload-csv")
async def upload_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV file.")

    contents = await file.read()
    try:
        df = pd.read_csv(io.StringIO(contents.decode("utf-8")))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {str(e)}")

    missing_cols = REQUIRED_COLUMNS - set(df.columns)
    if missing_cols:
        raise HTTPException(
            status_code=400,
            detail=f"CSV is missing required columns: {', '.join(sorted(missing_cols))}"
        )

    try:
        df["game_date"] = pd.to_datetime(df["game_date"]).dt.date
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format in 'game_date' column.")

    # Clear existing records and reload
    db.query(GameRecord).delete()
    db.commit()

    records_added = 0
    for _, row in df.iterrows():
        record = GameRecord(
            player_id=int(row["player_id"]),
            player_name=str(row["player_name"]),
            team=str(row["team"]),
            position=str(row["position"]),
            game_date=row["game_date"],
            at_bats=int(row["at_bats"]),
            hits=int(row["hits"]),
            doubles=int(row["doubles"]),
            triples=int(row["triples"]),
            home_runs=int(row["home_runs"]),
            runs=int(row["runs"]),
            rbi=int(row["rbi"]),
            strikeouts=int(row["strikeouts"]),
            walks=int(row["walks"]),
            hit_by_pitch=int(row["hit_by_pitch"]),
            innings_pitched=float(row["innings_pitched"]),
            earned_runs=int(row["earned_runs"]),
            hits_allowed=int(row["hits_allowed"]),
            walks_allowed=int(row["walks_allowed"]),
            strikeouts_pitched=int(row["strikeouts_pitched"]),
            game_id=str(row["game_id"]),
            opponent=str(row["opponent"]),
        )
        db.add(record)
        records_added += 1

    db.commit()

    return {
        "success": True,
        "message": f"Successfully loaded {records_added} records.",
        "rows_loaded": records_added,
    }


class GameRecordInput(BaseModel):
    player_name: str
    team: str
    position: str
    game_date: str
    at_bats: int = 0
    hits: int = 0
    doubles: int = 0
    triples: int = 0
    home_runs: int = 0
    runs: int = 0
    rbi: int = 0
    strikeouts: int = 0
    walks: int = 0
    hit_by_pitch: int = 0
    innings_pitched: float = 0.0
    earned_runs: int = 0
    hits_allowed: int = 0
    walks_allowed: int = 0
    strikeouts_pitched: int = 0
    game_id: str
    opponent: str


@router.post("/add-game-record")
def add_game_record(
    body: GameRecordInput,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    # Validate required text fields
    if not body.player_name.strip():
        raise HTTPException(status_code=400, detail="player_name is required.")
    if not body.team.strip():
        raise HTTPException(status_code=400, detail="team is required.")
    if not body.position.strip():
        raise HTTPException(status_code=400, detail="position is required.")
    if not body.game_id.strip():
        raise HTTPException(status_code=400, detail="game_id is required.")
    if not body.opponent.strip():
        raise HTTPException(status_code=400, detail="opponent is required.")

    # Parse game_date
    try:
        from datetime import datetime
        parsed_date = datetime.strptime(body.game_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="game_date must be in YYYY-MM-DD format.")

    # Generate or find player_id
    existing = db.query(GameRecord).filter(
        GameRecord.player_name == body.player_name
    ).first()

    if existing:
        player_id = existing.player_id
    else:
        max_id = db.query(GameRecord).count()
        player_id = max_id + 1

    record = GameRecord(
        player_id=player_id,
        player_name=body.player_name.strip(),
        team=body.team.strip(),
        position=body.position.strip(),
        game_date=parsed_date,
        at_bats=body.at_bats,
        hits=body.hits,
        doubles=body.doubles,
        triples=body.triples,
        home_runs=body.home_runs,
        runs=body.runs,
        rbi=body.rbi,
        strikeouts=body.strikeouts,
        walks=body.walks,
        hit_by_pitch=body.hit_by_pitch,
        innings_pitched=body.innings_pitched,
        earned_runs=body.earned_runs,
        hits_allowed=body.hits_allowed,
        walks_allowed=body.walks_allowed,
        strikeouts_pitched=body.strikeouts_pitched,
        game_id=body.game_id.strip(),
        opponent=body.opponent.strip(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {"success": True, "message": "Game record added successfully.", "id": record.id}
