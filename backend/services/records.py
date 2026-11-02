"""Reading and writing game records: the one place that knows how rows are
loaded into pandas, parsed from CSV, assigned player ids and inserted."""

import io
import re
from datetime import date
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import pandas as pd
from pydantic import ValidationError
from sqlalchemy import and_, delete, func, insert, or_, select
from sqlalchemy.orm import Session

from backend.config import SAMPLE_DATA_PATH, logger
from backend.models import GameRecord
from backend.schemas import IDENTITY_FIELDS, STAT_FIELDS, GameRecordIn

# Player ids at or above this are reserved for MLB player ids from the MLB import.
LOCAL_ID_LIMIT = 100_000


class CSVError(Exception):
    def __init__(self, errors: List[str]):
        super().__init__("; ".join(errors))
        self.errors = errors


# ---------------------------------------------------------------- reading


def load_df(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    team: Optional[str] = None,
) -> pd.DataFrame:
    """All matching records as a DataFrame (game_date as datetime64)."""
    stmt = select(GameRecord.__table__)
    if start_date:
        stmt = stmt.where(GameRecord.game_date >= start_date)
    if end_date:
        stmt = stmt.where(GameRecord.game_date <= end_date)
    if team:
        stmt = stmt.where(func.lower(GameRecord.team) == team.lower())
    df = pd.read_sql(stmt, db.connection())
    if not df.empty:
        df["game_date"] = pd.to_datetime(df["game_date"])
    return df


def format_validation_error(err: ValidationError) -> str:
    parts = []
    for e in err.errors():
        msg = re.sub(r"^Value error, ", "", e["msg"])
        field = ".".join(str(x) for x in e["loc"])
        parts.append(f"{field}: {msg}" if field else msg)
    return "; ".join(parts)


# ---------------------------------------------------------------- player ids


class PlayerIdAllocator:
    """Gives each player a stable id: reuse an existing id when the name (and
    ideally team) matches, otherwise hand out the next free local id."""

    def __init__(self, db: Optional[Session] = None):
        self._by_name_team: Dict[Tuple[str, str], int] = {}
        self._by_name: Dict[str, int] = {}
        self._next = 1
        if db is not None:
            rows = db.execute(select(GameRecord.player_id, GameRecord.player_name, GameRecord.team).distinct()).all()
            for pid, name, team in rows:
                self.remember(pid, name, team)

    def remember(self, pid: int, name: str, team: str) -> None:
        key = name.strip().lower()
        self._by_name_team.setdefault((key, team.strip().lower()), pid)
        self._by_name.setdefault(key, pid)
        if pid < LOCAL_ID_LIMIT:
            self._next = max(self._next, pid + 1)

    def resolve(self, name: str, team: str, explicit: Optional[int] = None) -> int:
        if explicit:
            self.remember(explicit, name, team)
            return explicit
        key = name.strip().lower()
        pid = self._by_name_team.get((key, team.strip().lower())) or self._by_name.get(key)
        if pid is None:
            pid = self._next
            self._next += 1
        self.remember(pid, name, team)
        return pid


# ---------------------------------------------------------------- writing


def build_rows(items: Sequence[GameRecordIn], allocator: PlayerIdAllocator) -> List[dict]:
    """Validated inputs -> column dicts with player ids, rejecting duplicates."""
    for it in items:
        if it.player_id:
            allocator.remember(it.player_id, it.player_name, it.team)
    rows, seen = [], {}
    for idx, it in enumerate(items):
        pid = allocator.resolve(it.player_name, it.team, it.player_id)
        key = (it.game_id, pid)
        if key in seen:
            # +2: CSV line numbers start after the header row
            raise CSVError(
                [f"Rows {seen[key] + 2} and {idx + 2}: {it.player_name} appears twice in game {it.game_id}."]
            )
        seen[key] = idx
        rows.append({"player_id": pid, **it.db_fields()})
    return rows


