/* Ocelli — deterministic triage rules engine (no AI required).
 *
 * classifyItem(item) sorts an incoming work item into one of three buckets:
 *   "fyi"    — information only, read & dismiss
 *   "reply"  — someone is waiting on a response from you
 *   "finish" — a task/ticket you must complete (often with a due date)
 *
 * Returns { cat, due, reasons } — `reasons` lists the matched rule names so
 * the UI can show WHY something was classified (transparency & debugging).
 * Safe failure mode: when nothing matches, items land in "reply" ("needs
 * your look") — you may glance at something unimportant, but you never
 * MISS something important.
 *
 * Run `node rules.js --test` for the self-test.
 */

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* Extract a due date from free text. Returns "YYYY-MM-DD" or null. */
function parseDue(text, now = new Date()) {
  const t = String(text).toLowerCase();

  if (/\b(today|tonight|eod|end of (the )?day|asap)\b/.test(t)) return isoDate(now);
  if (/\btomorrow\b/.test(t)) {
    const d = new Date(now); d.setDate(d.getDate() + 1); return isoDate(d);
  }
  // "by Friday", "before thu", "due Monday", "until Wednesday"
  let m = t.match(/\b(?:by|before|due|until|till|on)\s+(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/);
  if (m) {
    const d = new Date(now);
    d.setDate(d.getDate() + ((DAYS.indexOf(m[1]) - d.getDay() + 7) % 7)); // next occurrence (today counts)
    return isoDate(d);
  }
  // "June 20", "due Jun 5", "by sep 1"
  m = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b/);
  if (!m) m = (t.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/) || []).length
    ? [null, RegExp.$2, RegExp.$1] : null; // "20 June" form
  if (m) {
    const d = new Date(now.getFullYear(), MONTHS.indexOf(m[1]), +m[2]);
    if (d.getTime() < now.getTime() - 864e5) d.setFullYear(d.getFullYear() + 1); // past → next year
    return isoDate(d);
  }
  return null;
}

/* Pattern groups (lowercased text) */
const NOISE = [
  /\bno action (needed|required)\b/, /\bfyi\b/, /\bnewsletter\b/, /\bdigest\b/,
  /\bannouncement\b/, /\bunsubscribe\b/, /\bout of office\b/, /\bauto-?reply\b/,
];
const NOISE_SENDER = [/\bno-?reply\b/, /\bnotifications?@/, /\bnewsletter\b/, /\bmailer\b/];
const ASK = [
  /\?/, /\b(can|could|would|will)\s+you\b/, /\bplease\b/, /\bneed your\b/,
  /\bwaiting (for|on) you/, /\byour (thoughts|review|approval|input|feedback|opinion|sign-?off)\b/,
  /\blet me know\b/, /\bwdyt\b/, /\bget back to me\b/,
];
const DO_VERB = [
  /\b(fill|submit|complete|sign|upload|finish|prepare|send over|deliver)\b/,
  /\bassigned to you\b/, /\b(form|sheet|survey|okr|report|timesheet)\b/,
];

/* item: { src, from, text, due?, meta? }
 *   meta flags (set by connectors): assignedTicket, awaitingAccept,
 *   actionItem, dm, mention
 */
function classifyItem(item, now = new Date()) {
  const meta = item.meta || {};
  const from = String(item.from || "").toLowerCase();
  const text = String(item.text || "").toLowerCase();
  const both = from + " " + text;
  const reasons = [];
  const due = item.due || parseDue(both, now);

  // 1. hard source rules — these are unambiguous by construction
  if (meta.assignedTicket || item.src === "zendesk") {
    reasons.push("ticket-assigned");
    return { cat: "finish", due, reasons };
  }
  if (meta.awaitingAccept) {
    reasons.push("awaiting-accept");
    return { cat: "reply", due, reasons };
  }
  if (meta.actionItem) {
    reasons.push("action-item");
    return { cat: "finish", due, reasons };
  }

  // 2. noise → FYI (unless it was sent directly TO you)
  const direct = meta.dm || meta.mention;
  if (!direct && (NOISE.some((p) => p.test(text)) || NOISE_SENDER.some((p) => p.test(from)))) {
    reasons.push("noise-pattern");
    return { cat: "fyi", due: null, reasons };
  }

  // 3. concrete deliverable: do-verb + a deadline → finish
  if (DO_VERB.some((p) => p.test(both)) && due) {
    reasons.push("task-verb+deadline");
    return { cat: "finish", due, reasons };
  }

  // 4. someone is asking you something → reply
  if (ASK.some((p) => p.test(text))) {
    reasons.push("question/request");
    return { cat: "reply", due, reasons };
  }

  // 5. a DM or @mention with no other signal still deserves a response
  if (direct) {
    reasons.push(meta.dm ? "direct-message" : "mention");
    return { cat: "reply", due, reasons };
  }

  // 6. a deadline alone → something to finish
  if (due) {
    reasons.push("deadline-found");
    return { cat: "finish", due, reasons };
  }

  // 7. default: safe failure mode — surface it for a human look
  reasons.push("default-needs-look");
  return { cat: "reply", due: null, reasons };
}

module.exports = { classifyItem, parseDue };

/* ── self-test: node rules.js --test ── */
if (require.main === module && process.argv.includes("--test")) {
  const assert = require("assert");
  const now = new Date(2026, 5, 13); // Sat Jun 13 2026
  const c = (item) => classifyItem(item, now);

  // hard source rules
  assert.equal(c({ src: "zendesk", text: "Customer sync fails" }).cat, "finish");
  assert.equal(c({ src: "ocelli", text: "needs your Accept", meta: { awaitingAccept: true } }).cat, "reply");
  assert.equal(c({ src: "ocelli", text: "schedule usability test", meta: { actionItem: true } }).cat, "finish");
  // noise
  assert.equal(c({ src: "gmail", from: "no-reply@corp.com", text: "All-hands moved to Friday" }).cat, "fyi");
  assert.equal(c({ src: "gmail", from: "Comms", text: "Office closed Monday. No action needed." }).cat, "fyi");
  // do-verb + deadline
  const okr = c({ src: "sheets", from: "Q3 sheet", text: "Fill your OKR row by tomorrow" });
  assert.equal(okr.cat, "finish");
  assert.equal(okr.due, "2026-06-14");
  // ask
  const lisa = c({ src: "slack", from: "Lisa Park", text: "Can you review the Q3 budget doc before Thursday?", meta: { dm: true } });
  assert.equal(lisa.cat, "reply");
  assert.equal(lisa.due, "2026-06-18"); // next Thursday
  // dm without signals
  assert.equal(c({ src: "slack", from: "Mei", text: "new mockups are ready for your look", meta: { mention: true } }).cat, "reply");
  // deadline alone
  assert.equal(c({ src: "gmail", from: "HR", text: "Annual self-review form — submit by June 20." }).due, "2026-06-20");
  // default safe mode
  assert.equal(c({ src: "gmail", from: "Bob", text: "interesting article attached" }).cat, "reply");
  // parseDue variants
  assert.equal(parseDue("finish this by eod", now), "2026-06-13");
  assert.equal(parseDue("due monday", now), "2026-06-15");
  assert.equal(parseDue("nothing here", now), null);

  console.log("✅ all rules tests passed");
}
