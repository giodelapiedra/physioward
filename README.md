# PhysioWard CEO Dashboard v2
## Localhost Setup Guide

---

## What this builds
- ✅ Login screen (CEO only)
- ✅ Clinic selector — Newport / Narrabeen / Brookvale
- ✅ Month + year selector
- ✅ Fetch button → pulls all 5 weeks from Nookal automatically
- ✅ Exact CEO Dashboard layout — same columns as your Google Sheet
- ✅ JWT auth with auto token refresh

---

## Requirements
- Node.js 18+ (`node --version`)
- PostgreSQL 13+ running locally on port 5432 with a database named `nookal`
- Your Nookal API key
- Your Nookal location IDs (one per clinic)

Create the database once:
```bash
createdb -U postgres nookal
# or in psql:  CREATE DATABASE nookal;
```

---

## Setup — One Time Only

### Step 1 — Backend
```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` and fill in:
```
DATABASE_URL=postgres://postgres:YOUR_PG_PASSWORD@localhost:5432/nookal

NOOKAL_API_KEY=your_actual_key
NOOKAL_LOCATION_NEWPORT=your_newport_id
NOOKAL_LOCATION_NARRABEEN=your_narrabeen_id
NOOKAL_LOCATION_BROOKVALE=your_brookvale_id

CEO_EMAIL=sam@physioward.com.au
CEO_PASSWORD=YourSecurePassword123!

JWT_SECRET=run_this_and_paste_result: openssl rand -base64 32
```

Migrations run automatically on first boot. The initial CEO user is seeded
from `CEO_EMAIL` / `CEO_PASSWORD` (bcrypt-hashed) — change the password in-app
after first login.

### Step 2 — Frontend
```bash
cd frontend
npm install
```

---

## Run Locally (every time)

**Terminal 1:**
```bash
cd backend
npm run dev
# → http://localhost:3001
```

**Terminal 2:**
```bash
cd frontend
npm run dev
# → http://localhost:5173
```

Open **http://localhost:5173** and log in.

---

## How to use

1. **Log in** with your CEO email and password
2. Click a **clinic** (Newport / Narrabeen / Brookvale)
3. Select **Month** and **Year**
4. Click **↓ Fetch Data**
5. All 5 weeks auto-populate from Nookal:
   - Week 1 [6-10]
   - Week 2 [13-17]
   - Week 3 [20-24]
   - Week 4 [27-30]
   - Remainder [1-3]
   - Monthly Actual (auto-calculated)

---

## Architecture

```
Browser (localhost:5173)
    │
    ├── Login → POST /api/auth/login → JWT in memory + httpOnly refresh cookie
    │
    └── Fetch Data → GET /api/dashboard/monthly?clinic=newport&month=4&year=2026
                          │
                          ▼
                    Node.js Backend (localhost:3001)
                      routes/ → services/ → repositories/ → db/
                          │
                          ├── Auth middleware (verify JWT)
                          ├── dashboardService.getMonthly()
                          │     │
                          │     ├── 1. snapshotRepository.find()
                          │     │      └── HIT (fresh) → return cached payload
                          │     │
                          │     └── 2. MISS/stale → fetch from Nookal (5 wks parallel)
                          │            → calculateKPIs()
                          │            → snapshotRepository.upsert()
                          │            → return
                          ▼
                    PostgreSQL (localhost:5432 / nookal)
                      users, refresh_tokens, dashboard_snapshots, audit_log
```

### Backend layout (senior-style layering)

```
backend/src/
├── config/env.ts              # validated env (zod) — fail-fast on boot
├── db/
│   ├── pool.ts                # pg.Pool singleton + withTransaction helper
│   ├── migrate.ts             # runs on startup, idempotent
│   ├── seed.ts                # seeds initial CEO user
│   └── migrations/001_init.sql
├── repositories/              # all SQL lives here
│   ├── user.repository.ts
│   ├── refresh-token.repository.ts   # tokens stored as sha256 hash
│   └── snapshot.repository.ts        # cached dashboards
├── services/                  # business logic — no SQL, no HTTP
│   ├── auth.service.ts        # bcrypt + JWT + refresh rotation
│   ├── dashboard.service.ts   # cache-aware Nookal fetch
│   ├── nookal.service.ts      # paginated external API
│   ├── kpi.calculator.ts
│   └── week.calculator.ts
├── routes/                    # HTTP only — validate → call service → respond
├── middleware/
└── index.ts                   # migrate → seed → listen → graceful shutdown
```

### Caching

A monthly dashboard response is cached in `dashboard_snapshots` keyed on
`(clinic_id, year, month)`. Within `SNAPSHOT_TTL_MINUTES` (default 60),
subsequent requests are served from Postgres without hitting Nookal.
Force a refresh with `?refresh=1`.

---

## Frontend layout

```
frontend/src/
├── App.tsx                  # auth guard + routing
├── api/
│   ├── client.ts            # axios + auto-refresh interceptor
│   └── dashboard.api.ts
├── store/auth.store.ts      # zustand auth state (access token in memory)
└── components/
    ├── Auth/LoginPage.tsx
    └── Dashboard/DashboardPage.tsx
```

---

## Next steps (when ready to upgrade)
1. ~~PostgreSQL — save snapshots, no re-fetch needed~~ ✅ done
2. Add Google Sheets write — auto-fill your existing sheets
3. Deploy to VPS with Nginx + SSL
4. Add monthly auto-create (new tab every 1st of month)