def delete_matching(db: Session, rows: Iterable[dict]) -> int:
    """Delete existing records with the same (game_id, player_id) as `rows`."""
    by_game: Dict[str, set] = {}
    for r in rows:
        by_game.setdefault(r["game_id"], set()).add(r["player_id"])
    if not by_game:
        return 0
    conds = [and_(GameRecord.game_id == g, GameRecord.player_id.in_(pids)) for g, pids in by_game.items()]
    deleted = 0
    for i in range(0, len(conds), 200):  # keep statements a sane size
        deleted += db.execute(delete(GameRecord).where(or_(*conds[i : i + 200]))).rowcount or 0
    return deleted


def bulk_insert(db: Session, rows: List[dict]) -> None:
    for i in range(0, len(rows), 1000):
        db.execute(insert(GameRecord), rows[i : i + 1000])


def save_records(db: Session, items: Sequence[GameRecordIn], mode: str = "append") -> Tuple[int, int]:
    """Insert records in one transaction. Returns (inserted, replaced).

    mode="replace" swaps out the whole table; "append" overwrites only rows
    for the same player in the same game. Nothing is changed if anything fails.
    """
    try:
        if mode == "replace":
            rows = build_rows(items, PlayerIdAllocator())
            db.execute(delete(GameRecord))
            replaced = 0
        else:
            rows = build_rows(items, PlayerIdAllocator(db))
            replaced = delete_matching(db, rows)
        bulk_insert(db, rows)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return len(rows), replaced


# ---------------------------------------------------------------- CSV

_INT_LIKE = re.compile(r"^\d+\.0+$")


def parse_csv(content: bytes) -> Tuple[List[GameRecordIn], List[str]]:
    """Parse and validate a CSV. Raises CSVError listing bad rows; returns
    (records, warnings) when every row is valid."""
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise CSVError(["The file is not UTF-8 text. Re-save it as CSV (UTF-8)."]) from None
    try:
        df = pd.read_csv(io.StringIO(text), dtype=str, keep_default_na=False, skipinitialspace=True)
    except Exception as e:  # pandas raises several parser error types
        raise CSVError([f"Could not read the CSV: {e}"]) from None

    df.columns = [str(c).strip().lower() for c in df.columns]
    missing = [c for c in IDENTITY_FIELDS if c not in df.columns]
    if missing:
        raise CSVError([f"Missing required columns: {', '.join(missing)}"])
    if df.empty:
        raise CSVError(["The file has no data rows."])

    known = set(IDENTITY_FIELDS) | set(STAT_FIELDS) | {"player_id"}
    warnings = []
    unknown = [c for c in df.columns if c not in known]
    if unknown:
        warnings.append(f"Ignored unknown columns: {', '.join(unknown)}")
    absent = [c for c in STAT_FIELDS if c not in df.columns]
    if absent:
        warnings.append(f"Columns not in the file were set to 0: {', '.join(absent)}")

    items, errors = [], []
    for line, row in enumerate(df.to_dict(orient="records"), start=2):  # line 1 is the header
        data = {k: str(v).strip() for k, v in row.items() if k in known}
        for k in STAT_FIELDS:
            v = data.get(k, "")
            data[k] = "0" if v == "" else (v.split(".")[0] if k != "innings_pitched" and _INT_LIKE.match(v) else v)
        if not data.get("player_id"):
            data.pop("player_id", None)
        try:
            items.append(GameRecordIn(**data))
        except ValidationError as e:
            errors.append(f"Row {line}: {format_validation_error(e)}")
            if len(errors) >= 25:
                errors.append("Stopped after 25 errors.")
                break
    if errors:
        raise CSVError(errors)
    return items, warnings


# ---------------------------------------------------------------- seeding


def seed_sample_data(db: Session) -> int:
    """Load data/sample_data.csv if the table is empty. Returns rows loaded."""
    if db.scalar(select(func.count()).select_from(GameRecord)):
        return 0
    if not SAMPLE_DATA_PATH.exists():
        logger.warning("Sample data not found at %s", SAMPLE_DATA_PATH)
        return 0
    items, _ = parse_csv(SAMPLE_DATA_PATH.read_bytes())
    inserted, _ = save_records(db, items, mode="replace")
    logger.info("Loaded %d sample records", inserted)
    return inserted
