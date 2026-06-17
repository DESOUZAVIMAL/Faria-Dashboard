# Build Blueprint — Ocelli & Faria Calendar

> A precise, build-oriented specification. **Part A** documents Ocelli (the work dashboard) *as built*.
> **Part B** specifies Faria Calendar (the smart scheduling/availability app) *as designed* — with the
> algorithms, data models, API, and UI detailed enough for another AI or developer to build it.
> *Jun 2026.*

---

# PART A — Ocelli (work dashboard) — AS BUILT

## A1. Purpose
Pull work items from multiple tools into one place, auto-triage them (To finish / Needs reply / FYI),
and track each until done so nothing slips. Privacy-first: deterministic rules, no AI required.

## A2. Architecture
```
React + TypeScript (Vite, Tailwind, shadcn/ui)   ← dashboard UI (web/)
        │  REST/JSON over /api/*  (Vite proxies to backend in dev)
Node.js + Express (server.js)                     ← single-file API service
        ├── Google OAuth2 (googleapis SDK)
        ├── rules.js  (deterministic triage engine)
        ├── aiComplete()  (OPTIONAL brain: Gemini/Claude; off by default)
        └── db.json  (flat-file store; SQLite/Postgres planned for scale)
```

## A3. Tech stack
- Backend: Node.js, Express, `googleapis`, `jsonwebtoken`, `cookie-parser`, `node-cron` (optional).
- Frontend: React 19, Vite, TypeScript, Tailwind v4, shadcn/ui, Motion, lucide-react, TanStack Query, React Router, Luxon.
- Auth: Google OAuth2 → JWT in an httpOnly cookie (30-day).
- AI (optional): Gemini API or Anthropic, via `aiComplete()`; with no key it falls back to rules.

## A4. Data model (`db.json`)
```
users:      { [email]: { email, name, picture, tz, workStart, workEnd, role, refresh_token } }
items:      [ { id, user, src, from, text, cat, due, reasons[], status, createdAt, link?,
                snoozeUntil?, doneAt? } ]            // cat: reply|finish|fyi  status: open|snoozed|done
tasks:      [ { id, user, text, est(min), done, scheduled:{start,end,eventLink}|null, createdAt } ]
requests:   [ { id, title, start, end, requester, requesterName, attendees[], status,
                responses{}, notes, actions[{text,owner,done}], eventLink } ]  // meetings
itemStates: { "email|itemId": { status, snoozeUntil?, doneAt? } }   // status for synthesized items
```

## A5. Triage engine (`rules.js`) — no AI
`classifyItem({src,from,text,due?,meta?}) → { cat, due, reasons[] }`. Rule ladder (first match wins):
1. `src=="zendesk"` or `meta.assignedTicket` → **finish**
2. `meta.awaitingAccept` → **reply**
3. `meta.actionItem` → **finish**
4. no-reply sender / newsletter / "no action needed" → **fyi**
5. do-verb (fill/submit/complete/sign/upload/finish…) **+** a deadline → **finish**
6. question patterns (`?`, "can you", "let me know", "your review") → **reply**
7. DM / @mention → **reply**
8. a deadline alone → **finish**
9. default → **reply** (safe: never silently miss)
`parseDue(text)` extracts dates ("today/eod", "tomorrow", "by Friday", "June 20", etc.).

## A6. API (all `/api/*`, JWT cookie auth)
- `GET /me` → user profile.
- `GET /items` → synthesized (pending accepts + open action items) + stored items, snooze-expiry applied, sorted.
- `POST /items` `{from,text,src?}` → classify + store.
- `POST /items/:id/status` `{action: done|snooze|reopen}` (snooze wakes next day 06:00).
- `GET /tasks`, `POST /tasks`, `POST /tasks/:id`, `POST /tasks/:id/schedule {start,end}` (creates a real Calendar event).
- `GET /agenda?date&start&end` → `{events[], gaps[]}` (own calendar events + free gaps).
- `GET /brief?date&start&end` → `{brief, ai, counts}`.
- `GET /team`, `GET /availability?start&end` (team FreeBusy).
- `POST /ingest?token=…` → generic connector intake (Zapier/pollers); classified by rules.
- `POST /gmail/sync` → pull recent inbox mail (read-only), filter noise, classify, store (deduped by message id).

## A7. Frontend (web/)
- `App.tsx` auth-gates on `GET /me`; routes: `/today`, `/schedule`, `/week`.
- TanStack Query hooks (`queries.ts`) over a typed client (`api.ts`); mutations invalidate caches.
- Components: `Brief`, `Agenda`, `Tasks`, `Inbox` (all data-wired), `Panel`, `TopBar`.

## A8. Key workflows
- **Sign-in:** `/auth/google` → consent → callback stores refresh_token, sets JWT cookie, redirects to app.
- **Triage:** connector/sync → `rules.js` → `db.items` → inbox (with "why" shown).
- **Track:** Done / Snooze (06:00 next day) / Reopen; completing an action-item also marks the meeting action done.
- **Tasks:** add → "schedule" picks a free gap → creates a Calendar event.
- **Brief:** template by default; `aiComplete()` upgrades it if an AI key is set.

