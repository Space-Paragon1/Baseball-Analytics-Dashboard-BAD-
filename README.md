# Baseball Analytics Dashboard (BAD)

A full-stack baseball statistics analytics platform featuring real-time data visualization, player leaderboards, pitching analytics, team performance tracking, player comparison, export reports, dark/light mode, live game entry, JWT authentication, and PostgreSQL support.

---

## Tech Stack

| Layer     | Technology                                                      |
|-----------|-----------------------------------------------------------------|
| Backend   | Python 3.11+, FastAPI, SQLAlchemy, SQLite / PostgreSQL, Pandas  |
| Frontend  | Next.js 14, TypeScript, Tailwind CSS, Recharts                  |
| Charts    | Recharts (Bar, Line, Pie, Radar)                                |
| Icons     | Lucide React                                                    |
| Auth      | JWT (python-jose), bcrypt (passlib)                             |
| Export    | reportlab (PDF), CSV streaming                                  |

---

## Features

- **Dashboard** — League KPIs (games, runs, batting avg), auto-generated insights, recent trend charts, top-5 batters, date range filtering
- **Player Analytics** — Searchable/filterable leaderboard, expandable player rows with trend charts, Export PDF / CSV
- **Pitching Analytics** — ERA/WHIP/K9 leaderboard, strikeout vs walks charts, ERA trend line, Export CSV
- **Team Analytics** — Team cards with season stats, expandable roster tables, run contribution pie chart
- **Upload Data** — Drag & drop CSV upload with validation, sample template download
- **Auto-Insights** — Backend generates English-language insights from stats
- **Player Comparison** — Side-by-side stat table with best-value highlighting, grouped bar chart, radar chart
- **Export Reports** — CSV downloads for batting/pitching leaderboards, PDF player cards via reportlab
- **Dark / Light Mode** — Toggle persisted to localStorage, applies `dark` class to HTML root
- **Manual Data Entry** — Form-based game record entry with autocomplete player names
- **Unit Tests** — pytest tests for analytics service and API routes (12+ tests)
- **Date Range Filtering** — Filter dashboard, batting, and pitching stats by start/end date
- **Game Mode** — Live at-bat and pitch logging with running scoreboard, save to database
- **Authentication (JWT)** — Register / Login / Logout, Bearer token, user display in navbar
- **PostgreSQL Support** — `DATABASE_URL` env var selects SQLite (default) or PostgreSQL

---

## Project Structure

```
Baseball-Analytics-Dashboard-BAD-/
├── data/
│   └── sample_data.csv
├── backend/
│   ├── main.py                  # FastAPI app, startup, CORS
│   ├── database.py              # SQLAlchemy engine (SQLite/PostgreSQL)
│   ├── init_db.py
│   ├── requirements.txt
│   ├── .env.example             # Environment variable template
│   ├── models/
│   │   ├── game_record.py
│   │   └── user.py              # JWT User model
│   ├── routes/
│   │   ├── players.py           # /players + /players/compare
│   │   ├── teams.py
│   │   ├── stats.py             # /stats/* with date filtering
│   │   ├── upload.py            # /upload-csv + /add-game-record
│   │   ├── export.py            # /export/* CSV/PDF
│   │   ├── game_mode.py         # /game-mode/* live entry
│   │   └── auth.py              # /auth/register, /auth/login, /auth/me
│   ├── services/
│   │   ├── analytics.py
│   │   └── auth_service.py      # JWT helpers
│   └── tests/
│       ├── __init__.py
│       ├── test_analytics.py
│       └── test_routes.py
└── frontend/
    ├── pages/
    │   ├── index.tsx            # Dashboard with date picker
    │   ├── players.tsx          # Batting leaderboard + Export CSV/PDF
    │   ├── pitching.tsx         # Pitching leaderboard + Export CSV
    │   ├── teams.tsx
    │   ├── upload.tsx
    │   ├── compare.tsx          # Player comparison tool
    │   ├── add-game.tsx         # Manual data entry form
    │   ├── game-mode.tsx        # Live game logging
    │   ├── login.tsx
    │   └── register.tsx
    ├── components/
    │   ├── Layout.tsx
    │   ├── Sidebar.tsx          # All nav items including new pages
    │   ├── Navbar.tsx           # Theme toggle + auth display
    │   ├── StatsCard.tsx
    │   ├── InsightsPanel.tsx
    │   ├── LoadingSpinner.tsx
    │   ├── ErrorMessage.tsx
    │   ├── ExportButton.tsx     # Reusable export button
    │   ├── DateRangePicker.tsx  # From/To date filter
    │   └── Charts/
    │       ├── BarChart.tsx
    │       ├── LineChart.tsx
    │       └── PieChart.tsx
    ├── context/
    │   ├── ThemeContext.tsx      # Dark/light mode
    │   └── AuthContext.tsx      # JWT auth state
    ├── types/index.ts
    ├── utils/api.ts
    └── styles/globals.css
```

---

## Setup & Installation

### Prerequisites

- Python 3.11+
- Node.js 18+
- npm or yarn

### Backend Setup

