# Zyro Chat — marketing / investor demo site

> Part of the emet vault: overview note [[Zyro Chat]] · screenshots and pitch video below · run it with `Start Zyro Chat.command` (or open `Open Zyro Chat.html` without Node).

React + Vite + TypeScript · Tailwind CSS · Framer Motion · Three.js (@react-three/fiber + drei) · Lucide

## Run it
```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build → dist/
npm run preview   # serve the production build
```
Requires Node 18+. Fonts are self-hosted (Fontsource), so the site works offline, which helps in a pitch room with bad Wi-Fi.

## Where things live
| What | File |
|---|---|
| Brand tokens (colours, as CSS variables) | `src/index.css` (`:root`) |
| Tailwind mapping, type scale, shadows, spacing | `tailwind.config.ts` |
| **The 12 AI employees**: profiles, demo-video scripts, chat tasks & replies | `src/data/agents.ts` |
| Employee avatars (swap any file, same name) | `src/assets/agents/<id>.svg` (png/webp/jpg also work) |
| Other copy + mock data (hero, contact email, testimonials…) | `src/data/content.ts` |
| Agent workspace (modal, demo player, chat, deliverables) | `src/components/agents/*` |
| Section order | `src/App.tsx` |
| One component per section | `src/components/sections/*` |
| 3D hero scene | `src/components/three/NeuralNetwork.tsx` |
| Static fallback for the 3D scene | `src/components/three/StaticOrb.tsx` |
| Shared animation variants | `src/lib/motion.ts` |

**Brand:** Zyro Blue `#3346FF` (primary) · Ion Cyan `#18C5F2` (accent) · off-white base `#FAFBFF`.
Type: Space Grotesk (display) + Inter (body) + JetBrains Mono (labels).

## Dashboards (demo)
Click **Log in** in the site nav, or open `#/login`. There is no real authentication: pick an account type and click through.

| Account | URL | What it shows |
|---|---|---|
| **Business** (a paying customer) | `#/app/overview` | Overview & live activity · **Unified inbox** (Instagram, Messenger, WhatsApp, TikTok, Google Business, email, website chat, Meta & Google lead forms) with AI autopilot / take-over · **Bookings sheet** (Excel-style, CSV export, week view, double-booking prevention) · **Calls** (AI receptionist transcripts) · **Connections** · **AI employees** · **Business settings** (name, type, hours, tone, autopilot) |
| **Zyro team** (owner) | `#/admin/overview` | All clients · add a client + generate their login · per-client inbox, bookings, calls, connections & business info · **All inboxes** across clients · escalation queue · connections matrix · "Open client dashboard" to see exactly what they see |

- Demo businesses cover the target industries: **Osteria Luce** (restaurant), **Hudson & Park Realty** (real estate), **Mercer Notary Services** (notary), **Lumora Boutique** (fashion store). Edit them in `src/portal/data.ts`.
- A **live demo feed** sends a sample message or call every ~15 s. The AI replies, books the slot (checking capacity so nothing overlaps) and writes it to the sheet. Use **Test message / Test call** in the top bar to trigger one on demand during a pitch.
- Business settings, connections and added clients are saved in the browser (localStorage). Messages and bookings reset on reload.
- Everything is mock data. Real integrations would use each platform's official OAuth/APIs (Meta Graph API, WhatsApp Cloud API, Google Business Profile, Microsoft Graph for Excel, etc.). Never store client passwords.

| Dashboard code | Where |
|---|---|
| Data model, scenarios per industry, scheduling logic | `src/portal/data.ts` |
| State + live AI simulation | `src/portal/store.tsx` |
| Business dashboard pages | `src/portal/customer/*` |
| Owner panel | `src/portal/admin/AdminApp.tsx` |

## AI employee workspace
- Click any employee card to open their workspace, or link to one directly with `#agent/<id>` (e.g. `http://localhost:5173/#agent/aria`), which is handy for jumping straight to an agent mid-pitch.
- **Watch demo**: a scripted, code-rendered "screen recording" of the agent doing a real job (play/pause, seek, restart). Each one is driven by the agent's `demo` block in `agents.ts`.
- **Try it**: a working mock chat. The suggestion chips return realistic scripted work (tickets, emails, charts, calendars, docs). Anything typed freely gets matched to the closest task, or the agent replies with its plan. *Approve & run* / *Revise* complete the loop.
- Keyboard: ← / → switch agents, Esc closes.
- Avatars are original characters made with the DiceBear "Micah" style by Micah Lanier (CC BY 4.0). Keep the credit in the footer, or replace the files with your own renders.

## Pricing
There's no public pricing. The **Contact** section asks prospects to email `zyrochat@gmail.com` (edit `contact` in `content.ts`). All "Book a demo" buttons open a pre-filled email.

