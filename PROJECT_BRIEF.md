# TimeSync — Complete Project Brief & Handoff Document

> **Living document.** Update this whenever a major decision changes.
> This is the single source of truth for any AI assistant, new contributor, or future session picking up this project.
> **To resume in Claude.ai:** paste the full contents of this file as your first message.

**Author:** Vimal De Souza  
**Backend:** Node.js + Express, Google OAuth2 (single file `server.js`)  
**Frontend (NEW):** React + Vite + TypeScript + Tailwind v4 + shadcn/ui in `web/` — the modern "high-end" UI  
**Legacy frontend:** Vanilla HTML/JS in `public/` — still works, being superseded by `web/`  
**Repo:** https://github.com/DESOUZAVIMAL/Faria-Dashboard (private)  
**Run backend:** `cd "timesync 2" && node server.js` → http://localhost:3000  
**Run modern frontend:** `cd "timesync 2/web" && npm run dev` → http://localhost:5173 (proxies /api & /auth to :3000)

---

## 1. Product Vision & Problem Statement

### The Problem
Professionals use 5–10 tools daily: Slack, Gmail, Zendesk, Google Sheets, Google Calendar. The result:
- You see a Slack message and forget to reply
- An email sits because you "meant to get to it"
- A Zendesk ticket was assigned — you never noticed
- A Google Sheet row needs your input by EOD — you missed it
- You have 4 free hours but can't find team overlap to schedule a call

**There is no single place that aggregates what needs YOUR action and tracks it until done.**

### The Solution
TimeSync is a **unified work dashboard for professionals** — one screen that:
1. **Ingests** from all tools (Gmail, Slack, Zendesk, Sheets, Calendar)
2. **Triages** every item into: 🔴 To finish / 🟠 Needs reply / 🔵 FYI
3. **Tracks** each item until marked done — nothing slips
4. **Shows** your day: agenda, free gaps, team timezone overlap
5. **Schedules** tasks into free gaps (creates real Google Calendar events)
6. **Briefs** you every morning on what matters today

### Secondary Feature: Team Timezone Gantt
See when everyone on your distributed team is available across timezones. Find overlap windows, schedule meetings, block focus time. Built for async-first remote teams.

---

## 2. Architecture Overview

### Tech Stack
```
Backend:   Node.js + Express (single file: server.js) — a pure JSON API
Auth:      Google OAuth2 → JWT in httpOnly cookie (30-day)
Calendar:  googleapis SDK (calendar.readonly + calendar.events scopes)
Database:  db.json flat file (SQLite migration planned before connectors)
AI:        Optional — Gemini API or Anthropic SDK, degrades to rule-based

Frontend (modern, in web/):
  React 19 + Vite + TypeScript
  Tailwind v4 + shadcn/ui  (the high-end look)
  Motion (animations, import from "motion/react")
  lucide-react (icons)
  Recharts (charts — not yet used; heatmap is plain CSS grid)
  TanStack Query (data fetching — wired, ready for live /api calls)
  React Router (Today / Schedule / Week pages)
  Luxon (timezone math for the Gantt)
  Font: Geist Variable (installed by shadcn init)

Legacy frontend (in public/): Vanilla HTML/CSS/JS, no build step
```

