# EASE — Emergency Assistance & Smart Escalation (SPEC)

A multi-page emergency-response platform rebuilt from the user's single-file HTML demo. The public marketing site, the Citizen App and the Command Centre now run on FastAPI + MongoDB; before, everything lived in the browser's localStorage. Indian context throughout (112). Everything simulated is labelled.

## Routes (frontend)
Marketing: `/`, `/platform`, `/citizen`, `/command-centre`, `/intelligence`, `/how-it-works`, `/trust`, `/contact`, `/login`
Apps: `/app` is the Citizen App (guest by default). `/ops` is the Command Centre (staff only; anyone else sees a sign-in gate).

## Backend (all under /api)
- `routing`: `GET /routing/graph` returns the 120-node / 156-edge Dehradun sample graph plus 15 facilities. `GET /routing/route`, `GET /routing/route/nodes` run Dijkstra (distance_km, eta_min at ~21 km/h, path, points, settled, compute_ms).
- `auth`: `POST /auth/citizen/otp` returns the demo OTP code (no SMS is sent). Also `/auth/citizen/register`, `/auth/citizen/login`, `/auth/staff/login`, `/auth/staff/bootstrap` (the first staff account becomes Admin, only when no staff exists), `GET /auth/me`, `POST /auth/logout`. Sessions are httpOnly cookies (`ease_session`, 8 h). Passwords use PBKDF2-SHA256 with 120k iterations. Logins lock for 5 min after 5 failures.
- `reports` (citizen): `POST /reports` needs no auth. `GET /reports/mine` (citizen). `GET /reports/{code}?phone=` returns the full view to the owner/staff, otherwise a limited timeline. `POST /reports/{code}/cancel` works only while the report is Reported/Acknowledged. `POST /reports/{code}/reply`.
- `ops` (staff): `GET /ops/queue?status&severity&category&q`, `GET /ops/incident/{code}`.
  - Incident actions are POSTs on `/ops/incident/{code}/`: `ack`, `status`, `priority`, `assign`, `resolve`, `close`, `reopen`, `note`, `reply`, `review`, `flag`, `link`.
  - Units: `GET /ops/units`, `POST /ops/units/{id}/status|active`.
  - `GET /ops/audit`, `GET /ops/analytics`, `GET /ops/users`, `POST /ops/users/{id}/role|disabled` (Admin only, last-admin protected).
- `routing/nearby`: `GET /routing/nearby?node=&types=hospital,police,fire&limit=3` ranks sample facilities by Dijkstra km from the report's node (one Dijkstra run). It returns name, type, km, eta, helpline (108 / 100 / 101) and route points. `ReportPublic` now exposes `node`.
- `contact`: `POST /contact` stores the message. No email is sent, and the UI says so.

## Data model (Mongo collections)
users, sessions (TTL), login_fails, otps (TTL), reports, units, audit, messages. Pydantic models are in `backend/models/ease.py`. The TS mirrors are in `frontend/src/types.ts`.

## Business rules preserved from the original
- Guest reporting never needs auth, OTP, GPS or a photo. Risk signals NEVER block or reject a report.
- urgency=life is always Critical. Otherwise a keyword heuristic assigns High / Medium / Low.
- Status machine: Reported → Acknowledged / Under review → Assigned → En route → On scene → Resolved → Closed. Reopen goes back to Under review. Citizens can cancel only while Reported or Acknowledged.
- Assignment requires the unit's service to match the category (medical/accident → ambulance, fire/flood → fire, theft/violence → police, ev → mech). It computes shortest-path km. Reassigning frees the previous unit.
- RBAC (enforced on the server, deny-by-default):
  - Dispatcher: ack, review_st, prio, note, assign, link, resolve, unit, rview, flag
  - Supervisor: Dispatcher + rview2 (escalate) + reopen
  - Admin: everything + users
  - Read-only analyst: nothing
- Every mutation writes an audit row: actor, role, action, target, reason, prev → next.

## Seed (`cd /app/backend && python seed.py`, idempotent)
- 8 units: AMB-12/07/03/09, FIRE-04/02, PCR-03/11.
- 8 sample incidents, SAMPLE-101 … SAMPLE-108:
  - SAMPLE-101: Critical medical, Reported, has a staff reply.
  - SAMPLE-103: Critical fire, Reported.
  - SAMPLE-105: Assigned to FIRE-04.
  - SAMPLE-106: high risk, needs_review.
  - SAMPLE-107: Resolved.
- 3 demo staff accounts: see test_credentials.md.

## Live features (added in iteration 2)
- **Live Queue Alerts** (`/ops`, hook `useCriticalAlerts`): polls `/ops/queue?severity=Critical` every 5 s. The first load is the baseline, so existing reports raise no alerts. Any new active Critical report then gets:
  - a red banner (`ops-alert-{code}`) with "Review now", which opens the incident and dismisses the banner, and an × to dismiss;
  - a Web Audio two-tone chime, toggled by `ops-sound-toggle` and persisted in localStorage `ease.ops.sound`;
  - a `(n)` count in the tab title.
- **Nearby Facilities** (Citizen App `/app`): the optional "Nearest area on the sample map" select (`citizen-area-select`, 8 areas in `src/lib/areas.ts`) sets map_x / map_y. After the report is sent, and in Track, the `NearbyFacilities` panel shows the top 3 hospitals, police and fire stations with km, ETA and helpline, plus a zoomed route map. With no area picked, distances come from the city centre and the panel says they are approximate.
