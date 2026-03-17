"""
Standalone script to initialize the database and load sample data.
Run from the project root:
    python backend/init_db.py
"""
import sys
import os

# Allow running from project root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from pathlib import Path

from backend.database import engine, SessionLocal, Base
from backend.models.game_record import GameRecord


def init_db():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created.")

    db = SessionLocal()
    try:
        existing = db.query(GameRecord).count()
        if existing > 0:
            print(f"Database already contains {existing} records. Skipping load.")
            return

        csv_path = Path(__file__).parent.parent / "data" / "sample_data.csv"
        if not csv_path.exists():
            print(f"ERROR: sample_data.csv not found at {csv_path}")
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
        print(f"Successfully loaded {len(df)} records into the database.")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
