# LabLink — Making College Laboratories More Accessible

GenAI-powered campus laboratory resource-sharing platform for **PromptWars × Cynergy Coding Club**.

LabLink is a **universal** lab operations layer: ideation studios, electronics benches, chemistry suites, physics optics, biotech containment, fabrication shops, HPC nodes, materials cleanrooms, robotics arenas, and cross-disciplinary bays.

## Problem statement alignment

| PS need | LabLink delivery |
|---|---|
| Discover lab resources campus-wide | Student **Explore** — all 12 lab typologies |
| Book / request equipment | **Use in Lab** + **Borrow** (competition fields, no student AI) |
| Faculty / admin approvals | **Approvals** queue scoped to managed labs; `SUPER_ADMIN` campus-wide |
| GenAI fair allocation | Staff **Equipment AI** — heuristic scorer + optional Gemini |
| Conflicts & utilization | Conflicts resolve + utilization analytics |
| Dual dashboards | Student workspace vs Ops Hub / Timetable desk |
| Accountability | Handover / return, incidents, admin-set fines, training gates |

## Architecture

```
src/
  app/api/          # Route handlers — Zod validation, session auth, rate limits
  app/student/      # Student dashboard (discovery, bookings, exams, timetable)
  app/admin/        # Faculty / admin / coordinator ops
  lib/
    store.ts        # Domain logic + JSON persistence
    scope.ts        # Lab scoping / role helpers
    ai.ts           # Fair allocation heuristic (+ optional Gemini)
    validate.ts     # Zod schemas for mutating APIs
    api.ts          # requireSession / requireStaff / jsonError / rateLimit
    seed.ts         # Demo personas & campus seed data
```

- **Persistence:** file-backed JSON under `LABLINK_DATA_DIR` (default `.data/`)
- **Auth:** demo persona gate → single server session (`sessionUserId`); mutations always resolve the actor from the server session, never from client-supplied role/actorId
- **Scope:** `managedLabIds` for faculty/admin; timetable coordinators publish schedules campus-wide but do not run custody AI

## Quick start

```bash
npm install
npm run reset-data   # optional: wipe .data and reseed on next boot
npm run dev -- -p 3000
```

Open [http://localhost:3000](http://localhost:3000) → **Enter campus** → choose **Student** or **Teacher/Admin** → pick a persona.

### Demo path (5 minutes)

1. **Priya Nair (Student)** → Explore → Use in Lab / Borrow on Electronics gear → My Requests  
2. **Prof. Marcus Chen (Faculty)** → Approvals → filter Borrow / In-lab → Approve / Needs info / Handover  
3. Switch back to **Priya** → Bookings / Notifications reflect decisions; My Lab Timetable shows enrolled classes only  
4. **Marcus** → Exams → Generate list (Individual/Group) → Save → Start the test → Priya **My Examinations**  
5. **Coordinator Leah** → Timetable desk → publish session → appears on Marcus lab TT + enrolled students’ My TT  
6. **Dr. Aisha Rahman** → campus-wide Approvals / Policies / Import  

### Demo personas

| Persona | Role | Scope |
|---|---|---|
| Priya Nair | Student | All labs (discovery) |
| Arjun Mehta | Student | All labs; outstanding fine |
| Sara Al-Hassan | Student | All labs |
| Prof. Marcus Chen | Faculty | Electronics + Robotics only |
| Dr. Meera Kapoor | Faculty | Biotech only |
| Prof. Rajesh Iyer | Lab admin | Chemistry + Materials |
| Prof. Nina Soto | Faculty | Fab + Ideation + Cross-lab |
| Dr. Omar Farouk | Faculty | Physics + Optics |
| Prof. Helen Park | Faculty | Mechanical + HPC |
| Coordinator Leah Okonkwo | Timetable coordinator | Campus schedule desk |
| Dr. Aisha Rahman | Super admin | Campus-wide |

## Environment variables

See `.env.example`:

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Optional — narrative enrichment on `/api/ai/allocate` |
| `LABLINK_DATA_DIR` | JSON store path (Cloud Run / Vercel: `/tmp/lablink-data`) |
| `PORT` | HTTP port (`scripts/start.mjs` binds `0.0.0.0`) |

Never commit real API keys. The repo ships only `.env.example`.

**Vercel note:** the filesystem is ephemeral. JSON under `LABLINK_DATA_DIR` is wiped on cold starts / new instances; the app reseeds demo data when empty. Use a database for durable persistence.

## Security notes

- Zod validation on mutating routes (`src/lib/validate.ts`)
- Staff/student mutations resolve identity from **server session**
- Students cannot read other students’ bookings, fines, exams, or notifications
- `/api/reset` is `SUPER_ADMIN` only
- In-memory rate limits on hot endpoints (demo-scale)
- Text sanitization strips control characters; errors do not return stacks

## Tests

```bash
npm test
```

Runs four suites (see [TESTING.md](./TESTING.md)): validation, lab scoping, GenAI allocator, booking/timetable/exam store flows.

## Production

```bash
npm run build
PORT=3000 npm start   # uses scripts/start.mjs (standalone + static copy)
```

**Vercel:** default Next.js output (no `output: "standalone"`). Set `DOCKER_BUILD=1` only for Docker/Cloud Run builds. Prefer `LABLINK_DATA_DIR=/tmp/lablink-data`. Data resets when instances recycle unless you add a DB.

Cloud Run: bind `0.0.0.0:$PORT`, set `LABLINK_DATA_DIR` to a mounted volume for durability. `DOCKER_BUILD=1` enables standalone output.

```bash
gcloud builds submit --tag gcr.io/PROJECT_ID/lablink
gcloud run deploy lablink \
  --image gcr.io/PROJECT_ID/lablink \
  --platform managed \
  --allow-unauthenticated \
  --region REGION \
  --port 8080
```

## Efficiency notes

- Domain logic stays in `store` / `scope` / `ai` — no ORM or heavy client state libraries  
- `cn()` is a local one-liner (no runtime clsx requirement in app code)  
- Dates use `Intl` (`format.ts`) rather than a date library in the hot path  
- Optional packages still listed in `package.json` (`date-fns`, `lucide-react`, `clsx`) are unused by app source and safe to prune when packaging for Cloud Run  

## Stack

Next.js 14 · TypeScript · Tailwind CSS · Zod · File-backed JSON store · Optional Gemini
