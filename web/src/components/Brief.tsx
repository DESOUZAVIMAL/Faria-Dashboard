import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Sparkles } from "lucide-react";

interface Stat {
  to: number;
  label: string;
  className: string;
  suffix?: string;
  decimals?: boolean;
}

const STATS: Stat[] = [
  { to: 3, label: "Needs reply", className: "text-reply" },
  { to: 4, label: "To finish", className: "text-finish" },
  { to: 2, label: "FYI", className: "text-fyi" },
  { to: 3.5, label: "Free today", className: "text-free", suffix: " h", decimals: true },
];

function Counter({ stat }: { stat: Stat }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const dur = 900;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const v = stat.to * (1 - Math.pow(1 - p, 3));
      setVal(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [stat.to]);

  return (
    <span className={`font-heading text-[26px] font-bold ${stat.className}`}>
      {stat.decimals ? val.toFixed(1) : Math.round(val)}
      {stat.suffix ?? ""}
    </span>
  );
}

export function Brief() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
      className="ts-glass relative mb-6 overflow-hidden rounded-[18px] px-7 py-6"
    >
      <div className="pointer-events-none absolute -right-[10%] -top-[40%] h-[340px] w-[340px] rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.35),transparent_65%)] blur-lg" />

      <div className="relative mb-2.5 flex items-center gap-3">
        <h2 className="font-heading text-[21px] font-bold">Good evening, Alex 👋</h2>
        <span className="ts-glow-free flex items-center gap-1 rounded-full bg-gradient-to-r from-cyan to-[#7DE3C8] px-2.5 py-1 text-[10px] font-bold tracking-wider text-[#0a1020]">
          <Sparkles className="h-3 w-3" /> AI BRIEF
        </span>
      </div>

      <p className="relative max-w-[82ch] text-[14.5px] text-muted-foreground">
        You have <b className="text-white">3 replies waiting</b> and{" "}
        <b className="text-white">4 things to finish</b> (2 due today). Your next meeting is{" "}
        <b className="text-white">Weekly design sync at 13:00</b>. I'd use the{" "}
        <b className="text-white">2.5-hour free block this morning</b> for the Q3 budget numbers
        Lisa is waiting on — it's the only deadline that's both urgent and blocking someone else.
      </p>

      <div className="relative mt-[18px] flex flex-wrap gap-3.5">
        {STATS.map((s) => (
          <div
            key={s.label}
            className="min-w-[120px] flex-1 rounded-[14px] border border-border bg-white/[0.04] px-4 py-3.5"
          >
            <Counter stat={s} />
            <div className="mt-0.5 text-[11.5px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
