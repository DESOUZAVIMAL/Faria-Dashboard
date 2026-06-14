/* TimeSync — timezone-aware team availability dashboard
 * Backend: Google OAuth2 sign-in, FreeBusy queries for every team member,
 * meeting requests with pending/confirmed states, and automatic Google
 * Calendar event creation (with Meet link) when a request is accepted.
 */
require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { google } = require("googleapis");
const { classifyItem } = require("./rules");

// Optional: AI-generated meeting briefs (works without it, just less smart)
let Anthropic = null;
try { Anthropic = require("@anthropic-ai/sdk"); } catch { /* not installed */ }
let cron = null;
try { cron = require("node-cron"); } catch { /* not installed */ }

/* ── AI helper: uses Gemini if GEMINI_API_KEY is set, else Claude, else null.
 * Everything that calls this degrades gracefully to a non-AI fallback. ── */
async function aiComplete(prompt, maxTokens = 700) {
  if (process.env.GEMINI_API_KEY) {
    try {
      const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: maxTokens },
          }),
        }
      );
      const j = await r.json();
      const t = j.candidates?.[0]?.content?.parts?.map((p) => p.text).join("");
      if (t) return t;
      console.warn("Gemini returned no text:", JSON.stringify(j).slice(0, 200));
    } catch (e) { console.warn("Gemini failed:", e.message); }
  }
  if (Anthropic && process.env.ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const msg = await client.messages.create({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      });
      return msg.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    } catch (e) { console.warn("Claude failed:", e.message); }
  }
  return null;
}

/* ── Slack helper: posts to an incoming-webhook URL if configured ── */
async function slackNotify(text) {
  if (!process.env.SLACK_WEBHOOK_URL) return;
  try {
    await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (e) { console.warn("Slack notify failed:", e.message); }
}

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "db.json");
const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN || ""; // e.g. "yourcompany.com" to restrict sign-in

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

