/* TimeSync — shared types + mock data.
 *
 * This mock layer mirrors what the real API (server.js) returns, so swapping
 * to live data later means replacing these constants with TanStack Query
 * fetches against /api/* — the components don't change.
 */

export type Category = "reply" | "finish" | "fyi";
export type Source = "slack" | "gmail" | "zendesk" | "sheets" | "timesync";

export interface InboxItem {
  id: string;
  src: Source;
  from: string;
  text: string;
  cat: Category;
  due?: string; // human label e.g. "due Thu"
  ago: string;
  actionLabel: string; // primary button label
}

export interface AgendaEntry {
  id: string;
  time: string;
  title: string;
  sub?: string;
  kind: "event" | "free" | "meeting";
  tag?: "confirmed" | "pending" | "cal";
}

export interface Task {
  id: string;
  text: string;
  est: string;
  slot: string;
  done: boolean;
}

export interface Teammate {
  name: string;
  flag: string;
  clock: string;
}

export const TEAM: Teammate[] = [
  { name: "Mei", flag: "🇸🇬", clock: "19:32" },
  { name: "Arjun", flag: "🇮🇳", clock: "17:02" },
  { name: "Sarah", flag: "🇬🇧", clock: "12:32" },
  { name: "Lisa", flag: "🇺🇸", clock: "07:32" },
];

export const AGENDA: AgendaEntry[] = [
  { id: "a1", time: "09:30–10:30", title: "Standup", sub: "Google Calendar", kind: "event", tag: "cal" },
  { id: "a2", time: "10:30–13:00", title: "Free — 2.5 h open", sub: "good window for deep work", kind: "free" },
  { id: "a3", time: "13:00–13:30", title: "Weekly design sync", sub: "with Mei, Arjun", kind: "meeting", tag: "confirmed" },
  { id: "a4", time: "14:00–15:00", title: "Focus block", sub: "Google Calendar", kind: "event", tag: "cal" },
  { id: "a5", time: "15:00–16:00", title: "Free — 1 h open", kind: "free" },
  { id: "a6", time: "16:00–17:00", title: "Q3 roadmap", sub: "needs your Accept", kind: "meeting", tag: "pending" },
];

export const TASKS: Task[] = [
  { id: "t1", text: "Write usability test script", est: "1 h", slot: "▸ 10:30", done: false },
  { id: "t2", text: "Fill OKR row in Q3 sheet", est: "30 m", slot: "▸ 11:30", done: false },
  { id: "t3", text: "Prepare Q3 budget numbers", est: "1 h", slot: "▸ 15:00", done: false },
];

export const INBOX: InboxItem[] = [
  { id: "i1", src: "slack", from: "Lisa Park (DM)", text: "Can you review the Q3 budget doc before Thursday? I need your numbers for the exec deck.", cat: "reply", due: "due Thu", ago: "2 h ago", actionLabel: "Replied" },
  { id: "i2", src: "timesync", from: "Sarah Chen", text: "Q3 roadmap (16:00–17:00 today) is waiting for your Accept.", cat: "reply", due: "due today", ago: "3 h ago", actionLabel: "Accept" },
  { id: "i3", src: "zendesk", from: "Ticket #4521 · Acme Corp", text: "Customer calendar sync fails after password change — assigned to you.", cat: "finish", due: "due today", ago: "1 h ago", actionLabel: "Done" },
  { id: "i4", src: "sheets", from: "Q3 planning sheet", text: "Your OKR row is still empty — team deadline is tomorrow.", cat: "finish", due: "due tomorrow", ago: "1 d ago", actionLabel: "Done" },
  { id: "i5", src: "gmail", from: "HR · People Ops", text: "Annual self-review form — submit by June 20.", cat: "finish", due: "due Jun 20", ago: "4 h ago", actionLabel: "Done" },
  { id: "i6", src: "slack", from: "#design · Mei Lin", text: "@alex the new onboarding mockups are ready for your look.", cat: "reply", ago: "5 h ago", actionLabel: "Replied" },
  { id: "i7", src: "gmail", from: "Comms", text: "Office closed Monday for public holiday. No action needed.", cat: "fyi", ago: "6 h ago", actionLabel: "Got it" },
];

export const CAT_LABEL: Record<Category, string> = {
  reply: "Needs reply",
  finish: "To finish",
  fyi: "FYI",
};

/* Week heatmap: deterministic mock of how many of 5 teammates are free per hour. */
export const HEAT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const HEAT_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

export function freeCount(hour: number, dayIdx: number): number {
  let base = 5 - Math.abs(hour - 13) * 0.5;
  if (dayIdx > 4) base -= 3;
  if (hour < 9 || hour > 17) base -= 1.5;
  return Math.max(0, Math.min(5, Math.round(base + ((hour * 7 + dayIdx) % 3) - 1)));
}

export const BEST_SLOTS = [
  { rank: 1, when: "Wed 14:00–15:00", who: "all 5 free" },
  { rank: 2, when: "Tue 13:00–14:00", who: "4 of 5 free" },
  { rank: 3, when: "Thu 09:00–10:00", who: "4 of 5 free" },
];
