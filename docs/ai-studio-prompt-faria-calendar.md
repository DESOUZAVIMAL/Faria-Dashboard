# AI Studio Prompt — Faria Calendar (Advanced Availability & Scheduling)

> Paste **everything inside the box below** into Google AI Studio's "describe an app" box (or chat).
> Complete build spec for the **team availability & scheduling** app (the calendar half).
> Heavy detail on the timezone Gantt, week heatmap, and availability logic.
>
> ⚠️ Two real-world dependencies AI Studio will confirm: (1) cross-user calendar access needs your
> Workspace admin to set up **domain-wide delegation** (or each user consents individually); (2) for
> 200–300 users you **export** and host on your own Google Cloud. Use a **paid / Vertex** account.

---

```
Build a full-stack web app called "Faria Calendar — find a time that works."

PURPOSE
A SMART LAYER ON TOP OF GOOGLE CALENDAR (not a replacement) for a remote,
cross-timezone company. It shows — on MY timezone clock — when my teammates are
free, strips calendar noise, categorizes meetings (committed vs optional), supports
fragmented working hours, and finds the best meeting slots across time zones.
Do NOT rebuild event creation/recurring/reminders — Google already does those.

TECH STACK (use exactly this)
- Frontend: React 19 + Vite + TypeScript + Tailwind v4 + shadcn/ui + Motion
  (motion/react) + lucide-react + Luxon (for timezones). Data via TanStack Query.
- Backend: Node.js + Express + googleapis. Database: Postgres (or Firestore).
- Auth: Google OAuth2 (calendar scopes ONLY — no Gmail), JWT httpOnly cookie,
  company-domain restriction. Secrets server-side; refresh tokens encrypted at rest.
- Exportable repo.

DESIGN SYSTEM (match precisely — dark, modern, futuristic, glassmorphic)
- Dark only. Background #070A14 with a subtle animated aurora (blue/purple/cyan
  radial glows + slow rotating conic gradient).
- Glass panels: rgba(20,27,48,0.55), 1px border rgba(255,255,255,0.08), backdrop-blur,
  soft shadow, radius 14–18px.
- Text: #EAF0FF / #AEB9D6 / #6B779C. Accents: blue #6D8BFF, purple #A78BFA, cyan #5EEAD4
  (blue→purple gradient for active/primary, with glow).
- FOUR AVAILABILITY LEVELS with colors (used everywhere):
  • Level 0 Free       = green  #34D399
  • Level 1 Likely free = cyan   #5EEAD4
  • Level 2 Tentative  = amber  #FBBF24
  • Level 3 Busy/off   = red    #FB7185
- Fonts: headings "Space Grotesk", body "Inter". Tabular numbers for times.
- Motion: panels rise/fade in; day panels animate when opened; hover-scale on
  heatmap cells; glow on "everyone free" slots.

LAYOUT
- Sticky top bar: logo (small Google-calendar-style mark) + "Faria Calendar".
- Left sidebar (sticky): People selector + toggles + a color legend.
- Main column: a Week heatmap on top, then stacked Day detail panels, then a
  ranked "best slots" summary.

LEFT SIDEBAR — People + controls
- People grouped under headings: "You", "Manager", "Team". Each row = checkbox +
  avatar (initials) + name + timezone + a small live status dot. Toggling a person
  recomputes the whole view live. Show "dimmed" when unselected.
- Toggles (switches): "Only accepted meetings block", "Hide optional events",
  "Working hours only", and a per-user mute list (recurring events / sub-calendars).
- Legend: the 4 level colors with labels.

MAIN — Week heatmap (the "which day?" scanner)
- Grid: first column = hour labels (e.g. 08–22), then 7 day columns (Mon–Sun;
  highlight today; weekend lighter).
- Each cell color = how many SELECTED people are free that hour (count where
  level ≤ 1), on a green scale (brighter = more free; full green + glow = everyone).
- Day headers are clickable: click to OPEN that day's detail panel below; click
  again to close. Multiple days can be open at once (stacked, for comparison).

MAIN — Day detail panel (timezone Gantt; one per opened day, STACKED)
- Header: day name (+ "Today"), a "🧹 N noise events hidden" badge, and a ✕ to close.
- A time ruler (00–24, or 08–23 if "working hours only").
- One ROW per selected person: left = avatar + name + timezone; right = a track:
  • a subtle WORKING-HOURS band (supports FRAGMENTED hours, e.g. [[9,12],[16,19]]).
  • EVENT blocks positioned by time, colored by category: committed = red #FB7185,
    tentative = amber #FBBF24, optional = dashed blue. (Hidden/noise events are NOT
    drawn — see noise filter.)
  • a thin "now" line at the current time (viewer clock).
  • unselected people dim; weekend rows show as off.
- Below the rows: an "Everyone free" strip — green glowing bars where ALL selected
  people are free (level ≤ 1); if none, show "No slot fits all N — remove someone
  or try another day".
- A line: "Best on <day>: HH:MM–HH:MM works for all N selected".

GOOGLE CALENDAR DATA (backend)
- events.list (own calendar + any colleague calendars you can read), with
  singleEvents=true, orderBy=startTime, and fields:
  items(id,summary,start,end,status,eventType,transparency,
        attendees(email,self,optional,responseStatus))
- freebusy.query for teammates you can only see as free/busy (send multiple emails
  in one request).
- calendarList.list to let the user choose which calendars to include.

NOISE FILTER (per event — implement exactly)
- eventType in {workingLocation, birthday, fromGmail}  → HIDE (count as "noise")
- status == "cancelled"                                → HIDE
- my responseStatus == "declined"                      → HIDE (you're free)
- eventType == "outOfOffice"                            → UNAVAILABLE (level 3)
- transparency == "transparent"                         → NON-BLOCKING (level ≤ 1)
- else (opaque, default/focusTime):
    my responseStatus == "accepted"                     → COMMITTED (level 3)
    my responseStatus in {needsAction, tentative}
      OR my attendee.optional == true
      OR attendees.length >= 15 (broadcast)             → TENTATIVE/optional (level 2)
("my" = the attendee entry where self==true. For teammates seen via FreeBusy there
is no responseStatus, so every busy block = level 3.)

AVAILABILITY LEVEL for a person at viewer-hour h on day D
- weekend OR h not in any working segment → 3
- else over the filtered events covering h: any committed → 3; else any tentative
  → 2; else any "likely-free only" → 1; else → 0.

TIMEZONE MATH (Luxon; DST-safe; never hard-code offsets)
- Render everyone on the VIEWER's IANA timezone, as hours-from-viewer-midnight.
- toViewerHour(personTz, D, localHour): build the person's local DateTime on D,
  setZone(viewerTz), return diff from viewer midnight in hours.
- isoToViewerHour(iso, D) for FreeBusy ISO instants.
- STRICT ONE-BAND RULE: render a working band only if its START (in viewer hours)
  falls in [0,24) — prevents a neighbouring day's band bleeding onto the wrong side.
- Handle half-hour zones (Asia/Kolkata +5:30) and DST automatically via IANA tz.

GROUP OVERLAP + BEST SLOTS
- commonFree(selected, D, minDuration=0.5h): scan 0..24 in 0.5h steps; a slot is
  "open" if every selected person has level ≤ 1; merge runs ≥ minDuration.
- bestSlots(D): the open runs sorted by duration (then by being closer to mid-day
  overlap). Show the top one in the day panel; a ranked list in the summary.

CROSS-USER CALENDAR ACCESS (the multi-user core)
- Either: each teammate signs in once and authorizes (store encrypted refresh token),
  OR a Google Service Account with DOMAIN-WIDE DELEGATION (configured by the Workspace
  admin) so the backend can query free/busy for any company email. Build for both;
  prefer delegation for 200–300 users.

DATA MODEL
- users: { id, email, name, picture, viewer_tz, role, encrypted_refresh_token }
- work_hours: { user_id, segments: [[startLocalHour,endLocalHour], ...] }  // fragmented
- preferences: { user_id, muted_titles[], muted_calendar_ids[], broadcast_threshold }
- included_calendars: { user_id, calendar_id, include:bool }
(Compute availability live; cache lightly with short TTL; store NO event bodies.)

API
- GET /api/me ; POST /api/me/hours (fragmented segments)
- GET /api/people (selectable directory/roster)
- GET /api/day?date=YYYY-MM-DD&people=ids → per-person rows (working band +
  filtered events + per-slot levels) + freeSlots[] + hiddenCount
- GET /api/week?start=YYYY-MM-DD&people=ids → 7-day heatmap matrix + ranked best slots
- GET /api/my-day?date=... → my own meetings categorized (committed/tentative/optional)
- POST /api/prefs → mutes / toggles / broadcast threshold

PRIVACY & SECURITY
- Calendar FreeBusy + own events ONLY — NO Gmail. Least-privilege scopes.
- Store preferences, not event contents. Encrypt tokens at rest. HTTPS in prod.
- For any optional AI ("find me a time" in natural language), use PAID / Vertex only.

ACCEPTANCE CRITERIA
1. Sign in (calendar scope only); set fragmented working hours.
2. Select people (grouped) → week heatmap shows group availability in the 4-level scale.
3. Click days → stacked Gantt panels on the viewer clock; noise stripped; events
   colored by level; live now line.
4. "Everyone free" slots + ranked best slots compute correctly across time zones
   (DST-safe, half-hour zones), updating live as people are toggled.
5. For my own calendar, optional/unconfirmed meetings show but DON'T block; toggles work.
6. No Gmail access; tokens encrypted; dark futuristic UI matching the design system.
```
