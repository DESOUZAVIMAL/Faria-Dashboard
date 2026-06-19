# UI/UX References — Advanced Dashboard + AI (toolkit)

> Curated, researched references for making Ocelli & Faria Calendar look advanced and AI-integrated.
> Everything here is **shadcn/ui + React + Tailwind based** (matches our stack), and most install via the
> shadcn CLI or copy-paste. *Jun 2026.*

## 1. AI-UI component libraries (build the "AI inside the dashboard" look)
| Tool | Use | Link |
|---|---|---|
| **Vercel AI Elements** ⭐ | Official, on shadcn/ui: chat, streaming responses, reasoning/"thinking" blocks, tool-call display, citations, suggestions, prompt input, **voice**, workflow | https://elements.ai-sdk.dev/ |
| **assistant-ui** | Agent-grade chat: tool calls, generative UI, human-in-the-loop; AI SDK/LangGraph adapters | https://www.shadcn.io/ai |
| **Vercel AI Chatbot template** | Canonical Next.js + AI SDK starter (streaming, multi-model) | https://github.com/vercel/ai-elements |
| **Tremor** | Dashboard data-viz: KPI cards, charts | (search "Tremor Raw") |

## 2. Component marketplaces / registries (advanced building blocks)
| Source | What | Link |
|---|---|---|
| **21st.dev** ⭐ | "npm for design engineers" — largest marketplace of shadcn/ui React+Tailwind components, blocks, hooks. Code is **yours to edit**. Installs via `npx shadcn`. Each component ships an **AI prompt** you can paste into an AI IDE (Cursor/Windsurf/AI Studio) to auto-integrate; works with the **shadcn MCP server**. | https://21st.dev |
| **Aceternity UI** | Stunning visual effects (3D cards, glowing beams, particles) — Tailwind + Framer Motion, 200+ free | https://ui.aceternity.com/ |
| **Magic UI** | Utility animations (shimmer, sparkles, marquee, bento grids), clean light/dark | (search "Magic UI") |
| **React Bits / Skiper UI** | More animated component packs | (search) |
| **shadcn.io / Shadcnblocks** | Big shadcn block marketplaces | https://www.shadcn.io/ |

## 3. Animation — Motion (formerly Framer Motion)
- The standard React animation library. Aceternity/Magic UI plug into it. (Your apps already list it as a dependency — but AI Studio's build left it **unused**.)
- Use for **tasteful micro-interactions**: panels rise/fade in (staggered), count-up on stats, hover-lift on rows/cells, a glow/scale when an "everyone free" slot appears.
- Import: `motion/react`.

## 4. Figma → code (design-to-code AI)
| Tool | Note | Link |
|---|---|---|
| **Anima** | Most-installed Figma Dev Mode plugin; exports React + Tailwind + **shadcn/ui**; enterprise-backed | https://www.figma.com/community/plugin/857346721138427857 |
| **Builder.io (Visual Copilot)** | AI Figma→code pipeline; also website→Figma | https://www.figma.com/community/plugin/747985167520967365 |
| **Figma Make** | Figma's own text/image/frame → interactive React app | (in Figma) |
| **Figma Dev Mode MCP** | Lets an AI IDE read your Figma directly | (Figma Dev Mode) |

## 5. Inspiration galleries + apps to study
- Galleries: [Muzli 50 Best Dashboards 2026](https://muz.li/blog/best-dashboard-design-examples-inspirations-for-2026/) · [TailAdmin AI templates](https://tailadmin.com/blog/ai-dashboard-templates) · [Eleken AI dashboard design](https://www.eleken.co/blog-posts/ai-dashboard-design)
- Apps for "premium dark + AI" feel: **Linear, Vercel, Raycast, Notion, Perplexity, Cursor, Vimcal, Clockwise**
- Vlogs: YouTube search **"Vercel AI Elements demo"**, **"21st.dev shadcn"**, **"Aceternity UI dashboard"**, **"build AI copilot dashboard 2026"**

## 6. The 2026 advanced-dashboard layout pattern
240–280px left sidebar nav → top row of 4–6 KPI cards → 12-column grid for panels/charts.
Color for status only; group with whitespace not borders; AI baseline (ask-bar, insight cards, copilot panel).

## 7. Recommended stack & workflow for Ocelli / Faria Calendar
1. **Base:** shadcn/ui + Tailwind (the React app already uses this; the AI Studio build used raw Tailwind — add shadcn for these libs to drop in cleanly).
2. **Motion:** wire **Motion** for micro-interactions (the missing layer).
3. **AI UI:** drop in **Vercel AI Elements** for the copilot panel / streaming brief / suggested replies / tool-call confirmations / voice.
4. **Charts:** **Tremor** for any analytics (meeting-load, items-resolved).
5. **Flair (sparingly):** pull a few **21st.dev / Aceternity / Magic UI** pieces for accent moments — NOT all over a data dense dashboard.

## 8. Honest guidance
- A dashboard is **data-dense** — heavy landing-page effects (particles, 3D, beams) can hurt usability. Keep the core **clean** (shadcn + Tremor + tasteful Motion); use Aceternity/Magic UI flair only for a hero, empty states, or accents.
- These libraries are **easiest in a shadcn React project**. In AI Studio (raw Tailwind), copy a component's code or its provided **prompt** and ask it to integrate + adapt — or **export** the app and add components in your own repo.

## Sources
- 21st.dev — https://21st.dev · https://github.com/serafimcloud/21st
- Vercel AI Elements — https://elements.ai-sdk.dev/ · https://vercel.com/changelog/introducing-ai-elements
- Aceternity UI — https://ui.aceternity.com/ · Magic UI / React Bits comparison — https://www.pkgpulse.com/guides/aceternity-ui-vs-magic-ui-vs-shadcn-animated-react-2026
- Anima — https://www.figma.com/community/plugin/857346721138427857 · Builder.io — https://www.figma.com/community/plugin/747985167520967365
- Figma-to-code 2026 — https://www.sixtythirtyten.co/blog/from-figma-to-code-ai-design-to-dev-workflows-in-2026
- Muzli dashboards 2026 — https://muz.li/blog/best-dashboard-design-examples-inspirations-for-2026/
