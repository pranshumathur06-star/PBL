# EASE — Emergency Assistance & Smart Escalation

> **Demonstration project.** EASE connects emergency reports, location intelligence and human-led response coordination in one platform. It is a PBL prototype, not a real emergency service. **In an emergency in India, call 112.**

EASE has three parts that share one backend:

| Part | What it is | URL (local) |
|---|---|---|
| **Public site** | Marketing and explainer pages (Platform, Citizen, Command Centre, Intelligence, How it works, Trust, Contact) | `/` |
| **Citizen App** | Report an emergency as a guest or a logged-in citizen, then track it | `/app` |
| **Command Centre** | Staff console: triage queue, unit assignment, shortest-path routing, audit log, analytics | `/ops` |

---

## Why this project

Emergency reports often arrive incomplete, get mis-prioritised, or reach the wrong responder. EASE shows how a report can be captured in seconds, triaged by severity, matched to the **nearest suitable response unit using Dijkstra's shortest-path algorithm**, and tracked end to end. A human operator stays in control of every decision; the system only assists.

## Features

**Citizen App**
- Guest reporting with no login, OTP, GPS or photo required. Risk signals never block a report.
- Report categories: medical, accident, fire, flood, theft, violence, EV.
- `urgency = life` is always treated as **Critical**; otherwise a keyword heuristic assigns High / Medium / Low.
- Pick a nearby area on the sample Dehradun map; after sending, see the **3 nearest hospitals, police and fire stations** with distance, ETA and helpline (108 / 100 / 101).
- Track a report by code, reply to operators, cancel while still *Reported* or *Acknowledged*.
- Optional citizen account with demo OTP (no SMS is sent; the code is shown on screen).

**Command Centre**
- Live triage queue with filters (status, severity, category, search).
- **Live critical alerts:** polls every 5 s, shows a red banner, plays a two-tone chime and shows a count in the tab title when a new Critical report arrives.
- Incident actions: acknowledge, review, change status or priority, assign a unit, add notes, reply to the citizen, flag, link duplicates, resolve, close, reopen.
- Unit assignment checks the service matches the category (medical/accident → ambulance, fire/flood → fire, theft/violence → police, EV → mechanic) and computes the shortest path.
- Analytics, full **audit trail** (actor, role, action, target, reason, previous → next) and user/role management.
- Server-enforced **role-based access control**: Read-only analyst, Dispatcher, Supervisor, Admin.

**Routing engine**
- Dijkstra's algorithm (binary heap, `heapq`) over a **120-node / 156-edge sample road graph of Dehradun** with 15 facilities.
- Returns distance (km), ETA (assumed ~21 km/h average, no live traffic), the path, nodes settled and compute time.
- Interactive visualisation of the shortest path on the homepage and Intelligence page.

## Incident life-cycle

```
Reported → Acknowledged / Under review → Assigned → En route → On scene → Resolved → Closed
                         ↑                                                     │
                         └──────────────────── Reopen ─────────────────────────┘
```

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11+, FastAPI, Pydantic v2, Motor (async MongoDB), Uvicorn |
| Database | MongoDB (collections: users, sessions, otps, reports, units, audit, messages) |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, shadcn-style components, TanStack Query, React Router, Recharts, Motion |
| Auth | httpOnly session cookie (8 h), PBKDF2-SHA256 (120k iterations), lock-out for 5 min after 5 failed logins |
| Algorithms | Dijkstra shortest path, keyword-based severity heuristic |

## Project structure

