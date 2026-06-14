import { NavLink } from "react-router-dom";
import { LayoutDashboard, CalendarRange, CalendarDays } from "lucide-react";
import { TEAM } from "@/lib/data";

const NAV = [
  { to: "/today", label: "Today", icon: LayoutDashboard },
  { to: "/schedule", label: "Schedule", icon: CalendarRange },
  { to: "/week", label: "Week", icon: CalendarDays },
];

export function TopBar() {
  return (
    <div className="sticky top-0 z-30 mb-6 border-b border-border bg-background/60 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1200px] items-center gap-5 px-6 py-3.5">
        <div className="flex items-center gap-2 font-heading text-xl font-bold">
          <span className="ts-pulse inline-block h-2.5 w-2.5 rounded-full bg-cyan shadow-[0_0_12px_var(--cyan)]" />
          <span className="bg-gradient-to-r from-white to-[#9db4ff] bg-clip-text text-transparent">
            TimeSync
          </span>
        </div>

        {/* nav */}
        <nav className="flex items-center gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                [
                  "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition",
                  isActive
                    ? "ts-glow-primary bg-gradient-to-r from-primary to-accent2 text-white"
                    : "text-muted-foreground hover:bg-white/[0.06] hover:text-white",
                ].join(" ")
              }
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-[18px] text-[12.5px] text-muted-foreground xl:flex">
          {TEAM.map((t) => (
            <div key={t.name}>
              {t.flag} {t.name}{" "}
              <b className="font-semibold tabular-nums text-foreground">{t.clock}</b>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2.5 border-l border-border pl-[18px]">
          <div className="ts-glow-primary grid h-[34px] w-[34px] place-items-center rounded-full bg-gradient-to-br from-primary to-accent2 text-[13px] font-bold text-white">
            AC
          </div>
          <div className="hidden text-[13px] font-semibold sm:block">Alex Chen</div>
        </div>
      </div>
    </div>
  );
}