/* ── tiny JSON-file database ── */
function loadDB() {
  let db;
  try {
    db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch {
    db = {};
  }
  // normalize shape so new collections exist on older db files
  db.users ||= {};
  db.requests ||= [];
  db.items ||= [];      // ingested work items (slack/gmail/zendesk/manual…)
  db.tasks ||= [];      // personal tasks
  db.itemStates ||= {}; // status overrides for synthesized items, keyed "email|itemId"
  return db;
}
function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${BASE_URL}/auth/callback`
  );
}

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

/* ── auth ── */
app.get("/auth/google", (req, res) => {
  const url = oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
  res.redirect(url);
});

app.get("/auth/callback", async (req, res) => {
  try {
    const client = oauthClient();
    const { tokens } = await client.getToken(req.query.code);
    client.setCredentials(tokens);

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload.email.toLowerCase();

    if (ALLOWED_DOMAIN && !email.endsWith("@" + ALLOWED_DOMAIN)) {
      return res.status(403).send(`Sign-in restricted to @${ALLOWED_DOMAIN} accounts.`);
    }

    // pull the user's calendar timezone so rows render correctly with zero setup
    let tz = "UTC";
    try {
      const cal = google.calendar({ version: "v3", auth: client });
      const primary = await cal.calendars.get({ calendarId: "primary" });
      tz = primary.data.timeZone || "UTC";
    } catch (e) {
      console.warn("could not read calendar tz:", e.message);
    }

    const db = loadDB();
    const existing = db.users[email] || {};
    db.users[email] = {
      email,
      name: payload.name || email,
      picture: payload.picture || "",
      tz,
      workStart: existing.workStart ?? 9,
      workEnd: existing.workEnd ?? 18,
      role: existing.role || "",
      // Google only returns a refresh_token on first consent; keep the old one otherwise
      refresh_token: tokens.refresh_token || existing.refresh_token || null,
    };
    saveDB(db);

    const session = jwt.sign({ email }, JWT_SECRET, { expiresIn: "30d" });
    res.cookie("session", session, { httpOnly: true, sameSite: "lax", maxAge: 30 * 864e5 });
    res.redirect("/");
  } catch (e) {
    console.error(e);
    res.status(500).send("Sign-in failed. Check server logs.");
  }
});

app.post("/auth/logout", (req, res) => {
  res.clearCookie("session");
  res.json({ ok: true });
});

function requireAuth(req, res, next) {
  try {
    const { email } = jwt.verify(req.cookies.session, JWT_SECRET);
    const db = loadDB();
    if (!db.users[email]) throw new Error("unknown user");
    req.user = db.users[email];
    next();
  } catch {
    res.status(401).json({ error: "not signed in" });
  }
}

function authedClientFor(user) {
  const client = oauthClient();
  client.setCredentials({ refresh_token: user.refresh_token });
  return client;
}

/* ── profile & team ── */
app.get("/api/me", requireAuth, (req, res) => {
  const { refresh_token, ...me } = req.user;
  res.json(me);
});

app.post("/api/me", requireAuth, (req, res) => {
  const db = loadDB();
  const u = db.users[req.user.email];
  const { workStart, workEnd, role, tz } = req.body;
  if (workStart !== undefined) u.workStart = Math.min(23, Math.max(0, +workStart));
  if (workEnd !== undefined) u.workEnd = Math.min(24, Math.max(1, +workEnd));
  if (role !== undefined) u.role = String(role).slice(0, 60);
  if (tz) u.tz = tz;
  saveDB(db);
  const { refresh_token, ...me } = u;
  res.json(me);
});

app.get("/api/team", requireAuth, (req, res) => {
  const db = loadDB();
  res.json(
    Object.values(db.users).map(({ refresh_token, ...u }) => ({
      ...u,
      connected: !!refresh_token,
    }))
  );
});

/* ── availability: live FreeBusy for the whole team ── */
app.get("/api/availability", requireAuth, async (req, res) => {
  const { start, end } = req.query; // ISO strings for the viewer's chosen day window
  if (!start || !end) return res.status(400).json({ error: "start and end required" });

  const db = loadDB();
  const users = Object.values(db.users);

  const results = await Promise.all(
    users.map(async (u) => {
      const base = {
        email: u.email,
        name: u.name,
        picture: u.picture,
        role: u.role,
        tz: u.tz,
        workStart: u.workStart,
        workEnd: u.workEnd,
        busy: [],
        connected: !!u.refresh_token,
      };
      if (!u.refresh_token) return base;
      try {
        const cal = google.calendar({ version: "v3", auth: authedClientFor(u) });
        const fb = await cal.freebusy.query({
          requestBody: {
            timeMin: start,
            timeMax: end,
            items: [{ id: "primary" }],
          },
        });
        base.busy = (fb.data.calendars.primary.busy || []).map((b) => ({
          start: b.start,
          end: b.end,
        }));
      } catch (e) {
        console.warn(`freebusy failed for ${u.email}:`, e.message);
        base.error = true;
      }
      return base;
    })
  );

  res.json(results);
});

/* ── meeting requests ── */
app.get("/api/requests", requireAuth, (req, res) => {
  const db = loadDB();
  res.json(db.requests.slice().reverse());
});

app.post("/api/requests", requireAuth, (req, res) => {
  const { title, start, end, attendees } = req.body;
  if (!title || !start || !end || !Array.isArray(attendees) || attendees.length === 0) {
    return res.status(400).json({ error: "title, start, end, attendees required" });
  }
  const db = loadDB();
  const reqObj = {
    id: crypto.randomUUID(),
    title: String(title).slice(0, 120),
    start,
    end,
    requester: req.user.email,
    requesterName: req.user.name,
    attendees: attendees.filter((a) => db.users[a]),
    status: "pending", // pending → confirmed | declined
    responses: {},
    notes: "",
    actions: [], // { text, owner, done }
    createdAt: new Date().toISOString(),
    eventLink: null,
  };
  db.requests.push(reqObj);
  saveDB(db);
  const when = new Intl.DateTimeFormat("en-GB", { timeZone: req.user.tz, dateStyle: "medium", timeStyle: "short" })
    .format(new Date(reqObj.start));
  slackNotify(`🗓️ *${req.user.name}* requested *${reqObj.title}* with ${reqObj.attendees.join(", ")} — ${when} (${req.user.tz}). Awaiting acceptance in TimeSync.`);
  res.json(reqObj);
});

app.post("/api/requests/:id/respond", requireAuth, async (req, res) => {
  const { action } = req.body; // "accept" | "decline"
  const db = loadDB();
  const r = db.requests.find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: "not found" });
  if (!r.attendees.includes(req.user.email) && r.requester !== req.user.email) {
    return res.status(403).json({ error: "only invited people can respond" });
  }

  r.responses[req.user.email] = action;

  if (action === "decline") {
    r.status = "declined";
    slackNotify(`✖️ ${req.user.name} declined *${r.title}* — pick a new slot in TimeSync.`);
  } else {
    const everyoneAccepted = r.attendees.every((a) => r.responses[a] === "accept");
    if (everyoneAccepted) {
      r.status = "confirmed";
      // create the real Google Calendar event with a Meet link
      try {
        const requester = db.users[r.requester];
        if (requester && requester.refresh_token) {
          const cal = google.calendar({ version: "v3", auth: authedClientFor(requester) });
          const ev = await cal.events.insert({
            calendarId: "primary",
            conferenceDataVersion: 1,
            sendUpdates: "all",
            requestBody: {
              summary: r.title,
              start: { dateTime: r.start },
              end: { dateTime: r.end },
              attendees: [r.requester, ...r.attendees].map((email) => ({ email })),
              conferenceData: {
                createRequest: { requestId: r.id, conferenceSolutionKey: { type: "hangoutsMeet" } },
              },
              description: "Scheduled via TimeSync",
            },
          });
          r.eventLink = ev.data.htmlLink || null;
        }
      } catch (e) {
        console.warn("event creation failed:", e.message);
      }
      slackNotify(`✅ *${r.title}* confirmed by everyone${r.eventLink ? ` — <${r.eventLink}|open in Google Calendar>` : ""}. Meet link is on the invite.`);
    }
  }
  saveDB(db);
  res.json(r);
});

app.delete("/api/requests/:id", requireAuth, (req, res) => {
  const db = loadDB();
  const i = db.requests.findIndex((x) => x.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: "not found" });
  if (db.requests[i].requester !== req.user.email) {
    return res.status(403).json({ error: "only the requester can cancel" });
  }
  db.requests.splice(i, 1);
  saveDB(db);
  res.json({ ok: true });
});

/* ── Meeting Memory: notes, action items, prep briefs ──
 * Meetings with the same title + same people form a "series".
 * Before the next one, the app assembles what was discussed last
 * time and which action items are still open — optionally written
 * up by Claude if ANTHROPIC_API_KEY is set.
 */
const seriesKey = (r) =>
  r.title.toLowerCase().trim() + "|" + [r.requester, ...r.attendees].sort().join(",");

const isParticipant = (r, email) => r.requester === email || r.attendees.includes(email);

app.post("/api/requests/:id/notes", requireAuth, (req, res) => {
  const db = loadDB();
  const r = db.requests.find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: "not found" });
  if (!isParticipant(r, req.user.email)) return res.status(403).json({ error: "participants only" });

  if (typeof req.body.notes === "string") r.notes = req.body.notes.slice(0, 5000);
  if (Array.isArray(req.body.actions)) {
    r.actions = req.body.actions.slice(0, 30).map((a) => ({
      text: String(a.text || "").slice(0, 300),
      owner: String(a.owner || "").slice(0, 100),
      done: !!a.done,
    }));
  }
  saveDB(db);
  res.json(r);
});

app.post("/api/requests/:id/actions/:idx/toggle", requireAuth, (req, res) => {
  const db = loadDB();
  const r = db.requests.find((x) => x.id === req.params.id);
  if (!r || !r.actions[req.params.idx]) return res.status(404).json({ error: "not found" });
  if (!isParticipant(r, req.user.email)) return res.status(403).json({ error: "participants only" });
  r.actions[req.params.idx].done = !r.actions[req.params.idx].done;
  saveDB(db);
  res.json(r);
});

app.get("/api/requests/:id/brief", requireAuth, async (req, res) => {
  const db = loadDB();
  const r = db.requests.find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: "not found" });
  if (!isParticipant(r, req.user.email)) return res.status(403).json({ error: "participants only" });

  const key = seriesKey(r);
  const history = db.requests
    .filter((x) => x.id !== r.id && seriesKey(x) === key && Date.parse(x.start) < Date.parse(r.start))
    .sort((a, b) => Date.parse(b.start) - Date.parse(a.start));

  const last = history[0] || null;
  const pendingActions = history.flatMap((m) =>
    (m.actions || []).filter((a) => !a.done).map((a) => ({ ...a, from: m.start }))
  );
  const doneActions = history.flatMap((m) =>
    (m.actions || []).filter((a) => a.done).map((a) => ({ ...a, from: m.start }))
  );

  if (!last) {
    return res.json({
      brief: "This looks like the first meeting in this series — no history yet. After the meeting, add notes and action items so next time you'll get a full prep brief.",
      pendingActions, lastMeeting: null, meetingsInSeries: 0,
    });
  }

  // Template brief (always available)
  let brief =
    `Last meeting (${new Date(last.start).toDateString()}):\n` +
    (last.notes ? last.notes : "No notes were recorded.") +
    (doneActions.length ? `\n\n✓ Completed since: ${doneActions.map((a) => a.text).join("; ")}` : "") +
    (pendingActions.length
      ? `\n\n→ Still open: ${pendingActions.map((a) => `${a.text}${a.owner ? ` (${a.owner})` : ""}`).join("; ")}`
      : "\n\nNo open action items — nice.");

  // Upgrade to an AI-written brief if Gemini/Claude is configured
  const ai = await aiComplete(
    `You are a meeting prep assistant. Write a short, friendly prep brief (under 150 words) for the upcoming meeting "${r.title}". Use plain text, no markdown headers.\n\n` +
    `Previous meeting notes:\n${last.notes || "(none)"}\n\n` +
    `Completed action items: ${doneActions.map((a) => a.text).join("; ") || "(none)"}\n` +
    `Open action items: ${pendingActions.map((a) => `${a.text} (owner: ${a.owner || "unassigned"})`).join("; ") || "(none)"}\n\n` +
    `Structure: 1) one-line recap of last meeting, 2) what's been done, 3) what's still open and should be discussed, 4) a suggested agenda of 2-4 bullets.`,
    600
  );
  if (ai) brief = ai;

  res.json({ brief, pendingActions, lastMeeting: { start: last.start, notes: last.notes }, meetingsInSeries: history.length });
});


/* ════════════════════════════════════════════════════════════════════
 *  TODAY DASHBOARD — work items (rules-engine triage), personal tasks,
 *  own-calendar agenda with free-gap detection, and the morning brief.
 *  No AI required anywhere here; aiComplete() only upgrades the brief.
 * ════════════════════════════════════════════════════════════════════ */

/* tz helper (same approach as the frontend) */
function tzOffsetMinSrv(tz, atMs) {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    const p = {};
    dtf.formatToParts(new Date(atMs)).forEach((x) => (p[x.type] = x.value));
    const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, p.hour === "24" ? 0 : +p.hour, +p.minute);
    return (asUTC - atMs) / 60000;
  } catch { return 0; }
}
function localHourToInstant(tz, dateStr, hour) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const rough = Date.UTC(y, m - 1, d, Math.floor(hour), Math.round((hour % 1) * 60));
  return rough - tzOffsetMinSrv(tz, rough) * 60000;
}

const firstName = (u) => (u.name || u.email).split(" ")[0].toLowerCase();

/* synthesize items from TimeSync's own state (requests + action items) */
function synthesizeItems(db, user) {
  const out = [];
  for (const r of db.requests) {
    if (r.status === "pending" && r.attendees.includes(user.email) && r.responses[user.email] !== "accept") {
      out.push({
        id: `req-${r.id}`, src: "timesync", from: r.requesterName,
        text: `"${r.title}" is waiting for your Accept.`,
        cat: "reply", due: r.start.slice(0, 10), reasons: ["awaiting-accept"],
        link: "/", createdAt: r.createdAt,
      });
    }
    if (r.status !== "declined") {
      (r.actions || []).forEach((a, i) => {
        const mine = a.owner
          ? a.owner.toLowerCase().includes(firstName(user))
          : r.requester === user.email; // unowned items fall to the requester
        if (!a.done && mine) {
          out.push({
            id: `act-${r.id}-${i}`, src: "timesync", from: `Action item · ${r.title}`,
            text: a.text, cat: "finish", due: null, reasons: ["action-item"],
            link: "/", createdAt: r.createdAt,
          });
        }
      });
    }
  }
  return out;
}

/* GET /api/items — synthesized + stored items, snooze expiry applied */
app.get("/api/items", requireAuth, (req, res) => {
  const db = loadDB();
  const now = Date.now();
  const stateOf = (id) => db.itemStates[`${req.user.email}|${id}`] || { status: "open" };

  let items = [
    ...synthesizeItems(db, req.user).map((x) => ({ ...x, ...stateOf(x.id) })),
    ...db.items.filter((x) => x.user === req.user.email),
  ];
  // snoozes expire at their wake time → item returns as open
  items = items.map((x) =>
    x.status === "snoozed" && x.snoozeUntil && Date.parse(x.snoozeUntil) <= now
      ? { ...x, status: "open" } : x
  );
  const rank = { open: 0, snoozed: 1, done: 2 };
  items.sort((a, b) =>
    rank[a.status] - rank[b.status] ||
    String(a.due || "9999").localeCompare(String(b.due || "9999")) ||
    String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
  );
  res.json(items);
});

/* POST /api/items — manual quick-add; the rules engine classifies it */
app.post("/api/items", requireAuth, (req, res) => {
  const { from = "", text = "", src = "manual", link = null } = req.body || {};
  if (!String(text).trim()) return res.status(400).json({ error: "text required" });
  const { cat, due, reasons } = classifyItem({ src, from, text });
  const db = loadDB();
  const item = {
    id: crypto.randomUUID(), user: req.user.email, src,
    from: String(from).slice(0, 120), text: String(text).slice(0, 500), link,
    cat, due, reasons, status: "open", createdAt: new Date().toISOString(),
  };
  db.items.push(item);
  saveDB(db);
  res.json(item);
});

/* POST /api/items/:id/status  { action: "done" | "snooze" | "reopen" } */
app.post("/api/items/:id/status", requireAuth, (req, res) => {
  const { action } = req.body || {};
  if (!["done", "snooze", "reopen"].includes(action)) return res.status(400).json({ error: "bad action" });
  const db = loadDB();
  const id = req.params.id;

  // snooze wakes tomorrow 06:00 server time → resurfaces in the morning brief
  const wake = new Date(); wake.setDate(wake.getDate() + 1); wake.setHours(6, 0, 0, 0);
  const next = action === "done"
    ? { status: "done", doneAt: new Date().toISOString() }
    : action === "snooze"
      ? { status: "snoozed", snoozeUntil: wake.toISOString() }
      : { status: "open", snoozeUntil: null };

  // completing an action-item item also completes the underlying action
  const am = id.match(/^act-(.+)-(\d+)$/);
  if (am && action === "done") {
    const r = db.requests.find((x) => x.id === am[1]);
    if (r && r.actions[+am[2]]) r.actions[+am[2]].done = true;
  }

  const stored = db.items.find((x) => x.id === id && x.user === req.user.email);
  if (stored) Object.assign(stored, next);
  else db.itemStates[`${req.user.email}|${id}`] = next; // synthesized item
  saveDB(db);
  res.json({ ok: true, ...next });
});

/* POST /api/ingest?token=… — generic connector endpoint (Zapier, Apps
 * Script, cron jobs, future Slack/Gmail/Zendesk pollers all land here). */
app.post("/api/ingest", (req, res) => {
  const token = req.query.token || req.headers["x-ingest-token"];
  if (!process.env.INGEST_TOKEN || token !== process.env.INGEST_TOKEN) {
    return res.status(401).json({ error: "bad ingest token" });
  }
  const { user, src = "manual", from = "", text = "", link = null, due = null, meta = {} } = req.body || {};
  const db = loadDB();
  if (!db.users[user]) return res.status(400).json({ error: "unknown user" });
  if (!String(text).trim()) return res.status(400).json({ error: "text required" });
  const { cat, due: ruleDue, reasons } = classifyItem({ src, from, text, due, meta });
  const item = {
    id: crypto.randomUUID(), user, src,
    from: String(from).slice(0, 120), text: String(text).slice(0, 500), link,
    cat, due: due || ruleDue, reasons, status: "open", createdAt: new Date().toISOString(),
  };
  db.items.push(item);
  saveDB(db);
  res.json(item);
});

/* ── personal tasks ── */
app.get("/api/tasks", requireAuth, (req, res) => {
  const db = loadDB();
  res.json(db.tasks.filter((t) => t.user === req.user.email && !t.deleted));
});

app.post("/api/tasks", requireAuth, (req, res) => {
  const { text, est = 30 } = req.body || {};
  if (!String(text || "").trim()) return res.status(400).json({ error: "text required" });
  const db = loadDB();
  const task = {
    id: crypto.randomUUID(), user: req.user.email,
    text: String(text).slice(0, 200), est: Math.min(480, Math.max(15, +est || 30)),
    done: false, scheduled: null, createdAt: new Date().toISOString(),
  };
  db.tasks.push(task);
  saveDB(db);
  res.json(task);
});

app.post("/api/tasks/:id", requireAuth, (req, res) => {
  const db = loadDB();
  const t = db.tasks.find((x) => x.id === req.params.id && x.user === req.user.email);
  if (!t) return res.status(404).json({ error: "not found" });
  if (req.body.done !== undefined) t.done = !!req.body.done;
  if (req.body.deleted) t.deleted = true;
  saveDB(db);
  res.json(t);
});

/* schedule a task into a free gap → creates a REAL calendar event */
app.post("/api/tasks/:id/schedule", requireAuth, async (req, res) => {
  const { start, end } = req.body || {};
  if (!start || !end) return res.status(400).json({ error: "start and end required" });
  const db = loadDB();
  const t = db.tasks.find((x) => x.id === req.params.id && x.user === req.user.email);
  if (!t) return res.status(404).json({ error: "not found" });
  try {
    const cal = google.calendar({ version: "v3", auth: authedClientFor(db.users[req.user.email]) });
    const ev = await cal.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: `⏱ ${t.text}`,
        start: { dateTime: start }, end: { dateTime: end },
        description: "Scheduled via TimeSync",
      },
    });
    t.scheduled = { start, end, eventLink: ev.data.htmlLink || null };
  } catch (e) {
    console.warn("task scheduling failed:", e.message);
    t.scheduled = { start, end, eventLink: null }; // still tracked locally
  }
  saveDB(db);
  res.json(t);
});

/* ── agenda: YOUR OWN calendar events + TimeSync meetings + free gaps ──
 * Privacy note: full event titles are read only for the signed-in user's
 * own calendar; teammates remain FreeBusy-only. */
async function buildAgenda(user, dateStr, startISO, endISO) {
  const db = loadDB();
  const winS = Date.parse(startISO), winE = Date.parse(endISO);
  const events = [];

  try {
    const cal = google.calendar({ version: "v3", auth: authedClientFor(user) });
    const r = await cal.events.list({
      calendarId: "primary", timeMin: startISO, timeMax: endISO,
      singleEvents: true, orderBy: "startTime", maxResults: 50,
    });
    for (const ev of r.data.items || []) {
      if (ev.status === "cancelled") continue;
      if (!ev.start.dateTime) { // all-day
        events.push({ title: ev.summary || "(no title)", allDay: true, kind: "gcal" });
        continue;
      }
      events.push({
        title: ev.summary || "(no title)", kind: "gcal",
        start: ev.start.dateTime, end: ev.end.dateTime,
      });
    }
  } catch (e) {
    console.warn(`agenda events failed for ${user.email}:`, e.message);
  }

  for (const r of db.requests) {
    if (r.status === "declined") continue;
    if (r.requester !== user.email && !r.attendees.includes(user.email)) continue;
    const s = Date.parse(r.start);
    if (s < winS || s >= winE) continue;
    // skip if the confirmed Google event already covers it
    if (r.status === "confirmed" && events.some((e) => !e.allDay && e.title === r.title && Date.parse(e.start) === s)) continue;
    events.push({ title: r.title, kind: r.status, start: r.start, end: r.end, requestId: r.id });
  }
  events.sort((a, b) => (a.allDay ? -1 : b.allDay ? 1 : Date.parse(a.start) - Date.parse(b.start)));

  // free gaps inside the user's working hours (strict same-day band)
  const bandS = localHourToInstant(user.tz, dateStr, user.workStart);
  let bandE = localHourToInstant(user.tz, dateStr, user.workEnd);
  if (bandE <= bandS) bandE += 24 * 3.6e6;
  const lo = Math.max(bandS, winS), hi = Math.min(bandE, winE);
  const busy = events
    .filter((e) => !e.allDay)
    .map((e) => [Date.parse(e.start), Date.parse(e.end)])
    .sort((a, b) => a[0] - b[0]);
  const gaps = [];
  let cur = lo;
  for (const [s, e] of busy) {
    if (s > cur && s - cur >= 15 * 60000 && cur < hi) gaps.push({ start: new Date(cur).toISOString(), end: new Date(Math.min(s, hi)).toISOString() });
    cur = Math.max(cur, e);
  }
  if (hi - cur >= 15 * 60000) gaps.push({ start: new Date(cur).toISOString(), end: new Date(hi).toISOString() });

  return { events, gaps };
}

app.get("/api/agenda", requireAuth, async (req, res) => {
  const { date, start, end } = req.query;
  if (!date || !start || !end) return res.status(400).json({ error: "date, start, end required" });
  res.json(await buildAgenda(req.user, date, start, end));
});

/* ── morning brief: template always works; AI upgrades it if a key exists ── */
app.get("/api/brief", requireAuth, async (req, res) => {
  const { date, start, end } = req.query;
  if (!date || !start || !end) return res.status(400).json({ error: "date, start, end required" });
  const db = loadDB();
  const { events, gaps } = await buildAgenda(req.user, date, start, end);

  const stateOf = (id) => db.itemStates[`${req.user.email}|${id}`] || { status: "open" };
  const items = [
    ...synthesizeItems(db, req.user).map((x) => ({ ...x, ...stateOf(x.id) })),
    ...db.items.filter((x) => x.user === req.user.email),
  ].filter((x) => x.status === "open");

  const replies = items.filter((x) => x.cat === "reply");
  const finishes = items.filter((x) => x.cat === "finish");
  const dueToday = items.filter((x) => x.due && x.due <= date);
  const meetings = events.filter((e) => !e.allDay);
  const needsAccept = events.find((e) => e.kind === "pending");
  const bigGap = gaps.slice().sort((a, b) => (Date.parse(b.end) - Date.parse(b.start)) - (Date.parse(a.end) - Date.parse(a.start)))[0];
  const fmt = (iso) => new Intl.DateTimeFormat("en-US", { timeZone: req.user.tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

  let text =
    `You have ${meetings.length} calendar item${meetings.length === 1 ? "" : "s"} today` +
    (needsAccept ? ` — "${needsAccept.title}" at ${fmt(needsAccept.start)} still needs your Accept` : "") + `. ` +
    `${replies.length} message${replies.length === 1 ? "" : "s"} need a reply` +
    (replies[0] ? ` — first up: ${replies[0].from}` : "") + `. ` +
    `${finishes.length} thing${finishes.length === 1 ? "" : "s"} to finish` +
    (dueToday.length ? ` — DUE TODAY: ${dueToday.map((x) => x.text.slice(0, 40)).join("; ")}` : "") + `. ` +
    (bigGap ? `Your biggest free window is ${fmt(bigGap.start)}–${fmt(bigGap.end)}.` : "No free windows left today.");

  const ai = await aiComplete(
    `You are a concise personal work assistant. Rewrite this daily brief to be friendly and crisp (under 90 words, plain text, keep every fact, time and count):\n\n${text}`,
    300
  );
  if (ai) text = ai;
  res.json({ brief: text, counts: { meetings: meetings.length, replies: replies.length, finishes: finishes.length, dueToday: dueToday.length } });
});


/* ── Zoom integration: auto-capture meeting notes from cloud-recording
 * transcripts. Zoom calls this webhook when a recording finishes; we
 * download the transcript, summarize it with AI, and attach notes +
 * action items to the matching TimeSync meeting. ── */
app.post("/webhooks/zoom", async (req, res) => {
  const secret = process.env.ZOOM_WEBHOOK_SECRET || "";

  // Zoom's one-time endpoint validation handshake
  if (req.body?.event === "endpoint.url_validation") {
    const plainToken = req.body.payload.plainToken;
    const encryptedToken = crypto.createHmac("sha256", secret).update(plainToken).digest("hex");
    return res.json({ plainToken, encryptedToken });
  }

  res.sendStatus(200); // acknowledge immediately; process in background

  if (req.body?.event !== "recording.completed") return;
  try {
    const obj = req.body.payload.object;
    const tFile = (obj.recording_files || []).find((f) => f.file_type === "TRANSCRIPT");
    if (!tFile) return console.log("Zoom: no transcript file for", obj.topic);

    const vtt = await fetch(`${tFile.download_url}?access_token=${req.body.download_token}`).then((r) => r.text());
    const transcript = vtt
      .split("\n")
      .filter((l) => l.trim() && l !== "WEBVTT" && !/^\d+$/.test(l.trim()) && !l.includes("-->"))
      .join("\n")
      .slice(0, 30000);

    // match the recording to the nearest confirmed TimeSync meeting (±2h)
    const startMs = Date.parse(obj.start_time);
    const db = loadDB();
    const match = db.requests
      .filter((x) => x.status === "confirmed")
      .map((x) => ({ x, d: Math.abs(Date.parse(x.start) - startMs) }))
      .filter((m) => m.d < 2 * 3600e3)
      .sort((a, b) => a.d - b.d)[0];
    if (!match) return console.log("Zoom: no matching TimeSync meeting for", obj.topic);

    const ai = await aiComplete(
      `Summarize this meeting transcript into concise notes (under 200 words), then extract action items.\n` +
      `Respond ONLY with JSON, no markdown fences: {"notes":"...","actions":[{"text":"...","owner":"name or empty string"}]}\n\n` +
      `Meeting topic: ${obj.topic}\nTranscript:\n${transcript}`,
      900
    );

    let notes = `Auto-captured from Zoom recording: ${obj.topic}`;
    let actions = [];
    if (ai) {
      try {
        const j = JSON.parse(ai.replace(/```json|```/g, "").trim());
        notes = j.notes || notes;
        actions = (j.actions || []).map((a) => ({ text: String(a.text || ""), owner: String(a.owner || ""), done: false }));
      } catch {
        notes = ai.slice(0, 4000); // AI replied in prose; keep it as notes
      }
    }

    const db2 = loadDB();
    const target = db2.requests.find((x) => x.id === match.x.id);
    target.notes = (target.notes ? target.notes + "\n\n" : "") + notes;
    target.actions = [...(target.actions || []), ...actions.filter((a) => a.text.trim())];
    saveDB(db2);
    slackNotify(`📝 Zoom notes auto-captured for *${target.title}* — summary & action items are in TimeSync.`);
  } catch (e) {
    console.warn("Zoom webhook processing failed:", e.message);
  }
});

/* ── Scheduled Slack messages (need SLACK_WEBHOOK_URL) ── */
if (cron) {
  // Weekly availability digest — default: Mondays 09:00 server time
  cron.schedule(process.env.DIGEST_CRON || "0 9 * * 1", async () => {
    const db = loadDB();
    const users = Object.values(db.users);
    if (!users.length) return;
    const weekAhead = Date.now() + 7 * 864e5;
    const upcoming = db.requests.filter(
      (r) => r.status === "confirmed" && Date.parse(r.start) > Date.now() && Date.parse(r.start) < weekAhead
    );
    const lines = users.map((u) => `• ${u.name} — ${u.tz}, working ${u.workStart}:00–${u.workEnd}:00 local`);
    const base = `🌍 *Weekly TimeSync digest*\nTeam clocks this week:\n${lines.join("\n")}\n\nConfirmed meetings in the next 7 days: ${upcoming.length}\nFind overlap & schedule: ${BASE_URL}`;
    const ai = await aiComplete(`Rewrite this Slack message to be friendly and brief. Keep every fact and the URL. Plain text with the same bullet structure:\n\n${base}`, 400);
    slackNotify(ai || base);
  });

  // Daily open-action-item nudge — default: weekdays 09:00 server time
  cron.schedule(process.env.NUDGE_CRON || "0 9 * * 1-5", async () => {
    const db = loadDB();
    const open = db.requests.flatMap((r) =>
      (r.actions || []).filter((a) => !a.done).map((a) => `• ${a.text}${a.owner ? ` — *${a.owner}*` : ""} (from "${r.title}")`)
    );
    if (open.length) slackNotify(`⏰ *Open action items (${open.length}):*\n${open.slice(0, 15).join("\n")}`);
  });
}

app.listen(PORT, () => console.log(`TimeSync running at ${BASE_URL}`));