```
.
├── backend/
│   ├── server.py            # FastAPI app, CORS, router mounting (/api)
│   ├── seed.py              # idempotent demo data (units, sample incidents, staff)
│   ├── routers/             # auth, reports, ops, graph (routing), messages
│   ├── models/ease.py       # Pydantic request/response models
│   ├── lib/
│   │   ├── routing.py       # Dijkstra, ETA, nearest facilities
│   │   ├── city_graph.py    # Dehradun sample graph + facilities
│   │   ├── security.py      # hashing, sessions
│   │   ├── audit.py         # audit-log helper
│   │   └── db.py            # MongoDB connection and indexes
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/           # Home, Platform, Citizen, CitizenApp, CommandCentreOps, Login, ...
│   │   ├── components/      # site layout, viz (maps, pipeline), ui primitives
│   │   ├── hooks/           # useSession, useCriticalAlerts
│   │   └── lib/             # api client, areas, query client
│   └── vite.config.ts       # dev server on :3000, proxies /api to :8001
├── memory/SPEC.md           # detailed spec: routes, data model, business rules
└── reference/               # original single-file HTML prototype
```

## Getting started

### Prerequisites
- **Node.js** 20+ and npm
- **Python** 3.11+
- **MongoDB** running locally on `localhost:27017` (MongoDB Community as a service, Docker, or an Atlas URI)

### 1. Backend

Create `backend/.env`:

```env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="ease"
CORS_ORIGINS="http://localhost:3000"
APP_TZ="Asia/Kolkata"
```

Then, from the `backend` folder:

```bash
python -m venv .venv
# Windows:      .venv\Scripts\activate
# macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt
python seed.py                                   # load demo data (safe to re-run)
uvicorn server:app --port 8001 --reload
```

The API is now at `http://localhost:8001/api`.

### 2. Frontend

In a second terminal, from the `frontend` folder:

```bash
npm install
npm run dev
```

Open **http://localhost:3000**. The dev server proxies every `/api/*` request to the backend on port 8001, so the frontend never uses an absolute backend URL.

### Demo accounts (created by `seed.py`)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@ease.demo` | `EaseDemo112` |
| Dispatcher | `dispatcher@ease.demo` | `EaseDemo112` |
| Read-only analyst | `analyst@ease.demo` | `EaseDemo112` |

Staff sign in at `/login` (Staff / Command Centre tab) and land on `/ops`. Citizens can register at `/login`; the demo OTP is shown on screen. The Citizen App at `/app` works without any login. These credentials are for local demos only.

## API overview

All routes are under `/api`. See `memory/SPEC.md` for the full list.

| Area | Endpoints |
|---|---|
| Routing | `GET /routing/graph`, `GET /routing/route`, `GET /routing/route/nodes`, `GET /routing/nearby` |
| Auth | `POST /auth/citizen/otp`, `/auth/citizen/register`, `/auth/citizen/login`, `/auth/staff/login`, `GET /auth/me`, `POST /auth/logout` |
| Reports (citizen) | `POST /reports`, `GET /reports/mine`, `GET /reports/{code}`, `POST /reports/{code}/cancel`, `/reply` |
| Operations (staff) | `GET /ops/queue`, `GET /ops/incident/{code}`, `POST /ops/incident/{code}/{ack\|status\|priority\|assign\|resolve\|close\|reopen\|note\|reply\|review\|flag\|link}`, `GET /ops/units`, `/audit`, `/analytics`, `/users` |
| Contact | `POST /contact` |

With the backend running, interactive API docs are available at `http://localhost:8001/docs`.

## Seed data

`python seed.py` creates 8 response units (4 ambulances, 2 fire, 2 police), 8 clearly labelled sample incidents (`SAMPLE-101` to `SAMPLE-108`), audit history and the three demo staff accounts. It is idempotent, so re-running it will not duplicate data.

## Limitations (honest notes)

- The map is an **illustrative, hand-drawn sample graph of Dehradun**, not a navigation-grade map. Distances are true shortest paths on that graph; ETAs assume ~21 km/h and ignore live traffic.
- No SMS, email or real emergency-service integration. OTP codes are shown on screen and contact messages are only stored.
- Sample incidents, units and facilities are demo data.
- Intended for local demonstration; it has not been hardened for production use.

## Team

Team ID : DSCPP-2026-T089
Members
Abhinav Semwal
Arpita Gupta
Pranshu Mathur
Goyam Jain


## Acknowledgements

Built as a Project-Based Learning (PBL) project for the Data Structures in C and OOP in C++ course. The scaffold was generated with Emergent and then customised.

