# Baseball Analytics Dashboard (BAD)

A full-stack baseball stats app. Load box scores from a CSV, real MLB games, or a game you score live, and get leaderboards with advanced stats, standings, player trends, comparisons and exports.

![Dashboard](docs/screenshots/dashboard.png)

| Batting leaders | Game Mode | Teams (dark mode) |
| --- | --- | --- |
| ![Batting](docs/screenshots/batting.png) | ![Game Mode](docs/screenshots/game-mode.png) | ![Teams](docs/screenshots/teams-dark.png) |

---

## Features

**Analytics**
- **Dashboard**: league KPIs, standings, top hitters and pitchers, a scoring trend, and auto-generated insights in plain English.
- **Batting leaders**: AVG, OBP, SLG, OPS, wOBA, ISO, BABIP, K% and BB%. Sort any column; hover a header to see the formula.
- **Pitching leaders**: ERA, FIP, WHIP, K/9, BB/9, HR/9 and K/BB, with innings handled correctly (5.1 + 5.2 = 11.0).
- **Qualified leaders**: rate-stat leaderboards use MLB's rule (3.1 PA or 1 IP per team game, with a small minimum), so a 1-for-1 cameo can't top the list.
- **Player detail**: expand any row for a season-to-date trend, the last 10 games, and a PDF player card.
- **Teams & standings**: W-L, run differential, Pythagorean expected record, team batting and pitching, roster and game log.
- **Compare**: 2-3 players side by side, with the best value in each row highlighted.
- **Date filter**: shared across pages and applied everywhere, including insights and exports.

**Data**
- **MLB import**: pulls real box scores (regular season and postseason) from MLB's public Stats API, by date range and team.
- **Game Mode**: score a game one plate appearance at a time. It tracks runners, outs, innings, line score and RBIs, charges runs to the right pitcher, ends walk-offs correctly, and supports undo. Games are saved as you go and survive a refresh or restart.
- **Game Log**: search, filter, edit and delete individual box-score lines.
- **CSV upload**: every row is validated first, with row-by-row error messages. A bad file changes nothing. Choose append (updates matching rows) or replace.
- **Exports**: leaderboard CSVs (respecting filters) and PDF player cards.

**Platform**
- Sign-in with roles: anyone can view; signed-in users can add and edit; the admin (the first account) can delete, upload and import.
- Dark mode (no flash on load), mobile layout, keyboard focus styles, and a live API status indicator.
- SQLite by default, PostgreSQL via `DATABASE_URL`.
- Backend and frontend test suites, linting and a Docker build run in CI on every push.

## Tech stack

| Layer | Tech |
| --- | --- |
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2, pandas, Pydantic 2 |
| Auth | PyJWT (HS256), bcrypt |
| Frontend | Next.js 16 (Pages Router), React 19, TypeScript, Tailwind CSS, Recharts |
| Data | SQLite or PostgreSQL; MLB Stats API (via httpx) |
| Tooling | pytest, Ruff, Jest + Testing Library, ESLint, GitHub Actions, Docker |

---

## Quick start

### With Docker

```bash
cp .env.example .env          # then set SECRET_KEY (see the file for a one-liner)
docker compose up --build
```

Open http://localhost:3000. The API runs at http://localhost:8000 (interactive docs at http://localhost:8000/docs). The database lives in the `baseball_db` volume and starts with the sample data.

### Local development

**Backend** (from the project root):

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements-dev.txt
cp backend/.env.example backend/.env    # optional: set SECRET_KEY so sign-ins survive restarts
uvicorn backend.main:app --reload --port 8000
```

On first start the backend creates `baseball.db` in the project root and loads `data/sample_data.csv`. To do that by hand: `python -m backend.init_db`.

**Frontend:**

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

The frontend calls `http://localhost:8000` by default; set `NEXT_PUBLIC_API_URL` to change it.

### First steps

1. Create an account. **The first account becomes the admin.**
2. Try **MLB Import**: pick a team and "Last week", or a full season for one team.
3. Score a game in **Game Mode**, then find it in the **Game Log** and leaderboards.

---

## Configuration

Backend settings come from environment variables (or `backend/.env`):

