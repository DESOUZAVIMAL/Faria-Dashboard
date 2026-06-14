import { useState } from "react";
import { Check } from "lucide-react";
import { TASKS } from "@/lib/data";
import { Panel } from "./Panel";

export function Tasks() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setDone((d) => ({ ...d, [id]: !d[id] }));

  return (
    <Panel title="My tasks" delay={0.1}>
      <div>
        {TASKS.map((t, i) => {
          const isDone = done[t.id];
          return (
            <div
              key={t.id}
              className={`flex items-center gap-[11px] text-[13.5px] ${
                i === 0 ? "" : "border-t border-border"
              } py-2.5`}
            >
              <button
                onClick={() => toggle(t.id)}
                className={`grid h-[17px] w-[17px] flex-shrink-0 place-items-center rounded-md border transition ${
                  isDone ? "border-free bg-free text-[#06281c]" : "border-muted-foreground"
                }`}
              >
                {isDone && <Check className="h-3 w-3" strokeWidth={3} />}
              </button>
              <span className={isDone ? "text-muted-foreground line-through" : ""}>{t.text}</span>
              <span className="ml-auto text-[11px] text-muted-foreground">{t.est}</span>
              <button className="cursor-pointer rounded-full border border-free/30 bg-free/[0.12] px-2.5 py-[3px] text-[10.5px] font-semibold text-free transition hover:bg-free hover:text-[#06281c] hover:shadow-[0_0_14px_rgba(52,211,153,0.5)]">
                {t.slot}
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-2.5 text-[12px] text-muted-foreground">
        Suggested slots come from today's free gaps on your calendar.
      </p>
    </Panel>
  );
}