### File Structure
```
timesync 2/
├── server.js          ← All backend: Express routes, OAuth, GCal, db, AI (pure API)
├── rules.js           ← Deterministic triage engine (zero AI required)
├── package.json       ← backend deps
├── .env               ← NEVER commit (real secrets here)
├── .env.example       ← Template — safe to commit
├── db.json            ← NEVER commit (real user data + refresh tokens)
├── .gitignore         ← Excludes .env, db.json, node_modules, *.backup*
├── Dockerfile
├── README.md
├── PROJECT_BRIEF.md   ← This file — full context for AI or new contributors
│
├── public/            ← LEGACY vanilla frontend (still works, being superseded)
│   ├── index.html     ← Login / landing page
│   ├── style.css      ← Design tokens + shared component styles
│   ├── app.js         ← Timezone Gantt (real authenticated app)
│   ├── today.html     ← Today dashboard (real authenticated app, calls API)
│   ├── demo.html      ← Interactive Gantt demo (no auth, mock 5-person team)
│   ├── dashboard.html ← Today dashboard demo (no auth, hardcoded mock data)
│   ├── prototype-enhanced.html ← "enhanced vanilla" UI prototype (light, clean)
│   └── prototype-modern.html   ← "modern futuristic" UI prototype (dark, glassy)
│
└── web/               ← MODERN React frontend (the chosen direction)
    ├── vite.config.ts ← Tailwind plugin, @ alias, proxy /api & /auth → :3000
    ├── index.html     ← has class="dark" (app is dark-mode only)
    ├── src/
    │   ├── main.tsx       ← BrowserRouter + QueryClientProvider
    │   ├── App.tsx        ← Routes: /today /schedule /week
    │   ├── index.css      ← Tailwind v4 + futuristic theme tokens + .ts-* utilities
    │   ├── lib/
    │   │   ├── data.ts     ← mock inbox/agenda/tasks/heatmap data + types
    │   │   ├── schedule.ts ← Gantt team data + Luxon timezone helpers
    │   │   └── utils.ts    ← shadcn cn() helper
    │   ├── components/
    │   │   ├── TopBar.tsx      ← header + nav tabs + world clocks + avatar
    │   │   ├── Brief.tsx       ← AI brief hero with animated counters
    │   │   ├── Panel.tsx       ← reusable glass card with rise animation
    │   │   ├── Agenda.tsx      ← today's timeline with free-gap rows
    │   │   ├── Tasks.tsx       ← tasks + free-slot chips
    │   │   ├── Inbox.tsx       ← filterable triage inbox (animated)
    │   │   ├── WeekHeatmap.tsx ← week free-slot heatmap + best slots
    │   │   └── ui/             ← shadcn components (button, card, tabs, etc.)
    │   └── pages/
    │       ├── TodayPage.tsx    ← Brief + Agenda + Tasks + Inbox
    │       ├── SchedulePage.tsx ← timezone Gantt board (the original idea)
    │       └── WeekPage.tsx     ← full-page heatmap
    └── (node_modules, dist — gitignored)
```

### Environment Variables
```bash
# Required
GOOGLE_CLIENT_ID=          # Google Cloud Console → Credentials
GOOGLE_CLIENT_SECRET=
BASE_URL=http://localhost:3000
JWT_SECRET=                # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Recommended
ALLOWED_DOMAIN=yourcompany.com   # restricts sign-in to org Google accounts only

# Optional AI (set ONE — never use free Gemini tier for company data)
GEMINI_API_KEY=            # Google AI Studio — PAID tier only for org data
GEMINI_MODEL=gemini-2.0-flash
ANTHROPIC_API_KEY=         # console.anthropic.com
ANTHROPIC_MODEL=claude-sonnet-4-5

# Optional connectors
INGEST_TOKEN=              # node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
SLACK_WEBHOOK_URL=         # for outbound Slack notifications/digests

PORT=3000
DB_PATH=./db.json
```

---

## 3. What Is Built (Current State)

### 3.1 Authentication
- Google OAuth2 sign-in (`/auth/google` → `/auth/google/callback`)
- JWT stored in httpOnly cookie (`ts_token`, 30-day) — XSS-safe
- `ALLOWED_DOMAIN` check: rejects Google accounts from other domains
- `/api/me` — returns `{ email, name, picture }` for logged-in user

### 3.2 Triage Engine (`rules.js`) — 100% without AI

```
Input:  { src, from, text, due?, meta? }
Output: { cat: "fyi" | "reply" | "finish",  due: "YYYY-MM-DD" | null,  reasons: string[] }
```

**Rule ladder (evaluated in order, first match wins):**

