/* Day-window + formatting helpers (Luxon), all in the viewer's timezone. */
import { DateTime } from "luxon";
import type { DayQuery } from "./api";

/** The {date,start,end} window the agenda/brief endpoints expect, for a given day. */
export function dayWindow(tz: string, isoDate?: string): DayQuery {
  const base = isoDate
    ? DateTime.fromISO(isoDate, { zone: tz })
    : DateTime.now().setZone(tz);
  const start = base.startOf("day");
  const end = start.plus({ days: 1 });
  return { date: start.toISODate()!, start: start.toISO()!, end: end.toISO()! };
}

/** "HH:mm" for an ISO instant, in the viewer tz. */
export function fmtTime(iso: string, tz: string): string {
  return DateTime.fromISO(iso).setZone(tz).toFormat("HH:mm");
}

/** "HH:mm–HH:mm" range for two ISO instants, in the viewer tz. */
export function fmtRange(startISO: string, endISO: string, tz: string): string {
  return `${fmtTime(startISO, tz)}–${fmtTime(endISO, tz)}`;
}

/** Hours between two ISO instants (for free-gap totals). */
export function hoursBetween(startISO: string, endISO: string): number {
  return (Date.parse(endISO) - Date.parse(startISO)) / 3.6e6;
}

/** Friendly relative label for a createdAt timestamp ("2 h ago"). */
export function ago(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - Date.parse(iso);
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

/** Turn a due date ("YYYY-MM-DD") into a short label relative to today. */
export function dueLabel(due: string | null, tz: string): string | null {
  if (!due) return null;
  const today = DateTime.now().setZone(tz).startOf("day");
  const d = DateTime.fromISO(due, { zone: tz }).startOf("day");
  const days = Math.round(d.diff(today, "days").days);
  if (days < 0) return "overdue";
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  return "due " + d.toFormat("LLL d");
}
