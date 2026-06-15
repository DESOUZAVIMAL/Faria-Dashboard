/* Ocelli — typed API client for the Express backend (server.js).
 *
 * In dev, Vite proxies /api and /auth to http://localhost:3000, so these
 * relative URLs "just work" and the session cookie is sent automatically.
 */

export class AuthError extends Error {
  constructor() {
    super("not signed in");
    this.name = "AuthError";
  }
}

async function http<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...opts,
  });
  if (res.status === 401) throw new AuthError();
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error((msg as { error?: string }).error || res.statusText);
  }
  return res.json() as Promise<T>;
}

function qs(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

/* ── types (match server.js responses) ── */
export interface Me {
  email: string; name: string; picture: string;
  tz: string; workStart: number; workEnd: number; role: string;
}
export type Category = "reply" | "finish" | "fyi";
export type ItemStatus = "open" | "snoozed" | "done";
export interface Item {
  id: string; src: string; from: string; text: string;
  cat: Category; due: string | null; reasons: string[];
  status: ItemStatus; createdAt?: string; link?: string | null;
  snoozeUntil?: string | null; doneAt?: string;
}
export interface AgendaEvent {
  title: string; kind: "gcal" | "pending" | "confirmed";
  start?: string; end?: string; allDay?: boolean; requestId?: string;
}
export interface Gap { start: string; end: string }
export interface Agenda { events: AgendaEvent[]; gaps: Gap[] }
export interface Brief {
  brief: string; ai: boolean;
  counts: { meetings: number; replies: number; finishes: number; dueToday: number };
}
export interface Task {
  id: string; text: string; est: number; done: boolean;
  scheduled: null | { start: string; end: string; eventLink: string | null };
  createdAt: string;
}
export interface Teammate {
  email: string; name: string; picture: string; role: string;
  tz: string; workStart: number; workEnd: number; connected: boolean;
}
export interface Availability extends Teammate {
  busy: { start: string; end: string }[];
  error?: boolean;
}

export interface DayQuery { date: string; start: string; end: string }

export const api = {
  me: () => http<Me>("/api/me"),

  items: () => http<Item[]>("/api/items"),
  addItem: (body: { from?: string; text: string; src?: string; link?: string }) =>
    http<Item>("/api/items", { method: "POST", body: JSON.stringify(body) }),
  itemStatus: (id: string, action: "done" | "snooze" | "reopen") =>
    http<{ ok: boolean; status: ItemStatus }>(`/api/items/${id}/status`, {
      method: "POST", body: JSON.stringify({ action }),
    }),

  tasks: () => http<Task[]>("/api/tasks"),
  addTask: (text: string, est = 30) =>
    http<Task>("/api/tasks", { method: "POST", body: JSON.stringify({ text, est }) }),
  updateTask: (id: string, body: { done?: boolean; deleted?: boolean }) =>
    http<Task>(`/api/tasks/${id}`, { method: "POST", body: JSON.stringify(body) }),
  scheduleTask: (id: string, start: string, end: string) =>
    http<Task>(`/api/tasks/${id}/schedule`, { method: "POST", body: JSON.stringify({ start, end }) }),

  agenda: (q: DayQuery) => http<Agenda>("/api/agenda?" + qs({ date: q.date, start: q.start, end: q.end })),
  brief: (q: DayQuery) => http<Brief>("/api/brief?" + qs({ date: q.date, start: q.start, end: q.end })),

  gmailSync: () => http<{ added?: number; scanned?: number; reconnect?: boolean }>(
    "/api/gmail/sync", { method: "POST" }),

  team: () => http<Teammate[]>("/api/team"),
  availability: (start: string, end: string) =>
    http<Availability[]>("/api/availability?" + qs({ start, end })),
};
