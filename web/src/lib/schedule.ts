/* TimeSync — scheduling (timezone Gantt) data + helpers.
 *
 * Every row is rendered on the VIEWER's clock. We use Luxon to convert each
 * person's local working hours / busy blocks into the viewer timezone, then
 * position them on a 0–24h axis as percentages.
 *
 * Strict one-band rule: a person's working band is only shown if its START
 * falls within the viewed day (in viewer time). This prevents the previous
 * day's band bleeding onto the wrong side of the chart (the US-timezone bug).
 */
import { DateTime } from "luxon";

export const VIEWER_TZ = "Asia/Taipei";

export interface BusyBlock {
  start: number; // local hour, e.g. 9.5 = 09:30
  end: number;
  label: string;
}

export interface Person {
  id: string;
  name: string;
  initials: string;
  role: string;
  tz: string;
  workStart: number; // local hour
  workEnd: number;
  busy: BusyBlock[];
  you?: boolean;
}

export const PEOPLE: Person[] = [
  { id: "p1", name: "Alex Chen", initials: "AC", role: "Product", tz: "Asia/Taipei", workStart: 9, workEnd: 18, you: true,
    busy: [{ start: 9.5, end: 10.5, label: "Standup" }, { start: 14, end: 15, label: "Focus block" }] },
  { id: "p2", name: "Mei Lin", initials: "ML", role: "Design", tz: "Asia/Singapore", workStart: 9, workEnd: 18,
    busy: [{ start: 10, end: 11.5, label: "Customer call" }, { start: 17.25, end: 17.75, label: "Coffee chat" }] },
  { id: "p3", name: "Arjun Rao", initials: "AR", role: "Engineering", tz: "Asia/Kolkata", workStart: 10, workEnd: 19,
    busy: [{ start: 12.5, end: 13.25, label: "Lunch" }, { start: 16, end: 17, label: "Code review" }] },
  { id: "p4", name: "Sarah Chen", initials: "SC", role: "Marketing", tz: "Europe/London", workStart: 8, workEnd: 16,
    busy: [{ start: 8, end: 8.75, label: "Inbox" }, { start: 14, end: 15, label: "1:1 with manager" }] },
  { id: "p5", name: "Lisa Park", initials: "LP", role: "Manager (US)", tz: "America/New_York", workStart: 9, workEnd: 17,
    busy: [{ start: 9, end: 9.75, label: "Exec sync" }, { start: 13, end: 14, label: "Hiring panel" }] },
];

/** Convert a person's local hour on `dateISO` into viewer-hours from the viewed midnight. */
export function toViewerHour(personTz: string, dateISO: string, localHour: number): number {
  const h = Math.floor(localHour);
  const m = Math.round((localHour - h) * 60);
  const local = DateTime.fromISO(dateISO, { zone: personTz }).set({ hour: h, minute: m });
  const viewer = local.setZone(VIEWER_TZ);
  const viewedMidnight = DateTime.fromISO(dateISO, { zone: VIEWER_TZ }).startOf("day");
  return viewer.diff(viewedMidnight, "hours").hours;
}

export interface Span { left: number; width: number; clippedStart: boolean; clippedEnd: boolean }

/** Map a [startHour,endHour] span (in person's local tz) to a viewer-axis span, clipped to 0–24. */
export function viewerSpan(personTz: string, dateISO: string, startLocal: number, endLocal: number): Span | null {
  const s = toViewerHour(personTz, dateISO, startLocal);
  const e = toViewerHour(personTz, dateISO, endLocal);
  if (e <= 0 || s >= 24) return null; // entirely off this day
  const cs = s < 0, ce = e > 24;
  const left = Math.max(0, s);
  const width = Math.min(24, e) - left;
  return { left, width, clippedStart: cs, clippedEnd: ce };
}

/** Working band, honoring the strict one-band rule (start must fall on the viewed day). */
export function workingSpan(p: Person, dateISO: string): Span | null {
  const s = toViewerHour(p.tz, dateISO, p.workStart);
  if (s < 0 || s >= 24) return null; // start not on viewed day → don't render
  const e = toViewerHour(p.tz, dateISO, p.workEnd);
  return { left: s, width: Math.min(24, e) - s, clippedStart: false, clippedEnd: e > 24 };
}

/** Current time as viewer-hours (for the "now" line), or null if not today. */
export function nowViewerHour(dateISO: string): number | null {
  const now = DateTime.now().setZone(VIEWER_TZ);
  if (now.toISODate() !== dateISO) return null;
  return now.hour + now.minute / 60;
}

/** Live clock label for a person. */
export function clockFor(personTz: string): string {
  return DateTime.now().setZone(personTz).toFormat("HH:mm");
}

/**
 * Free slots where ALL selected people are within working hours and not busy.
 * Scans the viewer day in 30-min steps; returns merged [start,end] viewer-hour ranges
 * at least `minHours` long.
 */
export function commonFreeSlots(people: Person[], dateISO: string, minHours = 0.5): Array<{ start: number; end: number }> {
  const step = 0.5;
  const isFree = (p: Person, vh: number) => {
    const w = workingSpan(p, dateISO);
    if (!w || vh < w.left || vh >= w.left + w.width) return false;
    for (const b of p.busy) {
      const bs = viewerSpan(p.tz, dateISO, b.start, b.end);
      if (bs && vh >= bs.left && vh < bs.left + bs.width) return false;
    }
    return true;
  };
  const slots: Array<{ start: number; end: number }> = [];
  let run: number | null = null;
  for (let vh = 0; vh <= 24; vh += step) {
    const allFree = vh < 24 && people.every((p) => isFree(p, vh));
    if (allFree && run === null) run = vh;
    if (!allFree && run !== null) {
      if (vh - run >= minHours) slots.push({ start: run, end: vh });
      run = null;
    }
  }
  return slots;
}

export function fmtHour(vh: number): string {
  const h = Math.floor(vh) % 24;
  const m = Math.round((vh - Math.floor(vh)) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