| # | Condition | Result | Example |
|---|---|---|---|
| 1 | `src === "zendesk"` OR `meta.assignedTicket` | finish | Zendesk ticket assigned to you |
| 2 | `meta.awaitingAccept` | reply | Pending meeting request from TimeSync |
| 3 | `meta.actionItem` | finish | Action item extracted from meeting notes |
| 4 | No-reply sender OR newsletter/announcement text | fyi | All-hands email, company digest |
| 5 | Do-verb + deadline | finish | "Fill your OKR row by tomorrow" |
| 6 | Question patterns (?, "can you", "let me know", "your review") | reply | "Can you review the budget?" |
| 7 | DM or @mention with no other signal | reply | Direct Slack message |
| 8 | Deadline found in text (no verb) | finish | "Submit by June 20" |
| 9 | Default safe fallback | reply | Anything ambiguous — never silently miss |

**Do-verb patterns:** `fill`, `submit`, `complete`, `sign`, `upload`, `finish`, `prepare`, `send over`, `deliver`, `assigned to you`, `form`, `sheet`, `survey`, `okr`, `report`, `timesheet`

**Date parsing** (parseDue): handles "today/eod/asap", "tomorrow", "by Friday/Monday", "June 20", "20 June", next-year rollover for past dates.

**Self-test:** `node rules.js --test` — 14 assertions, all pass

### 3.3 Inbox API
- `GET /api/items` — all items for current user, sorted by urgency
  - Auto-synthesizes from: pending meeting accepts + open action items from meeting notes
  - Applies snooze expiry (items return at 06:00 next day)
  - Merges with manually stored items from db.json
- `POST /api/items` — manual add, auto-classified by rules.js
- `POST /api/items/:id/status` — accepts `done`, `snooze`, `reopen`
  - `done` on an action-item also marks the meeting note action done
  - `snooze` sets `snoozeUntil` = 06:00 next morning

### 3.4 Generic Ingest Endpoint (`POST /api/ingest?token=…`)
Any external tool can push items server-side without a user session:
```json
POST /api/ingest?token=YOUR_INGEST_TOKEN
{
  "user": "you@yourcompany.com",
  "src": "zendesk",
  "from": "Ticket #4521 · Acme Corp",
  "text": "Customer cannot log in — assigned to you",
  "link": "https://zendesk.com/tickets/4521",
  "meta": { "assignedTicket": true }
}
```
`rules.js` classifies it → stored to `db.json` → appears in `/api/items`.

### 3.5 Agenda & Calendar
- `GET /api/agenda?date=YYYY-MM-DD` → `{ events, gaps }`
  - Reads own Google Calendar via `events.list`
  - Merges TimeSync meeting requests
  - Computes free gaps (min 15 min) within working hours (default 9am–6pm)

### 3.6 Task Scheduling
- `GET /api/tasks` / `POST /api/tasks` — personal task CRUD
- `POST /api/tasks/:id/schedule` — places task in a specific free gap, creates REAL Google Calendar event
- UI suggests matching gaps based on task duration

### 3.7 Morning Brief (`GET /api/brief`)
- Without AI key: template-based ("You have 3 items needing attention today…")
- With AI key (Gemini/Anthropic): AI generates natural language brief
- UI shows "RULES" or "AI" badge — transparency about which mode is active
- Slack digest available via `DIGEST_CRON` schedule

### 3.8 Team Timezone Gantt (`public/app.js`)
- Team list from `db.json`, FreeBusy from Google Calendar API
- **Strict one-band rule**: each person shows ONLY the workday that STARTS on the viewed date
  - This fixed the "Lisa Park (New York) bug" — old code showed the previous night's band on the wrong side of the Gantt
- Green cells = all selected people are free simultaneously
- Click green slot → pre-fills meeting request form
- Duration selector: 30 / 60 / 90 / 120 min
- Date nav: prev/next arrows

