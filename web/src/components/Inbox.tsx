import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, Clock, RotateCcw, Plus } from "lucide-react";
import { useMe, useItems, useItemStatus, useAddItem } from "@/lib/queries";
import { ago, dueLabel } from "@/lib/datetime";
import { Panel } from "./Panel";
import type { Item, Category } from "@/lib/api";

const SRC_STYLE: Record<string, string> = {
  slack: "bg-gradient-to-br from-[#7c3aed] to-[#611f69]",
  gmail: "bg-gradient-to-br from-[#f87171] to-[#ea4335]",
  zendesk: "bg-gradient-to-br from-[#0ea5a3] to-[#03363d]",
  sheets: "bg-gradient-to-br from-[#34d399] to-[#0f9d58]",
  ocelli: "bg-gradient-to-br from-primary to-accent2",
  manual: "bg-white/15",
};
const CAT_LABEL: Record<Category, string> = { reply: "Needs reply", finish: "To finish", fyi: "FYI" };
const CHIP_STYLE: Record<Category, string> = {
  reply: "bg-reply/[0.14] text-reply border border-reply/30",
  finish: "bg-finish/[0.14] text-finish border border-finish/30",
  fyi: "bg-fyi/[0.14] text-fyi border border-fyi/30",
};

type Filter = "all" | Category | "done";

export function Inbox() {
  const { data: me } = useMe();
  const tz = me?.tz || "UTC";
  const { data: items = [], isLoading } = useItems();
  const setStatus = useItemStatus();
  const addItem = useAddItem();
  const [filter, setFilter] = useState<Filter>("all");
  const [text, setText] = useState("");

  const active = items.filter((i) => i.status !== "done");
  const counts = {
    all: active.length,
    reply: active.filter((i) => i.cat === "reply").length,
    finish: active.filter((i) => i.cat === "finish").length,
    fyi: active.filter((i) => i.cat === "fyi").length,
    done: items.filter((i) => i.status === "done").length,
  };
  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "reply", label: "🟠 Needs reply" },
    { key: "finish", label: "🔴 To finish" },
    { key: "fyi", label: "🔵 FYI" },
    { key: "done", label: "✅ Done" },
  ];

  const visible = items.filter((i) => {
    if (filter === "done") return i.status === "done";
    if (i.status === "done") return false;
    if (filter === "all") return true;
    return i.cat === filter;
  });

  const submit = () => {
    const v = text.trim();
    if (!v) return;
    addItem.mutate(v);
    setText("");
  };

  return (
    <Panel title="Inbox — everything that needs you" count={counts.all} delay={0.08}>
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={[
              "rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition",
              filter === t.key
                ? "ts-glow-primary border-transparent bg-gradient-to-r from-primary to-accent2 text-white"
                : "border border-border bg-white/[0.03] text-muted-foreground hover:-translate-y-px hover:bg-white/[0.07]",
            ].join(" ")}
          >
            {t.label} {counts[t.key]}
          </button>
        ))}
      </div>

      <div className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-white/[0.03] px-3 py-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Add an item — it gets auto-sorted…"
          className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <button onClick={submit} className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.06] text-muted-foreground transition hover:bg-white/10 hover:text-white">
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {isLoading && <p className="py-4 text-[13px] text-muted-foreground">Loading your inbox…</p>}

      <AnimatePresence mode="popLayout">
        {visible.map((item) => (
          <ItemRow key={item.id} item={item} tz={tz} onStatus={(action) => setStatus.mutate({ id: item.id, action })} />
        ))}
      </AnimatePresence>

      {!isLoading && visible.length === 0 && (
        <p className="py-8 text-center text-[13px] text-muted-foreground">Nothing here — you're all caught up. ✨</p>
      )}
    </Panel>
  );
}

function ItemRow({ item, tz, onStatus }: { item: Item; tz: string; onStatus: (a: "done" | "snooze" | "reopen") => void }) {
  const due = dueLabel(item.due, tz);
  const isDone = item.status === "done";
  const isSnoozed = item.status === "snoozed";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.25 }}
      className="flex gap-3.5 border-t border-border py-[15px] text-[13.5px] first:border-t-0"
    >
      <span className={`h-fit rounded-lg px-2.5 py-[5px] text-[10px] font-bold tracking-wide text-white ${SRC_STYLE[item.src] || SRC_STYLE.manual}`}>
        {item.src}
      </span>
      <div className="flex-1">
        <div className="font-bold">{item.from || "(no sender)"}</div>
        <div className="mt-[3px] text-muted-foreground">{item.text}</div>
        <div className="mt-[9px] flex flex-wrap items-center gap-[11px]">
          <span className={`rounded-full px-2.5 py-[3px] text-[10px] font-bold ${CHIP_STYLE[item.cat]}`}>{CAT_LABEL[item.cat]}</span>
          {due && <span className="text-[11px] font-semibold text-finish">{due}</span>}
          {isSnoozed && <span className="text-[11px] font-semibold text-reply">snoozed</span>}
          <span className="text-[11px] text-muted-foreground">{ago(item.createdAt)}</span>
          {item.reasons?.[0] && <span className="text-[10.5px] text-muted-foreground">· why: {item.reasons.join(", ")}</span>}
          <span className="ml-auto flex gap-[7px]">
            {isDone ? (
              <button onClick={() => onStatus("reopen")} className="flex items-center gap-1 rounded-[10px] border border-border bg-white/[0.04] px-3 py-[7px] text-[11.5px] font-semibold text-muted-foreground transition hover:bg-white/10 hover:text-white">
                <RotateCcw className="h-3 w-3" /> Reopen
              </button>
            ) : (
              <>
                <button onClick={() => onStatus("done")} className="ts-glow-free flex items-center gap-1 rounded-[10px] border-transparent bg-gradient-to-r from-free to-[#22c79a] px-3 py-[7px] text-[11.5px] font-semibold text-[#06281c]">
                  <Check className="h-3 w-3" strokeWidth={3} /> Done
                </button>
                {!isSnoozed && (
                  <button onClick={() => onStatus("snooze")} className="flex items-center gap-1 rounded-[10px] border border-border bg-white/[0.04] px-3 py-[7px] text-[11.5px] font-semibold text-muted-foreground transition hover:bg-white/10 hover:text-white">
                    <Clock className="h-3 w-3" /> Snooze
                  </button>
                )}
              </>
            )}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
