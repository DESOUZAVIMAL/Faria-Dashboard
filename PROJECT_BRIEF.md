# TimeSync — Complete Project Brief & Handoff Document

> **Living document.** Update this whenever a major decision changes.
> This is the single source of truth for any AI assistant, new contributor, or future session picking up this project.
> **To resume in Claude.ai:** paste the full contents of this file as your first message.

**Author:** Vimal De Souza  
**Stack:** Node.js + Express, Google OAuth2, Vanilla JS (no build tools)  
**Repo:** https://github.com/DESOUZAVIMAL/Faria-Dashboard (private)  
**Local dev:** `cd "timesync 2" && node server.js` → http://localhost:3000

---

## 1. Product Vision & Problem Statement

### The Problem
Professionals use 5–10 tools daily: Slack, Gmail, Zendesk, Google Sheets, Google Calendar, Zoom. The result:
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
Backend:   Node.js + Express (single file: server.js)
Auth:      Google OAuth2 → JWT in httpOnly cookie (30-day)
Calendar:  googleapis SDK (calendar.readonly + calendar.events scopes)
Database:  db.json flat file (SQLite migration planned before connectors)
AI:        Optional — Gemini API or Anthropic SDK, degrades to rule-based
Frontend:  Vanilla HTML/CSS/JS — no React, no Vue, no build step (intentional)
Fonts:     Space Grotesk (headings) + Inter (body) from Google Fonts
```

### File Structure
```
timesync 2/
├── server.js          ← All backend: Express routes, OAuth, GCal, db, AI
├── rules.js           ← Deterministic triage engine (zero AI required)
├── package.json
├── .env               ← NEVER commit (real secrets here)
├── .env.example       ← Template — safe to commit
├── db.json            ← NEVER commit (real user data + refresh tokens)
├── .gitignore         ← Excludes .env, db.json, node_modules, *.backup*
├── Dockerfile
├── README.md
├── PROJECT_BRIEF.md   ← This file — full context for AI or new contributors
└── public/
    ├── index.html     ← Login / landing page
    ├── style.css      ← Design tokens + shared component styles
    ├── app.js         ← Timezone Gantt (real authenticated app)
    ├── today.html     ← Today dashboard (real authenticated app, calls API)
    ├── demo.html      ← Interactive Gantt demo (no auth, mock 5-person team)
    └── dashboard.html ← Today dashboard demo (no auth, hardcoded mock data)
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
| **Zoom** | Webhook on recording complete → meeting notes auto-import |

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

## 5. Feature Backlog

### 🔴 High Priority — Build Next
- [ ] **Week view heatmap** — 7-column grid (days) × 24 rows (hours), cell color = # people free. "Best slots this week" ranked list below grid. Click cell → jump to that day's Gantt. *(User requested: "i dont see month week that we discussed")*
- [ ] **Gmail connector** — Gmail API poller: `to:me`, skip no-reply/promotions, push to `/api/ingest`
- [ ] **Slack connector** — Slack Events API: DMs + @mentions + whitelisted channels, push to `/api/ingest`
- [ ] **Zendesk connector** — Poll `/tickets?assignee_id=me&status=open`, push to `/api/ingest`

### 🟠 Medium Priority
- [ ] **Month view** — calendar grid with per-day "best slot score" dots (lower priority than week)
- [ ] **Browser push notifications** — meeting reminders 5 min before start, new urgent inbox items
- [ ] **SQLite migration** — replace `db.json` before Slack/Gmail phases (needed for search, filtering, scale)
- [ ] **Gemini Pro / MCP integration** — org Gemini Pro for brief summarization; if org has MCP endpoint, connect via MCP server
- [ ] **Notification digest** — weekly Slack summary: items resolved, overdue, team availability

### 🔵 Lower Priority / Ideas
- [ ] Google Sheets connector (Apps Script → ingest)
- [ ] Zoom webhook → auto meeting notes
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
      src: "gmail",           // gmail | slack | zendesk | sheets | zoom
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
# Read this file first, then:
cat server.js          # backend
cat rules.js           # triage engine
# open public/today.html for the dashboard UI
node server.js         # start server
node rules.js --test   # verify triage engine
```
Context is also stored in memory files at: `~/.claude/projects/-Users-vimal-Downloads-timesync-2/memory/`

### In Claude.ai (fresh chat)
Paste the full contents of this file as the first message — gives complete context.

### Useful commands
```bash
node server.js             # start app
node rules.js --test       # test triage engine (all 14 should pass)
lsof -ti:3000              # check what's using port 3000
lsof -ti:3000 | xargs kill # kill stale server
git status                 # check what's changed
git push origin main       # push to GitHub
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
