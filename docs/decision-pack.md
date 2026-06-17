# Ocelli & Faria Calendar — Decision & Research Pack

> **Internal document.** Consolidates the product vision, the build-approach options, AI
> integration choices, privacy/security findings, cost-at-scale analysis, and the calendar
> research — so it can be shared when pitching this model to managers / IT / AI governance.
> *Last updated: Jun 2026.*

---

## Contents
1. Executive summary
2. The products (what we're building & why)
3. Build approach — build vs. buy, compared
4. How data gets in — connector / transport research
5. AI integration — the "brain / body" model + privacy spectrum
6. Cost at scale — pooled API vs. per-seat agents
7. Calendar intelligence — noise reduction & meeting categorization
8. Privacy & security posture
9. Recommendations & phased rollout
10. Open questions for governance
11. Sources

---

## 1. Executive summary
- We have a working pilot of **Ocelli**, a privacy-first **work dashboard** that pulls items from our tools (Gmail, Slack, Zendesk, Calendar), sorts them (To finish / Needs reply / FYI) and tracks each until done — so nothing slips.
- A second, related idea is **Faria Calendar** — a smart **availability & scheduling** layer on top of Google Calendar for our remote, cross-timezone teams.
- Both are **designed to be low-risk and low-cost by default**: the core runs on **deterministic rules with no AI**, so **no company data leaves our control** and there is **no per-user AI cost**.
- **AI is an optional "brain"** we can switch on where it clearly helps (summaries, drafting, smarter sorting) — using a **private/enterprise** model, never a consumer/free tier.
- **Key cost finding:** for org-wide use (200–300 people), an **app + a single pooled API key** is **~20–40× cheaper** than giving everyone an individual AI "agent" seat.
- **What we need from governance:** approval on (a) programmatic access to company data via a self-built tool, and (b) which AI backend is sanctioned for company content.

---

## 2. The products

### The problem
We use 5–10 tools daily (Slack, Gmail, Zendesk, Sheets, Calendar). Things slip: a message we meant to answer, a ticket assigned to us, a deadline we didn't see. There is **no single place** that shows "what needs me," and **no easy way** to see team availability across time zones for our remote teams.

### Ocelli — unified work dashboard
- **Ingest** items from all tools → **triage** into 🔴 To finish / 🟠 Needs reply / 🔵 FYI → **track** until done (snooze returns next morning).
- Today view: morning brief, calendar agenda + free gaps, personal tasks (schedule into a free gap = real calendar event).
- Status today: **working pilot**, single user, runs locally, **no AI** (rules only), **read-only** Gmail.

### Faria Calendar — availability & scheduling (proposed)
- A **smart layer on top of Google Calendar** (not a replacement): cross-timezone availability dashboard, overlap finder, fragmented working hours, and **smart meeting categorization** (committed vs. optional, so optional/unconfirmed meetings don't falsely block availability).
- Needs **only calendar free/busy + your own event status** — **no Gmail** → lowest-sensitivity access.

---

## 3. Build approach — build vs. buy, compared
We seriously evaluated *not* building anything. Findings:

| Option | What it is | Why it does / doesn't fit |
|---|---|---|
| **Our own app (Ocelli / Faria Calendar)** | Self-built | ✅ Only option that does **all tools + persistent tracking + custom dashboard**; private; zero AI cost |
| **Gemini Gem (our org Gemini Pro)** | Saved assistant in Gemini | ❌ Google-only (no Slack/Zendesk); ❌ stateless (no tracking); ❌ no API to embed; ✅ enterprise-safe for Google data |
| **Google AI Studio app** | AI-built app, developer tier | ⚠️ Google connectors only; Slack needs custom code; ❌ free tier may train on data → not safe for company data |
| **NotebookLM** | Research over documents you upload | ❌ No live data, no tracking, no calendar — wrong category (great for knowledge/docs, not live triage/scheduling) |
| **OpenClaw** (autonomous agent) | Local AI agent that **acts** (sends mail, runs commands) | ⚠️ Opposite philosophy — autonomous + AI-driven + can act → much higher risk; hard to get approved; not a dashboard |

**Conclusion:** a small custom app is the only fit for "all our tools in one place + tracking + dashboard." Keeping it **rules-based / read-only / no-AI** is its biggest advantage for approval and cost.

**The recurring lesson:** Gems, AI Studio, NotebookLM, and OpenClaw are each powerful in their niche, but **none** provides *live multi-tool integration + persistent state + a custom dashboard*. That still requires an app.

---

## 4. How data gets in — connector / transport research

### Transport options
| Method | How it works | Public URL needed? | Real-time? | Best for |
|---|---|---|---|---|
| **API polling** | App asks "anything new?" on a timer | ❌ No | ~2–5 min lag | Personal / local pilot |
| **Webhooks / push** | Source pushes events to the app | ✅ Yes | Instant | Deployed/production |
| **WebSocket (Slack Socket Mode)** | App holds an outbound connection | ❌ **No** | Instant | Slack on localhost/firewall |
| **MCP** | Protocol for AI assistants to use tools | — | — | ❌ Not a data-connector mechanism |

### Per-source plan
| Source | Personal / pilot | Company scale |
|---|---|---|
| **Gmail** | API polling (read-only, `to:me`, skip promotions/no-reply) | Pub/Sub push + 7-day watch renewal |
| **Slack** | **Socket Mode** (real-time, no public URL) | Events API over HTTP |
| **Zendesk** | Poll tickets `assignee_id=me` | Same / webhook |
| **Calendar** | Calendar API (events + FreeBusy) | Same |

- Everything lands at one generic endpoint (`/api/ingest`) → the **rules engine classifies** → stored → shown. Connectors can be swapped from poll → push without changing the rules or the dashboard.
- ⚠️ Slack **Socket Mode** can't be published to the Slack Marketplace but **can** be deployed org-wide on Enterprise Grid — fine for internal use.

---

## 5. AI integration — the "brain / body" model

### The model
- **Body = our app** (gathers data, stores, tracks, shows the dashboard, does scheduling). We own it.
- **Brain = an LLM** (Gemini / Claude / GPT / open model) called **only for thinking**: sort ambiguous items, summarize threads, rank priority, draft replies, write the brief.
- The brain is **pluggable and optional** — the app already has this layer; with no key it runs on rules.
- **Critical safety distinction vs. autonomous agents (OpenClaw):** our brain **only reads & suggests — it never acts.** Nothing is sent or changed without a human. This keeps it private, predictable, and easy to approve.

### Privacy spectrum (most → least private)
| Setup | Where data goes | Privacy | Cost | Notes |
|---|---|---|---|---|
| **Rules only (AI off)** | Nowhere | 🟢 Maximum | $0 | Current pilot |
| **Self-host on your machine (Ollama)** | Never leaves your computer | 🟢 Maximum | $0 | Single-user only |
| **Self-host on company server (vLLM + open model)** | Stays in company network | 🟢 Maximum | GPU server | Multi-user; higher infra cost |
| **Enterprise API (Vertex / Bedrock / Azure OpenAI)** | Provider cloud, **not trained on**, DPA / zero-retention | 🟡 Governed | Pay-per-use | Easiest for company data at scale |
| **Consumer / free API (AI Studio free, ChatGPT free)** | May be used for training | 🔴 Avoid for company data | Free | Demo only |

- Open models for self-hosting: **Qwen 3** (Apache 2.0), **Llama 3.3**, **Mistral 3**. Tools: **Ollama** (easy), **vLLM** (production throughput).
- Ocelli's AI tasks are **light** (short text) → a small/mid model is plenty; no need for a frontier model.

### Techniques that cut exposure regardless of backend
1. **Rules-first** — only ambiguous items / on-demand summaries hit the AI; most never do.
2. **Data minimization / redaction** — send only subject+snippet, strip names/PII.
3. **Caching** — summarize a thread once, reuse.
4. **AI gateway** inside the perimeter (e.g., open-source Bifrost) — routing, redaction, audit logs.

---

## 6. Cost at scale — pooled API vs. per-seat agents

**The decisive finding for org-wide use (200–300 people):**

| | App + shared API key ⭐ | Per-user agent (Claude/Gem seats) |
|---|---|---|
| **Billing** | Pooled, per-token, **one bill** | **Per seat, per user** |
| **Employees need their own AI account?** | ❌ No | ✅ Yes, each |
| **~Cost for 300 users** | **~$200–400 / month** | **~$8,000–10,000 / month** |
| **Central control / budget cap** | ✅ | ❌ |
| **Embedded in our app** | ✅ | ❌ (chat tool) |

- With the app+API model, **employees need no AI account** — the app's single key serves everyone; the company pays one pooled, usage-based bill.
- **~20–40× cheaper** than licensing 300 individual agent seats.
- **AI Studio app** bills like the API model (pooled under one project) **but** is dev-tier → not for company data.
- **Keep the bill low:** rules-first + caching + cheap model for routine + a monthly token cap.

*(Token/seat prices vary — verify current pricing — but the order of magnitude and the pooled-vs-per-seat structure hold.)*

---

## 7. Calendar intelligence — noise reduction & meeting categorization

### The problem (observed in our real calendars)
A shared calendar is **noisy**: working-location banners ("Office/Home"), birthdays, optional clubs, declined events, and **broadcast meetings you never accepted** all clutter the view and **falsely block availability**.

### The fix — Google Calendar tags every event; we use those fields
| Field | Tells us | Action |
|---|---|---|
| `eventType = workingLocation` | "Office/Home" banners | **Hide** |
| `eventType = birthday / fromGmail` | auto-added | **Hide** |
| `eventType = outOfOffice` | away | show as **unavailable** |
| `transparency = transparent` | marked "free" (optional) | **doesn't block** |
| `transparency = opaque` | real busy | **blocks** |
| `responseStatus = declined` | you said no | **hide** (you're free) |
| `responseStatus = accepted` | committed | **blocks — important** |
| `responseStatus = needsAction / tentative` | unconfirmed (broadcasts) | **faded — does NOT block** |
| `attendees.optional` / huge attendee list | org-wide broadcast | tag **"general / optional"** |

### Graded availability (4 levels, color-coded)
| Level | Meaning | Bookable |
|---|---|---|
| 🟩 Free | no blocking event | ✅ best |
| 🟦 Likely free | only declined/optional/free-marked | ✅ ping to confirm |
| 🟧 Tentative | invited, not accepted | ⚠️ don't assume |
| 🟥 Busy | accepted meeting or out-of-office / outside hours | ❌ |

### Privacy note on calendars
- **Your own calendar:** full detail (titles, your response status) → full categorization.
- **Teammates' calendars:** by default only **free/busy** (Google privacy). *If* the Workspace admin shares "full event details" internally (which our org appears to), we can categorize colleagues' meetings too.

### Visualization (what makes it usable)
- **Week heatmap** (overview, "which day?") + **stacked day Gantts** (detail, compare days side by side) + ranked **best slots**. Group people via checkboxes (You / Manager / Team).
- References worth adapting: **Vimcal** (declutter + availability slots), **Clockwise** (protect/ surface real free time), **teamtimezone.com** (status + find-a-time).
- Research: remote teams want **2–4 hrs daily overlap**; more overlap correlates with faster delivery.

---

## 8. Privacy & security posture

### Current pilot (strengths)
- Runs **locally**, not internet-exposed.
- **No data leaves to any AI/third party** (rules only).
- **Read-only** Gmail; teammates **free/busy only**.
- **Secrets out of source control**; **httpOnly** session cookies; **company-domain** sign-in option.

### Hardening required before team rollout (honest)
| Gap | Fix |
|---|---|
| OAuth token stored unencrypted (pilot) | Encrypt at rest / secret manager |
| Flat-file storage | Managed DB with encryption |
| No HTTPS locally | TLS on deploy |
| No rate limiting / audit logs | Add before multi-user |
| Google app in "Testing" mode; Gmail = restricted scope | Verification + enterprise (Vertex) path |
| Free-tier hosting stores data externally | Host on company infra / store-nothing |

---

## 9. Recommendations & phased rollout
1. **Now — personal pilot:** Ocelli **rules-only** (no AI), read-only, local. Lowest risk. (Optionally: a personal **Gemini Gem** for AI triage of your own Gmail.)
2. **Validate AI privately:** wire the brain to a **local Ollama model** — AI thinking with **nothing leaving the machine**, free.
3. **Team pilot:** deploy on **company infrastructure**; connect Slack (Socket Mode) + Calendar; keep AI off or on **Vertex** (enterprise, pooled API key) with rules-first + caching.
4. **Faria Calendar:** build the **calendar/availability layer** (free/busy only — lowest sensitivity) for the team + managers; host on company infra.
5. **Scale:** only move to push connectors (Gmail Pub/Sub, Slack HTTP) and managed DB when usage demands it.

**Guiding principles:** rules first; AI optional & private; data minimization; least-privilege scopes; company-hosted; pooled API (never per-seat agents).

---

## 10. Open questions for governance
1. Is **programmatic access to company Gmail / Calendar / Slack / Zendesk** via a self-built tool permitted, and under what conditions?
2. Which **AI backend is sanctioned for company content** — Vertex / Gemini for Workspace, a self-hosted open model, or none for now? (Consumer / AI-Studio free tiers assumed off-limits — confirm.)
3. Requirements on **storage, encryption, retention, hosting** (must it stay in our Google Cloud)?
4. Is enabling the **Gmail API** on a Google Cloud project acceptable?
5. Different rules for a **single-user pilot** vs. **team rollout**? What's the approved path to scale?

---

## 11. Sources
- Slack Socket Mode vs HTTP — https://docs.slack.dev/apis/events-api/comparing-http-socket-mode/
- Gmail API push notifications (2026) — https://www.unipile.com/gmail-api-push-notifications/
- Google Calendar API — event types & status — https://developers.google.com/workspace/calendar/api/guides/calendar-status
- Google Calendar API — Events (eventType, transparency, responseStatus) — https://developers.google.com/workspace/calendar/api/v3/reference/events
- Team TimeZone — https://www.teamtimezone.com/
- Managing time-zone overlap for remote teams (2026) — https://trio.dev/navigating-time-zone-overlap/
- Vimcal — https://www.vimcal.com/
- Clockwise — https://max-productive.ai/ai-tools/clockwise/
- Running LLMs locally (2026) — https://daily.dev/blog/running-llms-locally-ollama-llama-cpp-self-hosted-ai-developers/
- Local LLMs: privacy, tools, hardware (2026) — https://www.sitepoint.com/definitive-guide-local-llms-2026-privacy-tools-hardware/
- Best open-source LLM hosting (2026) — https://www.edenai.co/post/best-open-source-llm-hosting-providers/
- NotebookLM (Workspace) — https://workspace.google.com/products/notebooklm/
- OpenClaw guide — https://milvus.io/blog/openclaw-formerly-clawdbot-moltbot-explained-a-complete-guide-to-the-autonomous-ai-agent.md