## 3D hero
- Lazy-loaded (three.js is ~240 kB gzipped and never blocks first paint); the static SVG orb shows while it loads.
- About 8 draw calls (instanced nodes, merged line buffer, sprite halos), DPR capped at 1.75, and the render loop pauses when the scene is off-screen.
- Falls back to the static orb when the viewer prefers reduced motion, WebGL is unavailable, the device has fewer than 4 CPU cores or less than 4 GB of memory, or Save-Data is on.
- **Demo override:** add `?3d=1` to the URL to force the 3D scene (for example on a low-core laptop you're presenting from), or `?3d=0` to force the fallback.
- To swap the visual, replace the default export of `NeuralNetwork.tsx`.

## Motion and accessibility
- `MotionConfig reducedMotion="user"` plus a CSS `prefers-reduced-motion` block. With reduced motion on, the chat demo shows all its messages at once and the counters jump straight to their final values.
- All animation is transform/opacity based, and the card spotlight uses CSS variables (no React re-renders).

## Notes
All metrics, customer names, testimonials and logos are **illustrative placeholders** and are labelled on the page as demo content. Replace them before any public use.

## Screenshots
![site hero](<pitch-video/screenshots (hi-res)/01_site_hero.png>)
![site agents](<pitch-video/screenshots (hi-res)/02_site_agents.png>)
![agent workspace](<pitch-video/screenshots (hi-res)/03_agent_workspace.png>)
![login](<pitch-video/screenshots (hi-res)/04_login.png>)
![overview](<pitch-video/screenshots (hi-res)/05_overview.png>)
![inbox](<pitch-video/screenshots (hi-res)/06_inbox.png>)
![sheet](<pitch-video/screenshots (hi-res)/07_sheet.png>)
![week](<pitch-video/screenshots (hi-res)/08_week.png>)
![conflict](<pitch-video/screenshots (hi-res)/09_conflict.png>)
![calls](<pitch-video/screenshots (hi-res)/10_calls.png>)
![connections](<pitch-video/screenshots (hi-res)/11_connections.png>)
![team](<pitch-video/screenshots (hi-res)/12_team.png>)
![owner overview](<pitch-video/screenshots (hi-res)/13_owner_overview.png>)
![owner inbox](<pitch-video/screenshots (hi-res)/14_owner_inbox.png>)
![owner connections](<pitch-video/screenshots (hi-res)/15_owner_connections.png>)
![owner add client](<pitch-video/screenshots (hi-res)/16_owner_add_client.png>)
![mobile thread](<pitch-video/screenshots (hi-res)/17_mobile_thread.png>)
![mobile overview](<pitch-video/screenshots (hi-res)/18_mobile_overview.png>)

## Pitch video (≈2:00)
- Voiceover script: [VOICEOVER_SCRIPT.txt](<pitch-video/VOICEOVER_SCRIPT.txt>) · storyboard: [Storyboard (open me).html](<pitch-video/Storyboard (open me).html>) · shot prompts: [GROK_PROMPTS.txt](<pitch-video/GROK_PROMPTS.txt>)
- Storyboard frames:

![S02 title card](<pitch-video/frames/S02_title_card.png>)
![S03 hero laptop](<pitch-video/frames/S03_hero_laptop.png>)
![S04 inbox laptop](<pitch-video/frames/S04_inbox_laptop.png>)
![S05 phone thread](<pitch-video/frames/S05_phone_thread.png>)
![S06 sheet laptop](<pitch-video/frames/S06_sheet_laptop.png>)
![S07 conflict laptop](<pitch-video/frames/S07_conflict_laptop.png>)
![S08 calls laptop](<pitch-video/frames/S08_calls_laptop.png>)
![S09 connections laptop](<pitch-video/frames/S09_connections_laptop.png>)
![S10 agents laptop](<pitch-video/frames/S10_agents_laptop.png>)
![S11 agent workspace laptop](<pitch-video/frames/S11_agent_workspace_laptop.png>)
![S12 owner panel laptop](<pitch-video/frames/S12_owner_panel_laptop.png>)
![S12b owner add client laptop](<pitch-video/frames/S12b_owner_add_client_laptop.png>)
![S13 hero combo](<pitch-video/frames/S13_hero_combo.png>)
![S14 end card](<pitch-video/frames/S14_end_card.png>)

## The 12 AI employees (avatars)
![aria](<src/assets/agents/aria.svg>) ![kai](<src/assets/agents/kai.svg>) ![nova](<src/assets/agents/nova.svg>) ![sage](<src/assets/agents/sage.svg>) ![milo](<src/assets/agents/milo.svg>) ![remy](<src/assets/agents/remy.svg>) ![leo](<src/assets/agents/leo.svg>) ![sol](<src/assets/agents/sol.svg>) ![nico](<src/assets/agents/nico.svg>) ![mara](<src/assets/agents/mara.svg>) ![kit](<src/assets/agents/kit.svg>) ![otto](<src/assets/agents/otto.svg>)

Back to [[Zyro Chat]] · [[Projects & ideas]] · [[🏔️ emet Dashboard]]