## A9. Design decisions
- Rules-first / AI optional. AI **only thinks, never acts**.
- Read-only Gmail; teammates FreeBusy-only.
- Snooze returns 06:00 (predictable, in the morning brief).
- Strict one-band timezone rule (see Part B; also used in the Gantt).

---

# PART B — Faria Calendar (scheduling & availability) — DESIGN SPEC

## B1. Purpose & scope
A **smart layer on top of Google Calendar** (NOT a replacement) for a remote, cross-timezone org.
Shows team availability cleanly, strips calendar noise, categorizes meetings (committed vs optional),
supports fragmented working hours, and finds the best meeting times across time zones.
**Out of scope:** event CRUD, recurring-event editing, reminders, mobile sync (Google already does these).

## B2. Core concepts
- **Viewer clock:** everything renders in the signed-in user's IANA timezone.
- **Own vs others' calendars:**
  - *Own calendar* → full event detail (titles, your `responseStatus`) → full 4-level categorization.
  - *Teammates* → **FreeBusy only** by default (busy/free, no titles) → collapses to free (0) / busy (3).
  - *If* the Workspace shares "full event details" internally (Faria appears to) → read teammates' events too and apply full categorization.
- **Availability levels (0–3):** see B6.

## B3. Google Calendar API usage
- `calendarList.list` → which calendars to include (user picks).
- `events.list` (own + full-detail colleagues): params `singleEvents=true`, `orderBy=startTime`, `timeMin/timeMax`, request fields:
  `items(id,summary,start,end,status,eventType,transparency,attendees(email,self,optional,responseStatus))`.
- `freebusy.query` (teammates, FreeBusy-only): returns `busy:[{start,end}]`.
- Token scopes (least privilege, **no Gmail**): `calendar.readonly` (+ `calendar.events` only if booking from the app is added later).

## B4. Noise-filter pipeline (per event)
Drop or reclassify using Google's own tags:
```
if eventType in {workingLocation, birthday, fromGmail}   → HIDE (noise)
if status == "cancelled"                                  → HIDE
if myResponse == "declined"                               → HIDE (you're free)
if eventType == "outOfOffice"                             → UNAVAILABLE (level 3)
if transparency == "transparent"                          → NON-BLOCKING (level ≤1)
else (opaque, default/focusTime):
    if myResponse == "accepted"                           → COMMITTED (level 3)
    if myResponse in {needsAction, tentative}
       OR mySelf.optional == true
       OR attendees.length >= BROADCAST_THRESHOLD (e.g. 15)→ TENTATIVE/optional (level 2)
```
`myResponse` = the attendee entry where `attendee.self == true`. (For teammates via FreeBusy there is no
responseStatus → every busy block is treated as level 3.)

## B5. Timezone handling (use Luxon + IANA tz; DST handled automatically)
Render each person on the viewer's clock as **hours-from-viewer-midnight** for date `D`:
```
toViewerHour(personTz, D, localHour):
    local  = DateTime.fromISO(D, {zone: personTz}).set({hour:⌊localHour⌋, minute:(localHour%1)*60})
    viewer = local.setZone(VIEWER_TZ)
    return viewer.diff(startOfDay(D in VIEWER_TZ), 'hours').hours      // may be <0 or >24

isoToViewerHour(iso, D):  // for FreeBusy busy blocks
    return DateTime.fromISO(iso).setZone(VIEWER_TZ).diff(startOfDay(D), 'hours').hours
```
- **Strict one-band rule:** render a person's working band only if its *start* (in viewer hours) is in `[0,24)`.
  Prevents the previous/next day's band bleeding onto the wrong side (the "US timezone" bug).
- **Fragmented working hours:** a person's hours = array of segments `[[9,12],[16,19]]` (local). A person is
  "in working hours" at viewer-hour `h` if `h` falls in ANY converted segment.

## B6. Availability level for a person at viewer-hour `h` on day `D`
```
levelAt(person, D, h):
    if weekend or h not in any working segment(person, D)      → 3   (unavailable)
    evs = filteredEvents(person, D) covering h                 // after B4 pipeline
    if any COMMITTED in evs                                    → 3
    if any TENTATIVE in evs                                    → 2
    if any "likely-free only" (declined/transparent present)   → 1
    else                                                       → 0   (free)
```
Levels & colors: **0 Free** 🟩 · **1 Likely free** 🟦 · **2 Tentative** 🟧 · **3 Busy/off** 🟥.
(Teammates via FreeBusy resolve only to 0 or 3.)

## B7. Group overlap & best-slots algorithm
```
commonFree(selectedPeople, D, minDuration=0.5h):
    step = 0.5
    runs = []; run = null
    for h in 0..24 step step:
        open = (h<24) and selected.every(p => levelAt(p,D,h) <= 1)
        if open and run==null: run = h
        if not open and run!=null: if h-run >= minDuration: runs.push([run,h]); run=null
    return runs
bestSlots(D): commonFree(...) sorted by duration desc (then by humane-ness: closer to mid-day overlap)
```
"Everyone free" = all selected at level ≤ 1. If `runs` is empty for `D`, suggest checking other days (see week view).

