import { useState } from "react";
import { Check, Plus, CalendarPlus } from "lucide-react";
import { DateTime } from "luxon";
import { useMe, useDayWindow, useTasks, useAgenda, useAddTask, useUpdateTask, useScheduleTask } from "@/lib/queries";
import { fmtRange, hoursBetween } from "@/lib/datetime";
import { Panel } from "./Panel";
import type { Task } from "@/lib/api";

export function Tasks() {
  const { data: me } = useMe();
  const win = useDayWindow(me?.tz);
  const tz = me?.tz || "UTC";
  const { data: tasks = [], isLoading } = useTasks();
  const { data: agenda } = useAgenda(win);
  const addTask = useAddTask();
  const updateTask = useUpdateTask();
  const scheduleTask = useScheduleTask();
  const [text, setText] = useState("");

  const firstFittingGap = (estMin: number) =>
    (agenda?.gaps || []).find((g) => hoursBetween(g.start, g.end) * 60 >= estMin) || null;

  const onSchedule = (t: Task) => {
    const gap = firstFittingGap(t.est);
    if (!gap) return;
    const end = DateTime.fromISO(gap.start).plus({ minutes: t.est }).toISO()!;
    scheduleTask.mutate({ id: t.id, start: gap.start, end });
  };

  const submit = () => {
    const v = text.trim();
    if (!v) return;
    addTask.mutate(v);
    setText("");
  };

  return (
    <Panel title="My tasks" delay={0.1}>
      {isLoading && <p className="py-2 text-[13px] text-muted-foreground">Loading tasks…</p>}
      {tasks.map((t, i) => {
        const fits = !t.scheduled && firstFittingGap(t.est);
        return (
          <div key={t.id} className={`flex items-center gap-[11px] text-[13.5px] ${i === 0 ? "" : "border-t border-border"} py-2.5`}>
            <button
              onClick={() => updateTask.mutate({ id: t.id, done: !t.done })}
              className={`grid h-[17px] w-[17px] flex-shrink-0 place-items-center rounded-md border transition ${
                t.done ? "border-free bg-free text-[#06281c]" : "border-muted-foreground"
              }`}
            >
              {t.done && <Check className="h-3 w-3" strokeWidth={3} />}
            </button>
            <span className={t.done ? "text-muted-foreground line-through" : ""}>{t.text}</span>
            <span className="ml-auto text-[11px] text-muted-foreground">{t.est} m</span>
            {t.scheduled ? (
              <span className="rounded-full border border-free/30 bg-free/[0.12] px-2.5 py-[3px] text-[10.5px] font-semibold text-free">
                {fmtRange(t.scheduled.start, t.scheduled.end, tz)}
              </span>
            ) : fits ? (
              <button
                onClick={() => onSchedule(t)}
                disabled={scheduleTask.isPending}
                className="flex items-center gap-1 rounded-full border border-free/30 bg-free/[0.12] px-2.5 py-[3px] text-[10.5px] font-semibold text-free transition hover:bg-free hover:text-[#06281c]"
              >
                <CalendarPlus className="h-3 w-3" /> schedule
              </button>
            ) : (
              <span className="text-[10.5px] text-muted-foreground">no gap</span>
            )}
          </div>
        );
      })}

      <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Add a task…"
          className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <button onClick={submit} className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.06] text-muted-foreground transition hover:bg-white/10 hover:text-white">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-2 text-[11.5px] text-muted-foreground">Scheduling drops the task into a free gap and creates a real calendar event.</p>
    </Panel>
  );
}