### 3.9 Meeting Notes & Action Items
- Notes saved per-meeting in `db.json`
- With AI key: extracts action items from notes automatically
- Action items auto-appear in Today inbox as "finish" items
- "Brief" button → AI summary of meeting notes

### 3.10 Demo & Prototype Pages
| File | Purpose | Auth | Data |
|---|---|---|---|
| `demo.html` | Interactive Gantt demo | None | Mock 5-person team (fictional) |
| `dashboard.html` | Today dashboard mockup | None | Hardcoded static — does NOT call API |
| `today.html` | Real Today dashboard | Required | Live from API + Google Calendar |

---

## 4. Design Strategy & Core Principles

### 4.1 Privacy-First Architecture
- Triage decisions happen **locally on the server** via `rules.js` — no data sent to AI by default
- AI is **opt-in**: only activates when an API key is explicitly set
- **Never use Gemini free tier for company data** — free tier trains on your prompts
- Org-paid Gemini Pro is safe (contractually isolated tenant)
- **Filter at the connector level**: only items relevant to YOU leave the source system — AI never sees irrelevant noise

### 4.2 Connector Filter Strategy
| Source | Pre-filter before pushing to TimeSync |
|---|---|
| **Gmail** | `to:me` only (not BCC), skip `from:no-reply*`, skip promotions/newsletters label |
| **Slack** | `message.im` (DMs) + `app_mention` events + specific whitelisted channel IDs |
| **Zendesk** | `assignee_id=me` + `status=open OR pending` |
| **Google Sheets** | Apps Script: only rows where "Owner" column = your email |

### 4.3 AI Role — Narrow and Optional
AI does NOT decide what to show. `rules.js` does that. AI only:
- Summarizes long message threads into 2–3 lines (brief generation)
- Extracts due dates from ambiguous natural language
- Generates the morning brief in natural language
- Extracts action items from meeting notes

### 4.4 No Framework Policy (Intentional)
Vanilla JS, no React/Vue/build step:
- Edit HTML → refresh browser → see result. Zero friction.
- Easy to hand off without framework knowledge
- Smaller footprint (dashboard open all day in a tab)
- Migrate incrementally if complexity demands it later

### 4.5 Snooze Philosophy
Snoozed items return at **06:00 next morning** — not "24 hours later". Ensures items resurface at the START of a work day, included in the morning brief, reviewed proactively. Never buried mid-afternoon.

### 4.6 Three-Tier Data Model
| Tier | What | Where |
|---|---|---|
| Inbox items | Work items with triage status | `db.items[]` |
| Tasks | Personal to-dos with optional GCal placement | `db.tasks[]` |
| Meeting data | Requests, notes, action items | `db.requests[]` |

---

## 4.7 Modern React Frontend (`web/`) — the chosen UI direction

After building two prototypes (`public/prototype-enhanced.html` = light/clean, and
`public/prototype-modern.html` = dark/futuristic), the **modern dark futuristic** look was chosen.
It was then rebuilt as a real React app in `web/`.

### Why a rebuild (and not just enhance the vanilla pages)
The user wants a "very advanced, high-end, catchy, futuristic" UI with rich visualization. That ceiling
is reached with the React + Tailwind + shadcn/ui component stack (the look of Linear / Vercel / Notion).
The backend (`server.js`) is a pure JSON API and **does not change** — only the front-end is rebuilt.

