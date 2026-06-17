# Faria Calendar — Validation Prompt & Checklist

> Paste **the box below** into AI Studio (in the same workspace where it built the app) to make it
> AUDIT its own code against our spec and report what's present / missing / broken — then fix.
> The checklist underneath doubles as a manual QA list.
> Known gap from first build: the **stacked day-detail Gantt** is missing; verify availability logic too.

---

```
Audit the Faria Calendar app you built against the spec below. For EACH item,
reply with: PRESENT / PARTIAL / MISSING, the file:line where it lives (or should),
and — if not fully present — implement the fix. Do not claim "done" unless the
behavior actually works. Be strict and literal.

=== A. CORE SCREENS ===
A1. Top bar with app name + signed-in user + viewer timezone.
A2. Left sidebar: teammate roster grouped (You / Manager / Colleagues), each with
    checkbox, avatar, name, timezone, live status dot; Select All / Deselect All.
A3. Toggles: "Only accepted meetings block", "Hide optional invitations",
    "Show working hours only", and a "Broadcast threshold" slider (default 15).
A4. Legend showing the 4 levels with correct colors.
A5. Week 7-day overlap heatmap (hours × days), today highlighted, weekend lighter.
A6. **Day-detail Gantt panel** that OPENS when a day is clicked (SEE SECTION B —
    this is the part most likely missing).
A7. A ranked "best slots" summary.

=== B. DAY-DETAIL GANTT (verify carefully — reported missing) ===
B1. Clicking a day header/cell OPENS a detail panel for that day; clicking again closes it.
B2. MULTIPLE days can be open at once, STACKED vertically, to compare.
B3. The panel shows a time ruler and ONE ROW PER SELECTED PERSON.
B4. Each row: left = avatar + name + timezone; right = a horizontal track.
B5. The track shows a subtle WORKING-HOURS band, supporting FRAGMENTED hours
    (e.g. [[9,12],[16,19]]), positioned on the VIEWER's clock.
B6. EVENT blocks are drawn on the track, colored by category:
    committed = red, tentative = amber, optional = dashed blue. Noise events are NOT drawn.
B7. A thin "now" line at the current viewer time.
B8. An "Everyone free" strip = green bars where ALL selected people are level ≤ 1;
    if none, a message "No slot fits all N — remove someone or try another day".
B9. A "🧹 N noise events hidden" badge and a "Best on <day>: HH:MM–HH:MM" line.
=> If any of B1–B9 is missing, BUILD IT to match.

=== C. AVAILABILITY LOGIC (verify the math) ===
C1. levelAt(person, day, hour): weekend/outside-working-hours = 3; committed = 3;
    tentative = 2; likely-free (only declined/transparent) = 1; else 0.
C2. Heatmap cell value = COUNT of selected people with level ≤ 1 (free-ish) at that hour.
C3. "Everyone free" = ALL selected people level ≤ 1.
C4. bestSlots = open runs (all ≤ 1, ≥ 30 min) ranked by duration.
C5. Toggling people / toggles RECOMPUTES everything live.
C6. Confirm the colors/counts in the heatmap actually reflect C1–C2 (not random).

=== D. TIMEZONE MATH (Luxon, DST-safe) ===
D1. Everyone rendered on the VIEWER's IANA timezone.
D2. Half-hour zones correct (Asia/Kolkata +5:30) and DST handled — no hard-coded offsets.
D3. STRICT ONE-BAND RULE: a working band renders only if its START (viewer hours)
    is within [0,24) — no neighbouring-day bleed.
D4. Fragmented working-hour segments supported per person.

=== E. NOISE FILTER & MEETING CATEGORIZATION ===
E1. eventType in {workingLocation, birthday, fromGmail} → hidden (counted as noise).
E2. status == cancelled → hidden; my responseStatus == declined → hidden.
E3. eventType == outOfOffice → unavailable (level 3).
E4. transparency == transparent → non-blocking (level ≤ 1).
E5. opaque + accepted → committed (3); needsAction/tentative/optional/attendees≥threshold
    → tentative (2). "my" attendee = the one with self==true.
E6. The toggles (only-accepted, hide-optional, working-hours-only, broadcast threshold)
    ACTUALLY change the computed levels, not just the display.

=== F. DATA SOURCE — REAL vs MOCK (critical) ===
F1. Is the calendar data REAL (Google Calendar API) or mock/seeded? State clearly.
F2. If real: backend uses freebusy.query (batched, multiple emails) and events.list
    with fields items(id,summary,start,end,status,eventType,transparency,
    attendees(email,self,optional,responseStatus)).
F3. Cross-user access path implemented: individual OAuth consent (store encrypted
    refresh token) AND/OR service account with domain-wide delegation.
F4. If still mock, list exactly what's needed to switch to live data.

=== G. BACKEND / API / DATA MODEL ===
G1. Real Express backend (not client-only) with a persistent DB (Postgres/Firestore).
G2. Endpoints: GET /api/me, POST /api/me/hours, GET /api/people,
    GET /api/day?date&people, GET /api/week?start&people, GET /api/my-day, POST /api/prefs.
G3. Data model: users, work_hours (fragmented segments), preferences
    (muted_titles, muted_calendar_ids, broadcast_threshold), included_calendars.
G4. Stores preferences only — NO event bodies persisted.

=== H. PRIVACY & SECURITY ===
H1. Calendar scopes ONLY — NO Gmail scope anywhere.
H2. Refresh tokens encrypted at rest; session = httpOnly cookie; company-domain restriction.
H3. Any AI calls use a PAID / Vertex endpoint (never free tier).

=== I. DESIGN SYSTEM FIDELITY ===
I1. Dark + animated aurora background; glassmorphic panels.
I2. Colors: bg #070A14; accents blue #6D8BFF / purple #A78BFA / cyan #5EEAD4;
    levels green #34D399 / cyan #5EEAD4 / amber #FBBF24 / red #FB7185.
I3. Fonts: Space Grotesk (headings) + Inter; tabular numbers for times.
I4. Animations: panels rise/fade; heatmap hover-scale; glow on "everyone free".

=== OUTPUT FORMAT ===
Return a table: Item | Status (PRESENT/PARTIAL/MISSING) | Where | Fix applied (y/n).
Then implement every MISSING/PARTIAL item (priority: Section B the Gantt, then C, then F).
Finally, list anything in the app that is NOT in this spec (extra/incorrect).
```

---

## Quick human QA checklist (click through the running app)
- [ ] Click a **day** → does a **detail Gantt** open with one row per person? *(reported missing)*
- [ ] Can you open **2–3 days at once**, stacked, to compare?
- [ ] In a day row: **working band + event blocks colored by level + now line + "everyone free" strip + "noise hidden" badge**?
- [ ] Toggle a person off → heatmap + free slots **recompute**?
- [ ] Flip **"Only accepted meetings block"** / **"Hide optional"** → do the numbers change?
- [ ] **Aarav (Kolkata +5:30)** shows the correct local time and band (DST/half-hour)?
- [ ] Is the data **real Google Calendar** or **mock**? (Check Section F.)
- [ ] Any **Gmail** scope requested? (Should be **none**.)

## After the audit
1. Have AI Studio **fix the MISSING items** (Gantt first).
2. **Export** the repo and re-check against `docs/build-blueprint.md §B14`.
3. Before real data: confirm **paid/Vertex tier** + the **cross-user access** path with IT.
