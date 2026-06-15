# Ocelli

*The extra eyes on your work. Nothing slips.*

A unified work dashboard for professionals: it watches all your tools (Slack, Gmail, Zendesk, Sheets, Calendar), triages everything into 🔵 FYI / 🟠 Needs reply / 🔴 To finish, and tracks each item until done. It also shows your day, your team's timezone overlap, and the best times to meet.

> Formerly **TimeSync** (a timezone-scheduling tool); renamed as the product grew into a full work dashboard. See [PROJECT_BRIEF.md](PROJECT_BRIEF.md) for full context.

## What it does

**Scheduling (the core)**
- Gantt-style rows, one per teammate, all converted to *your* timezone, with day/night shading
- Live busy blocks from **Google Calendar** (FreeBusy API) — no manual entry
- Color states: green band = working hours, red = busy, **amber = requested but unconfirmed** (so colleagues see a slot is already being negotiated), **dark green = confirmed**
- Select 2+ people → green overlap strip → click → request sent with times shown in each person's timezone
- When everyone accepts: a real Google Calendar event with invites is created automatically

**Meeting memory (the assistant)**
- Every meeting can hold notes + action items (with owner and done/open status)
- Meetings with the same title & people form a *series*; before the next one, click **Prep brief** → AI writes: what was discussed last time, what got done, what's still open, suggested agenda

**Slack layer**
- Channel notification when a meeting is requested / confirmed (with calendar link) / declined
- Weekly digest every Monday: team clocks + meeting count
- Daily nudge listing open action items and their owners

**AI layer** — pluggable: set a **Gemini API key** (free from Google AI Studio) *or* an Anthropic key. Without either, everything still works with template-based briefs.

## Architecture (hub & spoke)

```
Google Calendar ──(FreeBusy / Events API)──┐
Gemini / Claude ──(summaries & briefs)─────┼──► Ocelli server ──► browser UI
Slack ◄──(incoming webhook notifications)──┘        (Node.js)
```

One server. Employees install nothing — they open the URL and sign in with their company Google account.

## Quick start (local, ~20 min)

1. **Google Cloud**: console.cloud.google.com → new project → enable **Google Calendar API** → OAuth consent screen, type **Internal** → Credentials → OAuth client ID (Web), redirect URI `http://localhost:3000/auth/callback` → copy Client ID + Secret.
2. `cp .env.example .env` and fill in the Google credentials + a JWT secret.
3. `npm install && npm start` → open http://localhost:3000 → sign in.

Each optional integration (Gemini, Slack) is a single `.env` value — instructions are inline in `.env.example`.

## Hosting (so it doesn't depend on you)

Your laptop is only for development. For real use, the app must run on an always-on host:

**Pilot — Railway or Render (free tier, ~15 min):**
1. Push this folder to a private GitHub repo.
2. railway.app → New Project → Deploy from GitHub → it detects Node automatically.
3. Add your `.env` values as environment variables; set `BASE_URL` to the URL Railway gives you.
4. Add `https://<that-url>/auth/callback` to your Google OAuth client's redirect URIs.
5. Attach a small persistent volume and set `DB_PATH` to it (so `db.json` survives restarts).
6. Share the URL with your team. Done — nothing runs on your Mac.

**Production — company infrastructure:** hand IT the repo + `Dockerfile`. They run it on the company cloud under a company domain, with the OAuth consent screen already restricted to the Workspace org. `db.json` should be swapped for SQLite/Postgres at org scale (the storage layer is just two functions in `server.js`).

## Security & privacy answers (for IT)

- OAuth consent screen type "Internal" + `ALLOWED_DOMAIN` → only company accounts can sign in
- Calendar access is **busy/free blocks only** via FreeBusy — the app never reads other people's event titles
- Refresh tokens live server-side in the database; serve over HTTPS in production

## v2 ideas

Best-time-this-week auto-suggester ranked by "humane hours" for every attendee, public-holiday awareness per country, Slack slash-command (`/ocelli @sarah 60`), per-person meeting-load analytics (late-night fairness score), focus-time protection blocks.
