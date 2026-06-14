import { AGENDA } from "@/lib/data";
import { Panel } from "./Panel";

const TAG_STYLE: Record<string, string> = {
  confirmed: "bg-free/15 text-free border border-free/30",
  pending: "bg-reply/15 text-reply border border-reply/30",
  cal: "bg-white/5 text-muted-foreground border border-border",
};

export function Agenda() {
  return (
    <Panel title="Today's agenda" delay={0.05}>
      <div>
        {AGENDA.map((e, i) => {
          const free = e.kind === "free";
          return (
            <div
              key={e.id}
              className={[
                "flex gap-3.5 text-[13.5px]",
                i === 0 ? "" : "border-t border-border",
                free
                  ? "my-[3px] items-stretch rounded-xl bg-gradient-to-r from-free/[0.12] to-transparent px-2.5 py-[11px]"
                  : "py-[11px]",
              ].join(" ")}
            >
              {free && (
                <span className="ts-glow-free mr-[-4px] block w-[3px] self-stretch rounded bg-free" />
              )}
              <div className="min-w-[96px] text-[12px] font-bold tabular-nums text-muted-foreground">
                {e.time}
              </div>
              <div className="flex-1">
                <div className={`font-semibold ${free ? "text-free" : ""}`}>{e.title}</div>
                {e.sub && <div className="mt-px text-[11.5px] text-muted-foreground">{e.sub}</div>}
              </div>
              {e.tag && (
                <span
                  className={`h-fit self-start whitespace-nowrap rounded-full px-2.5 py-[3px] text-[10px] font-bold ${TAG_STYLE[e.tag]}`}
                >
                  {e.tag}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