## B8. Week heatmap
For each `(day, hour)` over the next 7 days: `score = count(selected where levelAt ≤ 1)`.
Color by `score / selectedCount` (brighter = more free). The grid is the "which day?" scanner;
clicking a day opens its detailed Gantt (B9).

## B9. UI/UX spec
- **Layout:** left sidebar (people + toggles + legend), main column (week heatmap on top, stacked day detail below, best-slots list).
- **People selector:** grouped (You / Manager / Team), checkboxes, avatar, timezone, live status dot. Toggling recomputes everything.
- **Week heatmap:** 7 cols × hours; cell color = group availability; click a day header → open/close its detail.
- **Day detail (stacked):** for each selected person a row on the viewer clock — working band (subtle), event blocks colored by level (🟥 committed / 🟧 tentative / 🟦 optional), live "now" line; a green **"everyone free"** strip; a **"🧹 N noise events hidden"** badge; a **"Best on <day>"** line. **Multiple days can be open at once, stacked, for comparison** (keep prior day pinned).
- **Toggles:** "Only accepted meetings block", "Hide optional", "Working hours only", per-user **mute** (recurring events / sub-calendars).
- **Theme:** dark, modern, glassmorphic; headings in a geometric sans; accents blue/purple/cyan; the 4 level colors above. Desktop-first; responsive later.
- A working **clickable prototype** of this exists at `public/faria-calendar-prototype.html`.

## B10. Data model (real DB, e.g. Postgres — multi-user)
```
users:        { id, email, name, picture, viewer_tz, role, encrypted_refresh_token }
work_hours:   { user_id, segments:[[startLocalHour,endLocalHour], ...] }   // fragmented supported
preferences:  { user_id, muted_event_titles[], muted_calendar_ids[], broadcast_threshold }
included_cals:{ user_id, calendar_id, include:bool }
-- availability is computed live; cache lightly (short TTL) for performance, store no event bodies.
```

## B11. API design (proposed)
- `GET /api/me` → profile + viewer_tz + work_hours.
- `POST /api/me/hours` → set fragmented working segments.
- `GET /api/people` → org directory (selectable; from Workspace directory or a roster).
- `GET /api/day?date=YYYY-MM-DD&people=ids` → per-person rows (working band + filtered events + per-slot levels) + `freeSlots[]` + `hiddenCount`.
- `GET /api/week?start=YYYY-MM-DD&people=ids` → 7-day heatmap matrix + ranked best slots.
- `GET /api/my-day?date=...` → your own meetings categorized (committed/tentative/optional) for the "does this block me?" view.
- `POST /api/prefs` → mutes / toggles / broadcast threshold.
(Compute on the fly via FreeBusy/events; persist preferences only.)

## B12. Behaviors & edge cases
- **No common slot today** → surface the nearest days that work (drive from week heatmap).
- **Weekends / outside hours** → level 3 (unless a person sets weekend hours).
- **All-day events** → don't block timed availability (shown as a banner, not a busy block).
- **DST / half-hour zones (e.g. India +5:30)** → handled by Luxon IANA conversion; never hard-code offsets.
- **Teammate with FreeBusy only** → levels collapse to 0/3; show a small "free/busy only" hint.
- **Out-of-office** → whole-day unavailable.

## B13. Non-functional
- **Privacy:** calendar **FreeBusy + own events only — no Gmail**; least-privilege scopes; store preferences, not event bodies; encrypt tokens at rest.
- **Security:** Google OAuth2, JWT httpOnly cookies, company-domain restriction, HTTPS in production, audit logging.
- **Hosting/scale:** multi-user → real DB (Postgres); **host on company infrastructure** (data stays in-house); short-TTL caching of availability; rate limits. Google app stays in "Testing"/internal mode for a small group (no verification needed for calendar scopes internally).
- **Optional AI brain (later, enterprise only):** natural-language "find me a time" and summaries via Vertex; never required, never a consumer/free tier.

## B14. MVP acceptance criteria
1. Sign in with Google (calendar scope only); set fragmented working hours.
2. Select people (grouped) → see a week heatmap of group availability (4-level color).
3. Click days → stacked day Gantts on the viewer clock, with noise stripped and meetings color-graded.
4. "Everyone free" slots + ranked best slots compute correctly across time zones (DST-safe).
5. For your own calendar, optional/unconfirmed meetings are shown but **do not block** availability; toggles work.
6. No Gmail access; data stays on company infra; tokens encrypted.

---

## How to use this blueprint with another AI
Hand over **Part B** (and Part A for context) and ask it to: (1) confirm the architecture & data model,
(2) implement the Google Calendar reads (events.list + freebusy.query with the fields in B3),
(3) implement the algorithms in B4–B8 exactly, (4) build the UI in B9, (5) meet the acceptance criteria in B14.
A working visual reference is `public/faria-calendar-prototype.html`; the existing Ocelli code (`server.js`,
`web/src/lib/schedule.ts`) already contains the timezone-conversion and free-slot logic to adapt.