### The three pages (React Router)
| Route | Page | Purpose |
|---|---|---|
| `/today` | `TodayPage` | The dashboard: AI brief + agenda + tasks + triage inbox — "what needs me" |
| `/schedule` | `SchedulePage` | The timezone Gantt board (the project's ORIGINAL idea) — "when is the team online" |
| `/week` | `WeekPage` | Free-slot heatmap — "best times this week" |

### Design system / theme
- **Dark-mode only** (`class="dark"` on `<html>`). Palette in `web/src/index.css`:
  bg `#070A14`, accents blue `#6D8BFF` / purple `#A78BFA` / cyan `#5EEAD4`, status
  reply `#FBBF24` / finish `#FB7185` / fyi `#60A5FA` / free `#34D399`.
- Status colors registered in Tailwind `@theme` → usable as `text-reply`, `bg-free`, etc.
- Custom utilities in `index.css`: `.ts-aurora` (animated background), `.ts-glass`
  (glassmorphic panel), `.ts-rise` (entrance), `.ts-pulse`, `.ts-glow-primary/.ts-glow-free`.
- Animations via **Motion** (`motion/react`): counters, list add/remove, page entrances.

### Timezone Gantt logic (`web/src/lib/schedule.ts`)
- Uses **Luxon** to convert each person's local working hours / busy blocks into the viewer
  timezone (Asia/Taipei), positioned on a 0–24h axis as percentages.
- **Strict one-band rule** preserved: a working band only renders if its START falls on the
  viewed day in viewer time — prevents the US-timezone "phantom band" bug.
- `commonFreeSlots()` computes where ALL selected people are free → the green strip.
- Day navigation lets you look at tomorrow / next week to find a slot when today has none.

### Data layer
- All data is currently **mock** in `web/src/lib/data.ts` and `schedule.ts`, shaped exactly
  like the real API responses. Going live = replace mock imports with **TanStack Query**
  fetches against `/api/*` — components don't change.
- `QueryClient` already set up in `main.tsx`. Vite proxies `/api` and `/auth` to `:3000`.

### How to run
```bash
# Terminal 1 — backend API
cd "timesync 2" && node server.js          # :3000

# Terminal 2 — modern frontend
cd "timesync 2/web" && npm run dev          # :5173  (proxies to :3000)
```
Build for production: `cd web && npm run build` → static files in `web/dist/`
(serve them from Express in production).

---

## 5. Feature Backlog

### ✅ Recently Completed (this session)
- [x] **Modern React frontend** scaffolded in `web/` (React + Vite + TS + Tailwind v4 + shadcn/ui)
- [x] **Today dashboard page** — AI brief, agenda, tasks, triage inbox (animated)
- [x] **Schedule (timezone Gantt) page** — Luxon-based, strict one-band rule, day nav, free-slot strip
- [x] **Week view heatmap** — grid + "best slots this week" list *(was the "i dont see month week" request)*
- [x] Two UI prototypes built (`prototype-enhanced.html`, `prototype-modern.html`); modern chosen

### 🔴 High Priority — Build Next
- [ ] **Wire real data into `web/`** — replace mock `data.ts`/`schedule.ts` with TanStack Query calls to `/api/items`, `/api/agenda`, `/api/tasks`, `/api/brief`, `/api/team`. Add Google login flow to the React app.
- [ ] **Gmail connector** — Gmail API **polling every 5 min** (personal): `to:me`, skip no-reply/promotions, push to `/api/ingest`. Company scale → Pub/Sub push. See §6.5.
- [ ] **Slack connector** — Slack Events API via **Socket Mode** (personal, real-time, no public URL): DMs + @mentions + whitelisted channels, push to `/api/ingest`. Company scale → Events API over HTTP. See §6.5.
- [ ] **Zendesk connector** — Poll `/tickets?assignee_id=me&status=open`, push to `/api/ingest`

### 🟠 Medium Priority
- [ ] **Month view** — calendar grid with per-day "best slot score" dots (lower priority than week). Add as a 4th route in `web/`.
- [ ] **Click heatmap cell → jump to that day's Schedule Gantt** (cross-page navigation)
- [ ] **Recharts visualizations** — meeting-load per person, items-resolved-this-week trend (lib installed, unused so far)
- [ ] **Serve `web/dist` from Express** in production (single deploy)
- [ ] **Browser push notifications** — meeting reminders 5 min before start, new urgent inbox items
- [ ] **SQLite migration** — replace `db.json` before Slack/Gmail phases (needed for search, filtering, scale)
- [ ] **Gemini Pro / MCP integration** — org Gemini Pro for brief summarization; if org has MCP endpoint, connect via MCP server
- [ ] **Notification digest** — weekly Slack summary: items resolved, overdue, team availability

### 🔵 Lower Priority / Ideas
- [ ] Google Sheets connector (Apps Script → ingest)
- [ ] Mobile-responsive layout (currently desktop-only)
- [ ] Dark mode toggle
- [ ] Per-user working hours config (currently hardcoded 9–18)
- [ ] Team fairness tracker (who accepts the most meeting requests)
- [ ] Smart suggestions ("You have a recurring meeting with no notes — add some?")
- [ ] Calendar export of scheduled tasks (`.ics`)
- [ ] Multi-workspace Slack support

---

## 6. Connector Implementation Pattern

When building any connector, follow this pattern:

```js
// Step 1: Fetch from source with server-side filtering
const items = await gmailApi.users.messages.list({
  userId: "me",
  q: "to:me -from:no-reply -category:promotions",
  maxResults: 20
});

// Step 2: For each item, push to ingest endpoint
for (const item of items) {
  await fetch(`${BASE_URL}/api/ingest?token=${INGEST_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user: "you@yourcompany.com",
      src: "gmail",           // gmail | slack | zendesk | sheets
      from: item.sender,
      text: item.subject + " " + item.snippet,
      link: `https://mail.google.com/mail/u/0/#inbox/${item.id}`,
      meta: {
        dm: item.isDirect,          // Slack: was this a DM?
        mention: item.mentioned,    // Slack: were you @mentioned?
        assignedTicket: true,       // Zendesk: is this assigned to you?
      }
    })
  });
}
// rules.js classifies → stored in db.json → visible in /api/items
```

---

## 6.5 Connector Transport Research (How to Get Data In)

> Research done Jun 2026 on the safest + most effective way to pull data from Slack, Gmail,
> and other tools into the dashboard. Conclusion: **different transport for personal vs company scale,
> but the same `/api/ingest` endpoint and `rules.js` engine serve both — only the connector layer swaps.**

### The three transport types
| Method | How it works | Needs public URL? | Real-time? | Notes |
|---|---|---|---|---|
| **API Polling** | Your server asks "anything new?" on a timer | ❌ No | ❌ ~2–5 min lag | Simplest; wastes quota at scale |
| **Webhooks / Push** | The source pushes to your server on each event | ✅ Yes | ✅ Instant | Needs deployment + public HTTPS |
| **WebSocket (Socket Mode)** | Your server opens a persistent outbound connection; events stream down | ❌ **No** | ✅ Instant | Slack-only; works on localhost/firewall |
| **MCP** | Protocol for AI assistants to use tools | — | — | ❌ Not a data-connector mechanism — not used here |

### Gmail options
| Method | Real-time? | Public URL? | Effort | Best for |
|---|---|---|---|---|
| **API Polling** (`messages.list`) | ~5 min lag | ❌ No | Low | **Personal version (now)** |
| **Pub/Sub Push** (`users.watch`) | 1–10 sec | ✅ Yes | High — needs Cloud project, Pub/Sub topic, and **watch renewal every 7 days** (cron) | Company/deployed |
| Apps Script trigger | ~1–5 min | ❌ No | Medium | No-server hack |
| iPaaS (Zapier/Make) | seconds | ❌ No | Lowest | Non-technical, low volume |

### Slack options
| Method | Real-time? | Public URL? | Effort | Best for |
|---|---|---|---|---|
| **Socket Mode** (Events API over WebSocket) | Instant | ❌ **No** | Medium | **Personal version (now)** ⭐ |
| **Events API over HTTP** | Instant | ✅ Yes | Medium | Company/deployed/Marketplace |
| **Web API Polling** (`conversations.history`) | ~2 min lag | ❌ No | Low | Simple fallback |
| Incoming Webhooks | — | — | — | ❌ Only for *posting TO* Slack, not reading |
| RTM API | — | — | — | ❌ Deprecated — do not use |

### Key insights from the research
- **Slack can be real-time on localhost TODAY** via Socket Mode — a persistent outbound WebSocket, no public URL, works behind a firewall. This is why we don't need to deploy first to get live Slack events.
- **Gmail cannot easily do push on localhost** — Pub/Sub needs a public HTTPS endpoint. Gmail stays on polling until deployed.
- **Slack "Events API" is the *what* (the events); HTTP vs Socket Mode is the *how* (delivery).** Same events, two transports.
- ⚠️ **Socket Mode apps cannot be published to the Slack Marketplace**, but CAN be deployed org-wide on Enterprise Grid. So: Socket Mode for internal/personal, HTTP for public distribution.
- **Polling is fine at personal scale** (Gmail allows ~1M quota units/day). It only becomes wasteful when polling many accounts — that's when you switch to push.

### Recommended setup by scale
**Personal / self version (build now — no deployment, no public URL):**
```
Gmail  →  API polling every 5 min   (reuse existing Google OAuth, add gmail.readonly scope)
Slack  →  Socket Mode (real-time)    (one bot token + one app token, works on localhost)
```
**Company / large-scale version (later, when deployed):**
```
Gmail  →  Pub/Sub push (users.watch) + 7-day renewal cron
Slack  →  Events API over HTTP (public endpoint, Marketplace-ready)
Add    →  SQLite/Postgres, job queue, per-user token storage
```
The migration path is clean: **`/api/ingest` and `rules.js` never change** — only the connector layer swaps poll → push.

### Sources
- [Comparing HTTP & Socket Mode — Slack Docs](https://docs.slack.dev/apis/events-api/comparing-http-socket-mode/)
- [Using Socket Mode — Slack Docs](https://docs.slack.dev/apis/events-api/using-socket-mode/)
- [Slack API Integration Guide 2026 — getknit.dev](https://www.getknit.dev/blog/slack-api-integration-guide)
- [Gmail API Push Notifications Guide 2026 — Unipile](https://www.unipile.com/gmail-api-push-notifications/)
- [Configure push notifications in Gmail API — Google](https://developers.google.com/workspace/gmail/api/guides/push)

---

## 7. Key Decisions Log

| Date | Decision | Why |
|---|---|---|
| Jun 2026 | Pivot from timezone tool → unified work dashboard | Core problem is "forgetting to act on things", not just "finding meeting times" |
| Jun 2026 | Build `rules.js` for zero-AI triage | Data privacy; works without any API keys; instant; no cost |
| Jun 2026 | AI is optional upgrade layer only | Company data must not go to free AI tiers; paid tier = safe |
| Jun 2026 | Strict one-band rule in timezone Gantt | Fixed bug where Lisa Park (New York) showed previous night's band on current day |
| Jun 2026 | `/api/ingest` generic push endpoint | Any connector (Zapier, Apps Script, poller) can push without changing server code |
| Jun 2026 | Snooze wakes at 06:00 next morning | Items return at predictable start-of-day, included in morning brief |
| Jun 2026 | `db.json` now (not SQLite) | Speed to build; SQLite before adding high-volume connectors |
| Jun 2026 | Scrubbed `@company.com` from demo files | Privacy; repo private but good practice; all demo data uses `@example.com` |
| Jun 2026 | Vanilla JS, no framework | Zero build step, easy iteration, easy handoff |
| Jun 2026 | Filter at connector level, not in AI | Privacy: only relevant items leave the source system; AI never sees noise |
| Jun 2026 | Personal connectors: Gmail polling + Slack Socket Mode | Both work on localhost with NO public URL; real-time Slack today, near-real-time Gmail. See §6.5 |
| Jun 2026 | MCP is NOT used for data connectors | MCP is for AI assistants to use tools, not for pulling app data; wrong tool for this job |
| Jun 2026 | Company scale: Gmail Pub/Sub push + Slack HTTP Events API | Polling wastes quota across many accounts; push scales. Migration only touches connector layer |
| Jun 2026 | Removed Zoom integration entirely | Out of scope for the work-dashboard direction; dropped `/webhooks/zoom`, env var, and all docs |
| Jun 2026 | **Reversed "no framework" decision → React for the modern UI** | User wants high-end/futuristic UI + rich viz. shadcn/ui ceiling needs React. Backend stays a pure API, so only the front-end is affected |
| Jun 2026 | Modern stack: React+Vite+TS+Tailwind v4+shadcn/ui+Motion+Recharts+TanStack Query+React Router+Luxon | Researched current (2026) best practice; picked Recharts over visx/D3 (easier, smaller); chose dark futuristic theme over light |
| Jun 2026 | Modern UI is **dark-mode only** | Matches the "futuristic command-center" look chosen from the two prototypes |
| Jun 2026 | New React app lives in `web/`; legacy `public/` kept | Non-destructive — old app keeps working until the React rebuild reaches parity |
| Jun 2026 | Charts: Recharts only (visx/D3 deferred) | Recharts easier + smaller bundle; heatmap built with plain CSS grid (no lib needed) |
| Jun 2026 | Claude Code (not Claude.ai) is the working home | Context + memory live here; `PROJECT_BRIEF.md` is the portable handoff if Claude.ai is ever needed |

---

## 8. Known Issues & Limitations

| Issue | Status |
|---|---|
| `dashboard.html` is static mock — no API calls | Intentional — it is a UI prototype only |
| `db.json` has no write locking (concurrent requests) | Known — SQLite migration will fix |
| Working hours hardcoded at 9–18 | Per-user config planned (needs db schema) |
| Team roster is manual (add to db.json) | No team management UI yet |
| No connector yet for Gmail/Slack/Zendesk | Ingest endpoint is ready; pollers not built |

---

## 9. How to Resume This Project

### In Claude Code (VS Code extension or CLI)
```bash
cd "timesync 2"
# 1. Read this file first (PROJECT_BRIEF.md) — it is the full context.
# 2. Backend (pure JSON API):
node server.js             # :3000
node rules.js --test       # verify triage engine (14 tests)
# 3. Modern React frontend (the current UI work):
cd web && npm install && npm run dev   # :5173 (proxies /api & /auth to :3000)
```
Key files to look at: `server.js` (API), `rules.js` (triage), `web/src/App.tsx` (routes),
`web/src/pages/*` (Today/Schedule/Week), `web/src/lib/{data,schedule}.ts` (mock data + tz helpers).
Context is also stored in memory files at: `~/.claude/projects/-Users-vimal-Downloads-timesync-2/memory/`

### In Claude.ai (fresh chat)
Paste the full contents of this file as the first message — gives complete context.

### Useful commands
```bash
# Backend
node server.js             # start API on :3000
node rules.js --test       # test triage engine (all 14 should pass)
lsof -ti:3000 | xargs kill # kill stale backend

# Modern frontend (in web/)
cd web && npm run dev      # dev server on :5173
npm run build              # production build → web/dist/
lsof -ti:5173 | xargs kill # kill stale Vite

# Git
git status
git push origin main       # push to GitHub (SSH, account DESOUZAVIMAL)
```

---

## 10. Demo Data Reference (fictional — safe to commit)

| Name | Email | Timezone | Role |
|---|---|---|---|
| Alex Chen | alex@example.com | Asia/Taipei | Product (the "you" / viewer) |
| Mei Lin | mei@example.com | Asia/Singapore | Design |
| Arjun Rao | arjun@example.com | Asia/Kolkata | Engineering |
| Sarah Chen | sarah@example.com | Europe/London | Marketing |
| Lisa Park | lisa@example.com | America/New_York | Manager |

All demo meeting data, inbox items, and task suggestions in `demo.html` and `dashboard.html` use these fictional identities only.
