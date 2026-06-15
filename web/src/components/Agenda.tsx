import { useMe, useDayWindow, useAgenda } from "@/lib/queries";
import { fmtRange, hoursBetween } from "@/lib/datetime";
import { Panel } from "./Panel";
import type { AgendaEvent, Gap } from "@/lib/api";

const TAG_STYLE: Record<string, string> = {
  confirmed: "bg-free/15 text-free border border-free/30",
  pending: "bg-reply/15 text-reply border border-reply/30",
  gcal: "bg-white/5 text-muted-foreground border border-border",
};

type Row =
  | { type: "event"; start: number; ev: AgendaEvent }
  | { type: "gap"; start: number; gap: Gap }
  | { type: "allday"; ev: AgendaEvent };

export function Agenda() {
  const { data: me } = useMe();
  const win = useDayWindow(me?.tz);
  const { data: agenda, isLoading } = useAgenda(win);
  const tz = me?.tz || "UTC";

  const rows: Row[] = [];
  for (const ev of agenda?.events || []) {
    if (ev.allDay) rows.push({ type: "allday", ev });
    else if (ev.start) rows.push({ type: "event", start: Date.parse(ev.start), ev });
  }
  for (const gap of agenda?.gaps || []) rows.push({ type: "gap", start: Date.parse(gap.start), gap });
  rows.sort((a, b) => {
    if (a.type === "allday") return -1;
    if (b.type === "allday") return 1;
    return a.start - b.start;
  });

  return (
    <Panel title="Today's agenda" delay={0.05}>
      {isLoading && <p className="py-4 text-[13px] text-muted-foreground">Loading your calendar…</p>}
      {!isLoading && rows.length === 0 && (
        <p className="py-4 text-[13px] text-muted-foreground">Nothing on your calendar today — a clear day. ✨</p>
      )}
      {rows.map((r, i) => {
        if (r.type === "allday") {
          return (
            <div key={"ad" + i} className={`flex gap-3.5 py-[11px] text-[13.5px] ${i === 0 ? "" : "border-t border-border"}`}>
              <div className="min-w-[96px] text-[12px] font-bold text-muted-foreground">all day</div>
              <div className="flex-1 font-semibold">{r.ev.title}</div>
            </div>
          );
        }
        if (r.type === "gap") {
          const h = hoursBetween(r.gap.start, r.gap.end);
          return (
            <div key={"g" + i} className="my-[3px] flex items-stretch gap-3.5 rounded-xl bg-gradient-to-r from-free/[0.12] to-transparent px-2.5 py-[11px] text-[13.5px]">
              <span className="ts-glow-free mr-[-4px] block w-[3px] self-stretch rounded bg-free" />
              <div className="min-w-[96px] text-[12px] font-bold tabular-nums text-muted-foreground">{fmtRange(r.gap.start, r.gap.end, tz)}</div>
              <div className="flex-1 font-semibold text-free">Free — {h >= 1 ? `${h.toFixed(h % 1 ? 1 : 0)} h` : `${Math.round(h * 60)} m`} open</div>
            </div>
          );
        }
        const ev = r.ev;
        return (
          <div key={"e" + i} className={`flex gap-3.5 py-[11px] text-[13.5px] ${i === 0 ? "" : "border-t border-border"}`}>
            <div className="min-w-[96px] text-[12px] font-bold tabular-nums text-muted-foreground">{ev.start && ev.end ? fmtRange(ev.start, ev.end, tz) : ""}</div>
            <div className="flex-1">
              <div className="font-semibold">{ev.title}</div>
              {ev.kind === "pending" && <div className="mt-px text-[11.5px] text-muted-foreground">needs your Accept</div>}
            </div>
            <span className={`h-fit self-start whitespace-nowrap rounded-full px-2.5 py-[3px] text-[10px] font-bold ${TAG_STYLE[ev.kind] || TAG_STYLE.gcal}`}>
              {ev.kind === "gcal" ? "cal" : ev.kind}
            </span>
          </div>
        );
      })}
    </Panel>
  );
}
