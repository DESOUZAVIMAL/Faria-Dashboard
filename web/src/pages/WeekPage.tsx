import { motion } from "motion/react";
import { WeekHeatmap } from "@/components/WeekHeatmap";

export function WeekPage() {
  return (
    <main className="mx-auto max-w-[1000px] px-6 pb-20 text-left">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-5"
      >
        <h1 className="font-heading text-2xl font-bold">Week</h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          Find the best windows across the whole week — brighter cells mean more teammates are free.
        </p>
      </motion.div>
      <WeekHeatmap />
    </main>
  );
}
