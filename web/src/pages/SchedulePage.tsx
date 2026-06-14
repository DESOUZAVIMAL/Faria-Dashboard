import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { DateTime } from "luxon";
import {
  PEOPLE,
  VIEWER_TZ,
  workingSpan,
  viewerSpan,
  nowViewerHour,
  clockFor,
  commonFreeSlots,
  fmtHour,
  type Person,
} from "@/lib/schedule";

const AXIS = [0, 3, 6, 9, 12, 15, 18, 21];
const pct = (h: number) => `${(h / 24) * 100}%`;

export function SchedulePage() {
  const [date, setDate] = useState(() => DateTime.now().setZone(VIEWER_TZ).toISODate()!);
  const [selected, setSelected] = useState<Set<string>>(new Set(PEOPLE.map((p) => p.id)));
  const [, force] = useState(0);

  // tick the "now" line + clocks every minute
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const shift = (n: number) =>
    setDate((d) => DateTime.fromISO(d, { zone: VIEWER_TZ }).plus({ days: n }).toISODate()!);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const now = nowViewerHour(date);
  const isToday = date === DateTime.now().setZone(VIEWER_TZ).toISODate();
  const selectedPeople = PEOPLE.filter((p) => selected.has(p.id));
  const free = commonFreeSlots(selectedPeople, date, 0.5);

  const label = isToday
    ? "Today"
    : DateTime.fromISO(date).toFormat("ccc, LLL d");

  return (
    <main className="mx-auto max-w-[1200px] px-6 pb-20 text-left">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-5"
      >
        <h1 className="font-heading text-2xl font-bold">Schedule</h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          Every row is on <b className="text-foreground">your clock</b> (Asia/Taipei). Darker = night
          for that person. Green strip below = everyone selected is free.
        </p>
      </motion.div>

      {/* controls */}
      <div className="mb-4 flex items-center gap-3">
        <div className="ts-glass flex items-center gap-1 rounded-full p-1">
          <button onClick={() => shift(-1)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[120px] text-center text-sm font-semibold">{label}</span>
          <button onClick={() => shift(1)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {!isToday && (
          <button
            onClick={() => setDate(DateTime.now().setZone(VIEWER_TZ).toISODate()!)}
            className="flex items-center gap-1.5 rounded-full border border-border bg-white/[0.04] px-3 py-2 text-[12.5px] font-semibold text-muted-foreground hover:bg-white/10 hover:text-white"
          >
            <Calendar className="h-3.5 w-3.5" /> Jump to today
          </button>
        )}
        <div className="ml-auto text-[12.5px] text-muted-foreground">
          {selectedPeople.length} of {PEOPLE.length} selected
        </div>
      </div>

      {/* gantt */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.05 }}
        className="ts-glass overflow-hidden rounded-[18px] p-5"
      >
        {/* hour axis */}
        <div className="relative ml-[220px] mb-2 h-5">
          {AXIS.map((h) => (
            <span
              key={h}
              className="absolute -translate-x-1/2 text-[11px] font-medium tabular-nums text-muted-foreground"
              style={{ left: pct(h) }}
            >
              {String(h).padStart(2, "0")}:00
            </span>
          ))}
        </div>

        {PEOPLE.map((p) => (
          <Row key={p.id} p={p} date={date} now={now} on={selected.has(p.id)} toggle={toggle} />
        ))}

        {/* free-slots strip */}
        <div className="mt-3 flex">
          <div className="w-[220px] pr-3 text-right text-[11.5px] font-semibold text-free">
            Everyone free
          </div>
          <div className="relative h-7 flex-1 rounded-lg bg-white/[0.03]">
            {free.length === 0 && (
              <span className="absolute inset-0 grid place-items-center text-[11px] text-muted-foreground">
                No slot where all {selectedPeople.length} are free on this day — try another day
              </span>
            )}
            {free.map((s, i) => (
              <button
                key={i}
                title={`${fmtHour(s.start)}–${fmtHour(s.end)} · everyone free`}
                className="ts-glow-free absolute top-0 h-7 rounded-lg bg-gradient-to-r from-free/80 to-[#22c79a]/80 transition hover:from-free hover:to-[#22c79a]"
                style={{ left: pct(s.start), width: pct(s.end - s.start) }}
              />
            ))}
          </div>
        </div>

        {/* legend */}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-3 text-[11.5px] text-muted-foreground">
          <Legend swatch="bg-primary/25" label="Working hours" />
          <Legend swatch="bg-finish" label="Busy" />
          <Legend swatch="bg-free" label="Everyone free" />
          <Legend swatch="bg-white/[0.03]" label="Night for them" />
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-[2px] bg-reply" /> Now
          </span>
        </div>
      </motion.div>
    </main>
  );
}

function Row({
  p, date, now, on, toggle,
}: { p: Person; date: string; now: number | null; on: boolean; toggle: (id: string) => void }) {
  const work = workingSpan(p, date);
  return (
    <div className={`flex items-center border-t border-border py-2.5 first:border-t-0 ${on ? "" : "opacity-40"}`}>
      {/* person label */}
      <button onClick={() => toggle(p.id)} className="flex w-[220px] items-center gap-2.5 pr-3 text-left">
        <span
          className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-[12px] font-bold ${
            on ? "bg-gradient-to-br from-primary to-accent2 text-white" : "bg-white/10 text-muted-foreground"
          }`}
        >
          {p.initials}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 truncate text-[13.5px] font-semibold">
            {p.name}
            {p.you && <span className="rounded bg-primary/20 px-1.5 py-px text-[9px] font-bold text-primary">you</span>}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {p.role} · {clockFor(p.tz)}
          </span>
        </span>
      </button>

      {/* track */}
      <div className="relative h-11 flex-1 overflow-hidden rounded-lg bg-white/[0.03]">
        {/* working band */}
        {work && (
          <div
            className="absolute top-0 h-11 bg-primary/[0.16]"
            style={{ left: pct(work.left), width: pct(work.width) }}
          />
        )}
        {/* busy blocks */}
        {p.busy.map((b, i) => {
          const span = viewerSpan(p.tz, date, b.start, b.end);
          if (!span) return null;
          return (
            <div
              key={i}
              title={`${b.label} (${fmtHour(span.left)}–${fmtHour(span.left + span.width)})`}
              className="absolute top-1.5 flex h-8 items-center overflow-hidden rounded-md bg-finish/90 px-1.5 text-[10px] font-semibold text-white"
              style={{ left: pct(span.left), width: pct(span.width) }}
            >
              <span className="truncate">{b.label}</span>
            </div>
          );
        })}
        {/* now line */}
        {now !== null && (
          <div className="absolute top-0 z-10 h-11 w-[2px] bg-reply shadow-[0_0_8px_var(--reply)]" style={{ left: pct(now) }} />
        )}
      </div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-3 w-4 rounded ${swatch}`} /> {label}
    </span>
  );
}