```bash
# From project root
cd backend

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate     # Linux/macOS
venv\Scripts\activate        # Windows

# Install dependencies
pip install -r requirements.txt

# Optional: copy and configure env file
cp .env.example .env
# Edit .env with your settings

# Start the API server (from project root)
uvicorn backend.main:app --reload --port 8000
```

The backend automatically loads `data/sample_data.csv` on first startup if the database is empty.

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

Frontend runs at: `http://localhost:3000`
Backend API runs at: `http://localhost:8000`

---

## PostgreSQL Setup

To use PostgreSQL instead of SQLite:

1. Create a PostgreSQL database:
   ```sql
   CREATE DATABASE baseball_db;
   ```

2. Create a `.env` file in `backend/`:
   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/baseball_db
   SECRET_KEY=your-secret-key-here
   ```

3. Install psycopg2 (included in requirements.txt):
   ```bash
   pip install psycopg2-binary
   ```

4. Start the backend — tables will be auto-created.

---

## Authentication

The app uses optional JWT authentication (data endpoints are public by default).

- **Register**: `POST /auth/register` — `{ username, email, password }`
- **Login**: `POST /auth/login` — `{ username, password }` → returns `access_token`
- **Protected**: `GET /auth/me` — requires `Authorization: Bearer <token>` header

The frontend stores the token in `localStorage` and attaches it to all axios requests.

---

## Running Tests

```bash
# From project root
pytest backend/tests/ -v
```

Tests cover: batting average, OBP, SLG, OPS, ERA, WHIP, division-by-zero, insights, team stats, empty DataFrames, and all API routes.

---

## API Endpoints

### Health
| Method | Endpoint  | Description        |
|--------|-----------|--------------------|
| GET    | /health   | API health check   |

### Players
| Method | Endpoint                        | Description                            |
|--------|---------------------------------|----------------------------------------|
| GET    | /players                        | All players with batting stats         |
| GET    | /players/compare                | Compare 2-3 players (`?players=Name1&players=Name2`) |
| GET    | /players/{player_name}          | Single player detail                   |
| GET    | /players/{player_name}/trend    | Performance trend (`?stat=...`)        |

### Teams
| Method | Endpoint                       | Description                    |
|--------|--------------------------------|--------------------------------|
| GET    | /teams                         | All teams with aggregated stats |
| GET    | /teams/{team_name}             | Team detail with roster        |
| GET    | /teams/{team_name}/games       | Game-by-game results           |

### Stats
| Method | Endpoint            | Description                                                          |
|--------|---------------------|----------------------------------------------------------------------|
| GET    | /stats/batting      | Batting leaderboard (`?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`)  |
| GET    | /stats/pitching     | Pitching leaderboard (optional date params)                          |
| GET    | /stats/insights     | Auto-generated insight strings                                       |
| GET    | /stats/dashboard    | Full dashboard data (optional date params)                           |

### Upload & Data Entry
| Method | Endpoint          | Description                                 |
|--------|-------------------|---------------------------------------------|
| POST   | /upload-csv       | Upload CSV file to replace data             |
| POST   | /add-game-record  | Manually add a single game record (JSON)    |

### Export
| Method | Endpoint                          | Description                       |
|--------|-----------------------------------|-----------------------------------|
| GET    | /export/batting-csv               | Download batting leaderboard CSV  |
| GET    | /export/pitching-csv              | Download pitching leaderboard CSV |
| GET    | /export/player-pdf/{player_name}  | Download player card PDF          |

### Game Mode
| Method | Endpoint                          | Description                       |
|--------|-----------------------------------|-----------------------------------|
| POST   | /game-mode/start                  | Start a new game session          |
| POST   | /game-mode/at-bat                 | Log an at-bat event               |
| POST   | /game-mode/pitch                  | Log a pitch event                 |
| GET    | /game-mode/{game_id}/scoreboard   | Get current game scoreboard       |
| POST   | /game-mode/{game_id}/save         | Save all records to database      |

### Authentication
| Method | Endpoint        | Description                               |
|--------|-----------------|-------------------------------------------|
| POST   | /auth/register  | Register new user → returns JWT token     |
| POST   | /auth/login     | Login → returns JWT token                 |
| GET    | /auth/me        | Get current user (requires Bearer token)  |

---

## Analytics Formulas

| Stat           | Formula                                                                 |
|----------------|-------------------------------------------------------------------------|
| Batting Average| Hits / At-Bats                                                          |
| OBP            | (H + BB + HBP) / (AB + BB + HBP)                                       |
| SLG            | (1B + 2×2B + 3×3B + 4×HR) / AB                                        |
| OPS            | OBP + SLG                                                               |
| ERA            | (Earned Runs × 9) / Innings Pitched                                     |
| WHIP           | (BB + H Allowed) / Innings Pitched                                      |
| K/9            | (Strikeouts × 9) / Innings Pitched                                      |
| BB/9           | (Walks × 9) / Innings Pitched                                           |

---

## Color Scheme

- Primary: `#1e40af` (blue-800)
- Sidebar: `#0f172a` (slate-900)
- Charts: `#3b82f6`, `#10b981`, `#f59e0b`, `#ef4444`, `#8b5cf6`
- Dark bg: `#0f172a`, Dark card: `#1e293b`

---

## License

See `LICENSE` file.