| Variable | Default | What it does |
| --- | --- | --- |
| `SECRET_KEY` | random per process | Signs login tokens. **Set it in production**, or every restart signs everyone out. |
| `DATABASE_URL` | `sqlite:///<project>/baseball.db` | Any SQLAlchemy URL, e.g. `postgresql://user:pass@host:5432/db`. |
| `CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Comma-separated frontend origins allowed to call the API. |
| `ALLOW_REGISTRATION` | `true` | Set to `false` to close sign-ups once the admin exists. |
| `SEED_SAMPLE_DATA` | `true` | Load the sample CSV when the database is empty. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `720` | How long a sign-in lasts. |
| `MAX_UPLOAD_MB` | `10` | Largest CSV accepted. |

Frontend: `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`) is baked in at build time. In Docker, set `PUBLIC_API_URL` in `.env`.

> Upgrading from v2: the database schema changed (innings are now stored as outs, and there are new columns). Delete the old `baseball.db` and restart; the sample data reloads automatically.

## Permissions

| Action | Who |
| --- | --- |
| View stats, leaderboards, exports | Anyone |
| Add or edit records, use Game Mode | Signed-in users |
| Delete records, upload CSVs, import MLB data | Admin (the first account) |

The frontend hides what you can't do, and the API enforces the same rules.

---

## Data

### CSV format

Required columns, in any order: `player_name, team, position, game_date, game_id, opponent`.

Optional columns (missing or blank = 0): `player_id, at_bats, hits, doubles, triples, home_runs, runs, rbi, strikeouts, walks, hit_by_pitch, sacrifice_flies, innings_pitched, earned_runs, hits_allowed, walks_allowed, strikeouts_pitched, home_runs_allowed, hit_batsmen`.

- Dates are `YYYY-MM-DD`.
- **Innings use box-score notation**: `6.1` means 6⅓ innings and `6.2` means 6⅔. `6.5` is rejected.
- Each row is checked for consistency, e.g. hits ≤ at bats and home runs allowed ≤ hits allowed. Errors list the row number.
- A player is matched by name (and team). Add `player_id` to tell apart two players with the same name.
- One row per player per game. Re-uploading in "append" mode updates matching rows instead of duplicating them.

The Upload page has a template with every column.

### MLB import

Uses `statsapi.mlb.com`; no API key is needed. Up to 250 games per import, which fits a full season for one team. Players keep their MLB ids, and re-importing a game updates it. MLB data is © MLB Advanced Media and is for personal, non-commercial use under [MLB's terms](http://gdx.mlb.com/components/copyright.txt).

### Sample data

`data/sample_data.csv` holds 24 made-up games between three teams (Eagles, Tigers, Wolves).

---

## Stat glossary

| Stat | Formula |
| --- | --- |
| AVG | H / AB |
| OBP | (H + BB + HBP) / (AB + BB + HBP + SF) |
| SLG | TB / AB, where TB = 1B + 2×2B + 3×3B + 4×HR |
| OPS | OBP + SLG |
| ISO | SLG − AVG |
| BABIP | (H − HR) / (AB − K − HR + SF) |
| wOBA | (0.696·BB + 0.726·HBP + 0.883·1B + 1.244·2B + 1.569·3B + 2.004·HR) / PA (2023 FanGraphs weights) |
| K%, BB% | K / PA, BB / PA |
| ERA | 9 × ER / IP |
| WHIP | (BB + H) / IP |
| K/9, BB/9, HR/9 | 9 × stat / IP |
| FIP | (13·HR + 3·(BB + HBP) − 2·K) / IP + constant. The constant is calculated from the data so league FIP equals league ERA. |
| Pythag W% | RS^1.83 / (RS^1.83 + RA^1.83) |

Qualified for rate-stat leaderboards: batters need 3.1 PA per team game (at least 20); pitchers need 1 IP per team game (at least 10).

---

## API

Interactive docs: http://localhost:8000/docs. Main endpoints:

| Area | Endpoints |
| --- | --- |
| Lookup | `GET /meta`: teams, players, positions, date range |
| Stats | `GET /stats/dashboard`, `/stats/batting`, `/stats/pitching`, `/stats/insights`. All accept `start_date`, `end_date`; leaderboards also take `team` and `qualified_only`. |
| Players | `GET /players`, `/players/{id}`, `/players/{id}/trend?stat=ops`, `/players/compare?ids=1&ids=2` |
| Teams | `GET /teams`, `/teams/{name}`, `/teams/{name}/games` |
| Records | `GET /records` (search, filter, paginate), `POST /records`, `PUT /records/{id}`, `DELETE /records/{id}` |
| Bulk data | `POST /upload-csv` (form: `file`, `mode`), `POST /import/mlb`, `GET /import/mlb/teams?season=` |
| Game Mode | `POST /game-mode/start`, `GET /game-mode/sessions`, `GET /game-mode/{id}`, `POST /game-mode/{id}/pitcher`, `POST /game-mode/{id}/plate-appearance`, `POST /game-mode/{id}/undo`, `POST /game-mode/{id}/save`, `DELETE /game-mode/{id}` |
| Exports | `GET /export/batting-csv`, `/export/pitching-csv`, `/export/player-pdf/{id}` |
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `GET /auth/config` |

Send `Authorization: Bearer <token>` for protected endpoints.

---

## Testing

```bash
# Backend (from the project root). Uses an in-memory database, never your real one.
pytest
ruff check backend && ruff format --check backend

# Frontend
cd frontend
npm test
npm run lint
npm run typecheck
npm run build
```

GitHub Actions (`.github/workflows/ci.yml`) runs all of the above, plus a production dependency audit and a Docker build, on every push to `main` and every pull request.

## Project structure

```
backend/
  main.py              FastAPI app, CORS, startup (create tables, seed)
  config.py            settings from environment variables
  database.py          SQLAlchemy engine and session
  schemas.py           request/response models and validation rules
  models/              GameRecord, User, GameSession
  routes/              stats, players, teams, records, export, game_mode, mlb_import, auth, meta
  services/
    analytics.py       every stat calculation (vectorized pandas)
    records.py         loading, CSV parsing, player ids, safe inserts
    game_engine.py     Game Mode scoring rules (event replay)
    mlb_import.py      MLB Stats API client and box-score parser
    innings.py         innings notation <-> outs
    auth_service.py    hashing, tokens, permission checks
  tests/               pytest suite
frontend/
  pages/               one file per screen
  components/          tables, charts, forms, layout
  context/             auth, theme, toasts, shared data and date range
  hooks/useAsync.ts    data loading that ignores stale responses
  utils/               API client and number formatting
  __tests__/           Jest suite
data/sample_data.csv
docs/screenshots/
```

## Deployment notes

- Set `SECRET_KEY`, `CORS_ORIGINS` (your frontend URL) and, ideally, a PostgreSQL `DATABASE_URL`.
- Build the frontend with `NEXT_PUBLIC_API_URL` pointing at the public API URL.
- After creating your admin account, set `ALLOW_REGISTRATION=false` unless you want open sign-ups.
- Serve both over HTTPS. Tokens are kept in the browser's localStorage and sent as a bearer header.

## License

See `LICENSE`.
