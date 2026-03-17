import os
import pandas as pd
from pathlib import Path
from contextlib import asynccontextmanager

# Load .env file if python-dotenv is available
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.database import engine, SessionLocal, Base
from backend.models.game_record import GameRecord
from backend.models.user import User
from backend.routes import players, teams, stats, upload
from backend.routes import export, game_mode, auth


def load_sample_data():
    """Load sample_data.csv into the database if it is empty."""
    db = SessionLocal()
    try:
        count = db.query(GameRecord).count()
        if count > 0:
            return

        csv_path = Path(__file__).parent.parent / "data" / "sample_data.csv"
        if not csv_path.exists():
            print(f"[startup] sample_data.csv not found at {csv_path}")
            return

        df = pd.read_csv(csv_path)
        df["game_date"] = pd.to_datetime(df["game_date"]).dt.date

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

        db.commit()
        print(f"[startup] Loaded {len(df)} records from sample_data.csv")
    except Exception as e:
        print(f"[startup] Error loading sample data: {e}")
        db.rollback()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    load_sample_data()
    yield


app = FastAPI(
    title="Baseball Analytics Dashboard API",
    description="Backend API for the Baseball Analytics Dashboard (BAD)",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(players.router, tags=["Players"])
app.include_router(teams.router, tags=["Teams"])
app.include_router(stats.router, tags=["Stats"])
app.include_router(upload.router, tags=["Upload"])
app.include_router(export.router, tags=["Export"])
app.include_router(game_mode.router, tags=["Game Mode"])
app.include_router(auth.router, tags=["Auth"])


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "Baseball Analytics Dashboard API"}
