import {
  HEAT_DAYS,
  HEAT_HOURS,
  freeCount,
  BEST_SLOTS,
} from "@/lib/data";
import { Panel } from "./Panel";

const CELL_COLORS = ["#161d33", "#26345f", "#3a55a8", "#5b7df0", "#8ca8ff"];

export function WeekHeatmap() {
  return (
    <Panel title="Week view — when is the team free?" delay={0.12}>
      <p className="mb-3.5 text-[12px] text-muted-foreground">
        Brighter = more teammates free. Click a cell to open that day.
      </p>

      <div
        className="grid gap-[5px]"
        style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}
      >
        <div />
        {HEAT_DAYS.map((d) => (
          <div key={d} className="py-1 text-center text-[10.5px] font-bold text-foreground">
            {d}
          </div>
        ))}

        {HEAT_HOURS.map((h) => (
          <Row key={h} hour={h} />
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2 text-[11.5px] text-muted-foreground">
        <span>Fewer free</span>
        {CELL_COLORS.map((c, i) => (
          <span
            key={c}
            className="h-[13px] w-5 rounded"
            style={{
              background: c,
              boxShadow: i === CELL_COLORS.length - 1 ? "0 0 10px rgba(140,168,255,0.6)" : undefined,
            }}
          />
        ))}
        <span>More free</span>
      </div>

      <div className="mt-[18px] border-t border-border pt-4">
        <div className="mb-2 text-[12px] font-bold tracking-wide text-muted-foreground">
          BEST SLOTS THIS WEEK
        </div>
        {BEST_SLOTS.map((s) => (
          <div
            key={s.rank}
            className="-mx-[11px] flex items-center gap-[11px] rounded-xl px-[11px] py-[9px] text-[13px] transition hover:bg-white/[0.04]"
          >
            <span className="ts-glow-primary grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-primary to-accent2 text-[11px] font-bold text-white">
              {s.rank}
            </span>
            <span className="font-semibold">{s.when}</span>
            <span className="ml-auto text-[11.5px] text-muted-foreground">{s.who}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Row({ hour }: { hour: number }) {
  return (
    <>
      <div className="pr-[9px] text-right text-[10.5px] leading-7 tabular-nums text-muted-foreground">
        {hour}:00
      </div>
      {HEAT_DAYS.map((d, di) => {
        const free = freeCount(hour, di);
        return (
          <div
            key={d}
            title={`${d} ${hour}:00 — ${free} of 5 free`}
            className="h-7 cursor-pointer rounded-[7px] border border-white/[0.04] transition hover:scale-[1.18] hover:border-white/50"
            style={{
              background: CELL_COLORS[Math.max(0, free - 1)] ?? "#10152a",
              boxShadow: free >= 5 ? "0 0 10px rgba(140,168,255,0.5)" : undefined,
            }}
          />
        );
      })}
    </>
  );
}
