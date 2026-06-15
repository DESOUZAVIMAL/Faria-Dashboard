import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
import { useMe, useDayWindow, useBrief, useItems, useAgenda } from "@/lib/queries";
import { hoursBetween } from "@/lib/datetime";

function Counter({ value, suffix = "", decimals = false }: { value: number; suffix?: string; decimals?: boolean }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const dur = 700, t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setV(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{decimals ? v.toFixed(1) : Math.round(v)}{suffix}</>;
}

export function Brief() {
  const { data: me } = useMe();
  const win = useDayWindow(me?.tz);
  const { data: brief, isLoading } = useBrief(win);
  const { data: items = [] } = useItems();
  const { data: agenda } = useAgenda(win);

  const open = items.filter((i) => i.status === "open");
  const replies = open.filter((i) => i.cat === "reply").length;
  const finishes = open.filter((i) => i.cat === "finish").length;
  const fyi = open.filter((i) => i.cat === "fyi").length;
  const freeHours = (agenda?.gaps || []).reduce((s, g) => s + hoursBetween(g.start, g.end), 0);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = (me?.name || "").split(" ")[0] || "there";

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
      className="ts-glass relative mb-6 overflow-hidden rounded-[18px] px-7 py-6"
    >
      <div className="pointer-events-none absolute -right-[10%] -top-[40%] h-[340px] w-[340px] rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.35),transparent_65%)] blur-lg" />

      <div className="relative mb-2.5 flex items-center gap-3">
        <h2 className="font-heading text-[21px] font-bold">{greeting}, {firstName} 👋</h2>
        <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider ${
          brief?.ai
            ? "ts-glow-free bg-gradient-to-r from-cyan to-[#7DE3C8] text-[#0a1020]"
            : "bg-primary/20 text-[#bcd0ff]"
        }`}>
          <Sparkles className="h-3 w-3" /> {brief?.ai ? "AI BRIEF" : "BRIEF"}
        </span>
      </div>

      <p className="relative max-w-[84ch] text-[14.5px] text-muted-foreground">
        {isLoading ? "Reading your day…" : brief?.brief || "No brief available."}
      </p>

      <div className="relative mt-[18px] flex flex-wrap gap-3.5">
        <Stat n={<Counter value={replies} />} label="Needs reply" cls="text-reply" />
        <Stat n={<Counter value={finishes} />} label="To finish" cls="text-finish" />
        <Stat n={<Counter value={fyi} />} label="FYI" cls="text-fyi" />
        <Stat n={<Counter value={freeHours} suffix=" h" decimals />} label="Free today" cls="text-free" />
      </div>
    </motion.div>
  );
}

function Stat({ n, label, cls }: { n: React.ReactNode; label: string; cls: string }) {
  return (
    <div className="min-w-[120px] flex-1 rounded-[14px] border border-border bg-white/[0.04] px-4 py-3.5">
      <span className={`font-heading text-[26px] font-bold ${cls}`}>{n}</span>
      <div className="mt-0.5 text-[11.5px] text-muted-foreground">{label}</div>
    </div>
  );
}
