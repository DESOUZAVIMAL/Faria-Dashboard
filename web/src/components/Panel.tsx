import { motion } from "motion/react";
import type { ReactNode } from "react";

export function Panel({
  title,
  count,
  delay = 0,
  children,
}: {
  title: ReactNode;
  count?: number | string;
  delay?: number;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.2, 0.7, 0.2, 1] }}
      className="ts-glass mb-[22px] rounded-[18px] px-[22px] py-5"
    >
      <h3 className="mb-4 flex items-center gap-2.5 font-heading text-[15px] font-semibold">
        {title}
        {count !== undefined && (
          <span className="rounded-full border border-border bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">
            {count}
          </span>
        )}
      </h3>
      {children}
    </motion.div>
  );
}
