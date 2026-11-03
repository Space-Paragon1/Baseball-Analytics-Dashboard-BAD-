import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import CORS_ORIGINS, SEED_MLB_END, SEED_MLB_START, SEED_MLB_TEAM_ID, SEED_SAMPLE_DATA, logger
from backend.database import SessionLocal, engine
from backend.migrate import DatabaseVersionError, migrate_database
from backend.routes import auth, export, game_mode, meta, mlb_import, players, records, stats, teams, users
from backend.services.records import seed_mlb_games, seed_sample_data

logging.basicConfig(level=logging.INFO, format="%(levelname)s [%(name)s] %(message)s")
for noisy in ("httpx", "httpx2"):
    logging.getLogger(noisy).setLevel(logging.WARNING)

API_VERSION = "3.2.0"


def init_database() -> None:
    try:
        migrate_database(engine)
    except DatabaseVersionError as exc:
        logger.error("Database not upgraded: %s", exc)
        raise
    with SessionLocal() as db:
        if SEED_MLB_START:
            seed_mlb_games(db, SEED_MLB_START, SEED_MLB_END, SEED_MLB_TEAM_ID)
        if SEED_SAMPLE_DATA:
            seed_sample_data(db)  # does nothing if MLB games loaded


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_database()
    yield


app = FastAPI(
    title="Baseball Analytics Dashboard API",
    description="Stats, leaderboards, live game scoring and MLB data import for the BAD dashboard.",
    version=API_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,  # auth uses a bearer token header, not cookies
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["Content-Disposition"],
)

for router in (meta, players, teams, stats, records, export, game_mode, mlb_import, auth, users):
    app.include_router(router.router)


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "Baseball Analytics Dashboard API", "version": API_VERSION}
