import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, Clock } from "lucide-react";
import { INBOX, CAT_LABEL, type Category, type Source, type InboxItem } from "@/lib/data";
import { Panel } from "./Panel";

const SRC_STYLE: Record<Source, string> = {
  slack: "bg-gradient-to-br from-[#7c3aed] to-[#611f69]",
  gmail: "bg-gradient-to-br from-[#f87171] to-[#ea4335]",
  zendesk: "bg-gradient-to-br from-[#0ea5a3] to-[#03363d]",
  sheets: "bg-gradient-to-br from-[#34d399] to-[#0f9d58]",
  timesync: "bg-gradient-to-br from-primary to-accent2",
};

const CHIP_STYLE: Record<Category, string> = {
  reply: "bg-reply/[0.14] text-reply border border-reply/30",
  finish: "bg-finish/[0.14] text-finish border border-finish/30",
  fyi: "bg-fyi/[0.14] text-fyi border border-fyi/30",
};

type Filter = "all" | Category | "done";

const TABS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "reply", label: "🟠 Needs reply" },
  { key: "finish", label: "🔴 To finish" },
  { key: "fyi", label: "🔵 FYI" },
  { key: "done", label: "✅ Done" },
];

function Item({ item, onDone }: { item: InboxItem; onDone: (id: string) => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.25 }}
      className="group flex gap-3.5 border-t border-border py-[15px] text-[13.5px] first:border-t-0"
    >
      <span
        className={`h-fit rounded-lg px-2.5 py-[5px] text-[10px] font-bold tracking-wide text-white ${SRC_STYLE[item.src]}`}
      >
        {item.src}
      </span>
      <div className="flex-1">
        <div className="font-bold">{item.from}</div>
        <div className="mt-[3px] text-muted-foreground">{item.text}</div>
        <div className="mt-[9px] flex items-center gap-[11px]">
          <span className={`rounded-full px-2.5 py-[3px] text-[10px] font-bold ${CHIP_STYLE[item.cat]}`}>
            {CAT_LABEL[item.cat]}
          </span>
          {item.due && <span className="text-[11px] font-semibold text-finish">{item.due}</span>}
          <span className="text-[11px] text-muted-foreground">{item.ago}</span>
          <span className="ml-auto flex gap-[7px]">
            <button
              onClick={() => onDone(item.id)}
              className="ts-glow-free flex items-center gap-1 rounded-[10px] border-transparent bg-gradient-to-r from-free to-[#22c79a] px-3 py-[7px] text-[11.5px] font-semibold text-[#06281c]"
            >
              <Check className="h-3 w-3" strokeWidth={3} /> {item.actionLabel}
            </button>
            {item.cat !== "fyi" && (
              <button className="flex items-center gap-1 rounded-[10px] border border-border bg-white/[0.04] px-3 py-[7px] text-[11.5px] font-semibold text-muted-foreground transition hover:bg-white/10 hover:text-white">
                <Clock className="h-3 w-3" /> Snooze
              </button>
            )}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export function Inbox() {
  const [filter, setFilter] = useState<Filter>("all");
  const [done, setDone] = useState<string[]>([]);

  const markDone = (id: string) => setDone((d) => [...d, id]);

  const counts = {
    all: INBOX.filter((i) => !done.includes(i.id)).length,
    reply: INBOX.filter((i) => i.cat === "reply" && !done.includes(i.id)).length,
    finish: INBOX.filter((i) => i.cat === "finish" && !done.includes(i.id)).length,
    fyi: INBOX.filter((i) => i.cat === "fyi" && !done.includes(i.id)).length,
    done: done.length,
  };

  const visible = INBOX.filter((i) => {
    if (filter === "done") return done.includes(i.id);
    if (done.includes(i.id)) return false;
    if (filter === "all") return true;
    return i.cat === filter;
  });

  return (
    <Panel title="Inbox — everything that needs you" count={counts.all} delay={0.08}>
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
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

      <AnimatePresence mode="popLayout">
        {visible.map((item) => (
          <Item key={item.id} item={item} onDone={markDone} />
        ))}
      </AnimatePresence>

      {visible.length === 0 && (
        <p className="py-8 text-center text-[13px] text-muted-foreground">Nothing here — you're all caught up. ✨</p>
      )}
    </Panel>
  );
}
