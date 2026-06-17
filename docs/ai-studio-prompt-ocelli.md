# AI Studio Prompt — Ocelli (Work Message & Notification Dashboard)

> Paste **everything inside the box below** into Google AI Studio's "describe an app" box (or chat).
> It's a complete build spec. This app is the **messages / notifications / triage** dashboard —
> **no calendar features** (those live in the separate Faria Calendar app).
> Use a **paid / Vertex** account for any company data.

---

```
Build a full-stack web app called "Ocelli — the extra eyes on your work."

PURPOSE
A unified work dashboard for professionals. It pulls work items from multiple
tools (Slack, Gmail, Zendesk, Google Sheets), automatically SORTS each into one
of three buckets, and TRACKS each until it's done, so nothing slips. It does NOT
manage a calendar — it's about messages, notifications, and to-dos only.

TECH STACK (use exactly this)
- Frontend: React 19 + Vite + TypeScript + Tailwind CSS v4 + shadcn/ui + Motion
  (motion/react) + lucide-react. State/data via TanStack Query.
- Backend: Node.js + Express. Database: Postgres (or Firestore). Auth: Google
  OAuth2, session as a JWT in an httpOnly cookie; restrict sign-in to a company
  domain. Secrets server-side only.
- Provide an exportable repo.

DESIGN SYSTEM (match precisely — dark, modern, futuristic, glassmorphic)
- Dark mode only. Background #070A14 with a subtle ANIMATED AURORA: soft radial
  glows in blue/purple/cyan plus a very slow rotating conic gradient.
- Glass panels: background rgba(20,27,48,0.55), 1px border rgba(255,255,255,0.08),
  backdrop-blur, soft large shadow, radius 16–18px.
- Text: primary #EAF0FF, secondary #AEB9D6, muted #6B779C.
- Accents: blue #6D8BFF, purple #A78BFA, cyan #5EEAD4 (use a blue→purple gradient
  for primary buttons/active states, with a soft glow).
- Status colors: Needs reply = amber #FBBF24, To finish = red #FB7185,
  FYI = blue #60A5FA, positive/free = green #34D399.
- Fonts: headings "Space Grotesk", body "Inter" (or Geist). Tabular numbers for
  times/counts.
- Motion: panels fade/rise in on load; numbers count up; inbox items animate in
  and slide out when actioned; active tab and buttons have a soft glow; hover-lift
  on rows.

LAYOUT
- Sticky top bar: logo = a small glowing dot + "Ocelli" in a white→blue gradient;
  then the signed-in user's avatar/name on the right.
- Main = a two-column grid (left ~340px, right flexible), under a full-width hero.

SCREEN — the hero "Morning brief"
- Glass card. Greeting by time of day + the user's first name + a small badge:
  "AI BRIEF" (cyan glow) if AI is on, else "RULES".
- A short natural-language paragraph: what to focus on first and why.
- Four stat cards with COUNT-UP animation: "Needs reply" (amber), "To finish"
  (red), "FYI" (blue), and "Done today" (green).

LEFT COLUMN — "My tasks" (simple to-do, NO calendar)
- A checklist: add a task (text + optional estimate), tick to complete (strike-
  through), delete. Persist per user. No calendar/scheduling.

RIGHT COLUMN — "Inbox — everything that needs you" (the core)
- Filter tabs (pill style, active = blue→purple gradient with glow): All / 🟠 Needs
  reply / 🔴 To finish / 🔵 FYI / ✅ Done, each showing a live count.
- A quick-add row: type text → it's auto-sorted by the rules engine and added.
- A "Sync" button (spinner while running) that pulls from connectors; show
  "+N new" or a clear error banner (e.g. an "enable API / reconnect" link) on
  failure — never a silent spinner.
- Each inbox item row:
  • a colored SOURCE badge: slack (purple gradient), gmail (red gradient),
    zendesk (teal gradient), sheets (green gradient), ocelli (blue→purple),
    manual (grey).
  • sender (bold) + an external-link icon if it has a link.
  • the message text (muted).
  • a CATEGORY chip (reply/finish/fyi colors above) + a due-date label (red) +
    a relative time ("2 h ago") + a small "· why: <reasons>" note showing why it
    was sorted (transparency).
  • action buttons: "✓ Done" (green gradient) and "⏰ Snooze" for open items;
    "↩ Reopen" for done items. Done items move to the Done tab; snoozed items
    hide and return next morning at 06:00.

TRIAGE RULES ENGINE (deterministic, NO AI — implement exactly, first match wins)
classifyItem({src, from, text, due?, meta?}) → { cat, due, reasons[] }
  1. src=="zendesk" OR meta.assignedTicket            → finish
  2. meta.awaitingAccept                              → reply
  3. meta.actionItem                                  → finish
  4. sender is no-reply / "newsletter"/"digest"/"announcement"/"no action needed"
     (and not a DM/mention)                           → fyi
  5. a "do" verb (fill|submit|complete|sign|upload|finish|prepare|send|deliver|
     form|sheet|survey|okr|report|timesheet) AND a deadline → finish
  6. a question ("?", "can you", "could you", "please", "let me know",
     "your review/approval/input/feedback", "wdyt") → reply
  7. a direct message or @mention                     → reply
  8. a deadline alone                                 → finish
  9. default                                          → reply  (never silently miss)
parseDue(text): detect "today/tonight/eod/asap", "tomorrow", "by/﻿before/due <weekday>",
  "<Month> <day>" / "<day> <Month>" → return YYYY-MM-DD (roll to next year if past).
Each item stores its matched reasons[] so the UI can show "why".

SOURCES / CONNECTORS
- A generic intake endpoint POST /api/ingest?token=... that any tool (Zapier,
  Apps Script, pollers) can push to; items are classified by the rules engine.
- Gmail connector: read-only, poll recent inbox, filter out promotions/social/
  no-reply, classify, store deduped by message id.
- Slack/Zendesk: backend uses official SDKs/REST (server-side tokens) to pull
  DMs/@mentions and assigned tickets; push through the same rules.
- All read-only. Never send/delete anything.

DATA MODEL
- users: { id, email, name, picture, role }
- items: { id, user, src, from, text, cat(reply|finish|fyi), due, reasons[],
           status(open|snoozed|done), createdAt, link?, snoozeUntil?, doneAt? }
- tasks: { id, user, text, est?, done, createdAt }

API (JWT cookie auth)
- GET /api/me
- GET /api/items ; POST /api/items {from,text,src?} ;
  POST /api/items/:id/status {action: done|snooze|reopen}
- GET /api/tasks ; POST /api/tasks {text,est?} ; POST /api/tasks/:id {done?,deleted?}
- POST /api/ingest?token=... ; POST /api/gmail/sync
- GET /api/brief (template by default; upgraded by AI if configured)

OPTIONAL AI "BRAIN" (off by default; thinks, never acts)
- A single aiComplete(prompt) function that calls an LLM only when an API key is
  set, else returns null (rules fallback). Use it to (a) write the morning brief
  in natural language, (b) optionally summarize long items and suggest replies.
- For company data, call a PAID / Vertex endpoint (data not used for training) —
  never a free tier. Keep cost low: rules-first, only call AI on demand, cache.

BEHAVIOR NOTES
- Snooze returns items at 06:00 next morning.
- Everything degrades gracefully with no AI key (rules only).
- Read-only everywhere; nothing is sent without the user.

ACCEPTANCE CRITERIA
1. Google sign-in; dashboard loads the user's items + tasks.
2. Inbox shows items with correct category, due, "why", source badge.
3. Tabs filter; counts are live; quick-add classifies correctly.
4. Done / Snooze / Reopen work and persist; snoozed items return next morning.
5. Brief shows counts (and natural language if AI on).
6. Dark futuristic UI with the colors, glass panels, and animations above.
```
