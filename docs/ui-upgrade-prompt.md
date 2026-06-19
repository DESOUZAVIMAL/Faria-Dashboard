# Premium UI Upgrade — AI Studio Prompt

> Paste **the box below** into AI Studio (the workspace with your app) to transform the frontend into a
> premium, high-end, futuristic dashboard — using the latest libraries we researched — **without breaking
> any data logic, the backend, the availability math, or the Gantt/heatmap.** Works for Faria Calendar
> (and the same approach applies to Ocelli).

---

```
GOAL: Make this app's UI/UX PREMIUM and futuristic — top-tier, like Linear /
Vercel / Raycast / Vimcal. UPGRADE VISUALS, MOTION, AND RESPONSIVENESS ONLY.
Do NOT change any data logic, API routes, backend, timezone math, availability
levels, noise filter, or the Gantt/heatmap behavior. Keep everything working.

=== 0. GROUND RULES ===
- This is a DATA-DENSE dashboard. Keep the core clean and readable; use heavy
  effects sparingly (hero/empty states/accents only) — never over-animate.
- Respect prefers-reduced-motion: disable non-essential animation when set.
- Keep it fast: GPU-friendly transforms/opacity only; no layout-thrashing.

=== 1. DESIGN SYSTEM (enforce precisely) ===
- Dark mode only. Background #070A14 with a subtle ANIMATED AURORA (slow-moving
  radial glows in blue/purple/cyan + a very slow rotating conic gradient overlay
  at low opacity). Must be smooth and not distracting.
- Glassmorphic panels: bg rgba(20,27,48,0.55), 1px border rgba(255,255,255,0.08),
  backdrop-blur, soft large shadow, radius 16–20px.
- Text: #EAF0FF / #AEB9D6 / #6B779C. Accents: blue #6D8BFF, purple #A78BFA,
  cyan #5EEAD4 (primary = blue→purple gradient with a soft outer glow).
- Availability levels: 0 free #34D399, 1 likely #5EEAD4, 2 tentative #FBBF24,
  3 busy #FB7185.
- Fonts: Space Grotesk (display/headings), Inter (body), JetBrains Mono (times/
  numbers). Use tabular-nums for all times and counts. Tighten heading tracking.
- Consistent 4px spacing scale, consistent radii, consistent icon set (lucide-react).

=== 2. ANIMATION — USE MOTION (motion/react). It is installed but currently unused. ===
Add tasteful, performant micro-interactions:
- On load: panels and list items RISE + FADE in with a STAGGER (small delay per
  item). Sidebar, header, heatmap, day panels each animate in.
- Numbers (heatmap totals, any stats) COUNT UP on mount/update.
- Hover: cards, people rows, heatmap cells get a subtle LIFT (translateY) + scale
  + glow. Buttons get a soft press/scale.
- Day-detail panels: open/close with a spring LAYOUT animation (AnimatePresence +
  layout). Stacking/reordering animates smoothly.
- "Everyone free" slots: animate in with a green GLOW/scale pulse.
- The "now" line: a gentle pulsing head.
- Active tab/toggle: animated gradient highlight that slides between states.
- Loading: shimmer SKELETONS (not just a spinner) for the heatmap and panels.

=== 3. LAYOUT & POLISH (2026 dashboard pattern) ===
- Refined left sidebar (240–280px): grouped roster, toggles, legend — with clear
  section headers, generous whitespace (group with space, not borders).
- A clean header row; consider a top KPI strip (e.g. "people selected", "best
  overlap today", "hidden noise") as small glass stat chips.
- 12-column-ish responsive content grid: week heatmap on top, stacked day panels
  below, best-slots summary.
- Micro-polish: soft inner highlights on glass, subtle gradient borders on active
  elements, refined empty states ("No overlap today — try another day") with an
  icon and a suggestion, hover tooltips on heatmap cells showing "N of M free".

=== 4. COMPONENT QUALITY (optional but encouraged) ===
- If practical, adopt shadcn/ui primitives for buttons, toggles, tooltips, dialogs,
  scroll areas (cleaner + accessible). Keep our exact theme tokens.
- You may borrow a FEW premium accent effects in the style of Aceternity UI / Magic
  UI (e.g. a subtle animated gradient border, a shimmer on the hero, a bento-style
  arrangement) — sparingly, only where it improves feel, never on dense data areas.
- Use Tremor-style KPI cards if you add any small charts/stats.

=== 5. RESPONSIVENESS (currently desktop-only — fix it) ===
- Tablet/mobile: sidebar collapses into a slide-in DRAWER (hamburger toggle).
- Heatmap: horizontally scrollable with sticky hour column; comfortable touch targets.
- Day panels: stack full-width; ruler stays legible.
- Add sm:/md:/lg:/xl: breakpoints throughout; nothing should overflow or clip.

=== 6. ACCESSIBILITY ===
- Visible focus rings, keyboard navigation for people/toggles/day open-close,
  aria-labels on icon buttons, sufficient contrast, prefers-reduced-motion honored.

=== 7. OPTIONAL — AI COPILOT PANEL SHELL (UI only; wire later) ===
- Add a slide-in right-side "Assistant" panel (toggle from the header) styled like
  Vercel AI Elements: a prompt input at the bottom, a scrollable message area with
  streaming-style message bubbles, suggestion chips ("find 45 min with Chloe &
  Kenji next week"), and a tool-call confirmation card pattern. Leave it as a
  presentational shell with mock content — DO NOT wire it to any model yet.

=== ACCEPTANCE ===
1. Smooth staggered entrance animations; count-up numbers; spring day-panel
   open/close; hover-lift everywhere — via Motion (motion/react).
2. Shimmer skeleton loaders instead of bare spinners.
3. Fully responsive: sidebar drawer on mobile, scrollable heatmap, stacked panels.
4. prefers-reduced-motion disables non-essential animation.
5. The dark glassmorphic theme + exact colors/fonts above are applied consistently.
6. ALL existing data, availability logic, timezone math, Gantt, and heatmap still
   work exactly as before — nothing functional changed.
7. Looks premium/futuristic and stays clean & readable (no over-animation).
```

---

## Notes
- Run it **after** the security fixes (`docs/faria-calendar-fixes.md`) so you're not polishing on top of issues.
- It explicitly tells AI Studio **not to touch logic** — so your working Calendar integration and availability math stay intact.
- The optional **AI copilot panel** is a UI shell only; we wire it to Gemini in the separate AI-features stage.
- For the same premium pass on **Ocelli**, reuse this prompt — just swap "Gantt/heatmap" for "inbox/brief/tabs".
