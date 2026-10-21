# emet

> **For Claude (and humans) reading this repo:** this README is the single source of truth for what emet is, what we're aiming for, who does what, and which systems exist. Read it fully before doing any work. If you change anything in this repo, update this README in the same commit (see [How to contribute](#how-to-contribute)).

---

## 1. What emet is

emet is a 15-person non-profit team that is part of **LEINN Internacional** (university programme). This repo holds every idea, dashboard, system, and decision the team builds, so that any team member's Claude can pick up the full context.

- **Repo:** https://github.com/alvaroli01/emet
- **Started:** 13 Oct 2026 — everything is being built from scratch.
- **Repo owner:** Alvaro
- **What we sell:** _not decided yet_ — the team brainstorms this during the week of 19 Oct 2026.

## 2. The goal

| Metric | Target |
|---|---|
| Revenue | **€30,000** |
| Profit | **€15,000** (50% minimum margin) |
| Deadline | **June 2027** |

We go at our own pace — there is no fixed weekly revenue target.

## 3. Ground rules

- **€0 budget for tools right now.** Everything we build (dashboard, hosting, database, task boards, APIs) must run on free plans. No paid APIs or subscriptions until the team decides otherwise.
- **Languages:** everything in this repo (docs, specs, notes) is in English or Spanish. Only the **team dashboard** must also support German, French, Finnish, Portuguese (Brazil) and Russian.

## 4. Team structure (15 people, 5 groups)

**Leaders chosen (Oct 2026):** Alvaro (Team Leader), Rocco (Finance), Stefan (Communications), Mario (Customer), Nahuel (Marketing). Group membership comes from the Team Contract signed on 18 Oct 2026. Individual roles inside each group are still flexible. Names are in section 5.

### 👑 Team Leader group (2)
| Role | Responsibility / KPI |
|---|---|
| Team leader | Hit the €30K / €15K goal, run the weekly leaders' meeting, keep a 85%+ on-time task rate |
| Operations monitor | Daily check-ins with each group, flag blockers, manage school contact and upperclassmen outreach |

### 💰 Finance group (3)
| Role | Responsibility / KPI |
|---|---|
| Financial leader | Keep a 50% minimum margin, profit report every Friday |
| Bookkeeper | Log every sale and expense within 24 hours |
| Operations | Cut costs, keep stock in sync with sales |

### 🤝 Customer group (3)
| Role | Responsibility / KPI |
|---|---|
| Customer leader | Hit the team's revenue targets, resolve complaints within 48h |
| Sales rep ×2 | Hit personal sales targets (TBD), 20 new prospects / week each |

### 📣 Marketing group (5)
| Role | Responsibility / KPI |
|---|---|
| Marketing leader | Generate steady leads, launch a campaign for each product |
| Social media manager | Post on schedule, grow followers |
| Content creator | Deliver photo/video on deadline |
| Editor & designer | 48h turnaround, consistent brand |
| Market researcher | Test products and pricing before any spend |

### 🗂️ Communications group (2)
| Role | Responsibility / KPI |
|---|---|
| Project manager | Keep the task boards current, publish the Friday scorecard |
| Documentation & wellness | Record decisions, run the weekly morale check |

## 5. Who's who

| Name | Group | Role | Contact |
|---|---|---|---|
| Alvaro | 👑 Team Leader | Team leader | — |
| Stefan | 🗂️ Communications | Communications leader | — |
| Rocco | 💰 Finance | Financial leader | — |
| Fran | 💰 Finance | _TBD_ | — |
| Zayd | 📣 Marketing | _TBD_ | — |
| Nico | 🤝 Customer | _TBD_ | — |
| Nahuel | 📣 Marketing | Marketing leader | — |
| Emily | 📣 Marketing | _TBD_ | — |
| Elizabeth | 📣 Marketing | _TBD_ | — |
| Lassi | 🗂️ Communications | _TBD_ | — |
| Mario | 🤝 Customer | Customer leader | — |
| Martin | 📣 Marketing | _TBD_ | — |
| Fernando | 📣 Marketing | _TBD_ | — |
| Sasha | 📣 Marketing | _TBD_ | — |
| Mirage | 📣 Marketing | _TBD_ | — |

*(Groups come from the signed Team Contract (18 Oct 2026). Roles marked _TBD_ are still open, and the team can still change them.)*

## 6. Team profiles (preliminary)

Each member's self-review and peer-review results are summarised in [`docs/team-profiles.md`](docs/team-profiles.md), including which roles people picked versus the seats available, and the data gaps still to fix.

> ⚠️ **Treat these as a quick reference only, not as final roles.** Roles and leaders are decided by the team in the coming days, and some members said in class that they disagree with their results. Don't assign anyone a role based only on these profiles.

## 7. Weekly rhythm

| When | What | Owner |
|---|---|---|
| Daily | Check-ins with each group | Operations monitor |
| Within 24h of any sale/expense | Log it | Bookkeeper |
| Weekly | Leaders' meeting | Team leader |
| Weekly | Morale check | Documentation & wellness |
| Friday | Profit report | Financial leader |
| Friday | Scorecard (KPIs vs targets) | Project manager |

## 8. Systems

| System | Status | Where | Notes |
|---|---|---|---|
| Team dashboard (web app, personal logins, per-group permissions, task boards, 7 languages) | ✅ Built and redesigned ("Summit": topographic look, 3D mountain on Overview and login). 🌐 Online at https://emet-hq.vercel.app (free Supabase project `emet`, Frankfurt + Vercel Hobby). Members are being added with their alumni emails (most start as view-only) | Code: [`dashboard/`](dashboard/) · Setup guide: [`dashboard/README.md`](dashboard/README.md) · Spec: [`docs/dashboard-build-prompt.md`](docs/dashboard-build-prompt.md) | Next.js + Supabase free + Vercel Hobby, €0. Permissions enforced in the database (55 tests). Tested in a browser with sample data |
| Dashboard look ("emet glass", built from Alvaro's reference pictures, now in [`docs/design-references/`](docs/design-references/)) | ✅ Built | `src/components/home/` · `src/components/finance/finance-dashboard.tsx` · `src/components/marketing/marketing-dashboard.tsx` · `src/components/camp/personal-dashboard.tsx` · `src/components/team/` · `src/components/shell/tool-workspace.tsx` · `src/components/shell/assistant-bubble.tsx` · `src/components/nav.tsx` · `src/app/globals.css` | Dark liquid-glass workspace, Geist font, orange accent. **Today** = full-screen Bilbao-at-night photo (Adrian Villa / Unsplash licence) with icon rail, "Hey {name}, need help? / Just ask me anything" (Ask emet), glass pills and cards (sales by channel, tasks this vs last week, money per day, team health, your week) and a summit gauge over the 3D mountain. **Your week** is a week calendar (from "personal dashboard 2", `src/components/home/week-calendar.tsx`): a column per day (Mon–Fri, weekend only if something is planned), hours down the side, your own agenda plans as cards in their time slot, tasks assigned to you that are due that day on top of the column, today's column tinted red, a live red "now" line with the time, the plan happening now glowing orange; cards fade in one by one (opacity only — a transform made Chrome paint them as empty boxes inside the scrolling calendar); focus score, due today and late as chips. **Google Calendar** (2026-10-21): each member pastes their Google “Secret address in iCal format” once in Base camp → Agenda (“Show my Google Calendar in emet”); the link is stored encrypted and private to them (table `google_calendars`, migration 0025, not even admins can read it). Their Google events (repeats included, Madrid time) show in Your week in blue and open Google Calendar; fetched on each visit and every 5 minutes, so new events appear within a few minutes. **Ask emet** also reads the asker's own schedule (last 14 → next 60 days: tasks, team-leader tasks, Base camp plans, Google events; the 120 nearest) and answers schedule questions day by day. Read only — emet never writes to Google. **Team health** has the "Wellness score" animation from the home page picture: three sine waves (orange, gold, white) that keep flowing and crossing — calmer when the team is in good shape, faster when it needs care, a still flat line with no data; still with reduced motion. **Finance** = total revenue, payment-method cards, money in/out chart, week spending, recent activity, money-flow (Sankey), cashflow heatmap. **Every team section**: the page opens on its Overview dashboard; all tools (Overview, Task board, the rest) are in a glass Tools column on the right (a sheet on phones); the section assistant is a floating orange bubble bottom-right that opens a pop-up chat. **Marketing** ("marketing example 2") = key performance / conversion / analytics cards, social traffic by channel, daily clicks + DMs, top content table, marketing-goal donut and world map. **Base camp** ("personal dashboard 2", dark like home) = focus timer (kept on the device per day), my open tasks, today's plans + meetings, My week board (Mon–Fri, late/today/done chips, red now line), activity %, where my work is, and **Reminders** (private, table `reminders`). **Team** = table: search, Inactive / Somewhat active / Active filter, used the dashboard, finished a task, tasks finished x/y, last active (all last 30 days, from the activity log + task boards; "Manage people" fold below). **Member page** (`/team/<id>`, HireWise picture) = in progress / completed / sales this month tiles, profile card with email button, weekly activity gauge, current task countdown, activity by team, own-team vs other-teams split, month calendar of due dates, coming up. Menu: folding glass tree (Main / Teams / Tools) with an Ask emet card; round icon rail on Today; floating glass tab bar on phones. Other sections use the same glass header, "Needs you" list, number cards, assistant and Tools panel. **Dark theme only** (2026-10-15: the light theme switch was removed and old light-theme choices are ignored). **Today mountain** (variant "money" in `summit/mountain.tsx`): gold contour lines, gold glowing climbed trail, lit metal coins, a glowing € coin over the €30K summit and drifting gold sparkles. **Class demo data** (2026-10-15): example `[DEMO]` rows were added to the live database for a presentation and **removed again on 2026-10-21** (the demo scripts were deleted too; they're in git history before 2026-10-21). **Team tasks** (`team_tasks` + `team_task_people`, migration 0024): team leaders/admins get an "Assign tasks" tool in Team Leader (only they see it) to give a task to everyone, a whole team, several people or themselves, with optional details and due date. Each person sees it in My Tasks under "From the team leader" with a tick box; everyone sees who has finished (green tick) and who hasn't. Only leaders can create/delete; each person can only tick their own. A notification goes to everyone who has logged in. **Recorder fix**: Whisper sometimes answers a quiet half-minute with ". . . ."; that text used to be sent as the hint for the next chunk, so every later chunk also came back as dots (the audio itself was fine). Dot/punctuation-only answers are now treated as nothing heard, junk is never used as a hint, and an empty answer is retried once without the hint. **Upload an audio file** (2026-10-21): the Record window (Base camp → Docs and Meeting log) also takes an existing audio file — voice memo, WhatsApp audio, mp3, m4a, wav, ogg, webm, up to 90 minutes. The browser decodes it at 16 kHz mono and sends 2-minute WAV pieces (under Vercel's 4.5 MB request limit) to the person's own Groq key, skipping silent pieces; then the same notes (summary, key points, decisions, action items) + transcript are saved. The file itself isn't stored again (saves the free 1 GB); needs Groq connected (`src/lib/ai/audio-file.ts`). Base camp docs with audio have a **Redo transcript** button that re-reads the saved audio (kept 60 days) into a new doc. **Ask emet is a conversation**: the pop-up keeps every question and answer, has a follow-up box and a "New chat" button; the last 8 turns are sent with each question so follow-ups make sense. Today's ask box types example questions by itself (decoration only; stops when you type, still with reduced motion). **Readability over photos**: all text is medium weight with bold titles and numbers, white (dark theme) or black (light theme), grey text at 86% / 80%; glass panels are 80% solid with a stronger blur, grey text is brighter (74%), pills have a dark base, page title blocks sit in a glass box, and Today's ask box gets a soft shadow (`.on-photo` in `globals.css`). **Section photos** (all free under the Unsplash License, in `public/img/sections/`): Overview = snowy range at twilight (Kseniia Lobko), Base camp = tent under the stars (Wei Pan), Team = friends round a campfire (Vitaly Gariev), Team Leader = climber on a summit (Karl Magnuson), Finance = stacks of gold coins on a dark surface (Anthony Aird), softened and extra dark so charts stay clear, Customer = lit shopfront at night (Tanya Barrow), Marketing = filming with a phone at night (Amari Shutters), Communications = city river and bridge at night (ayumi kubo), General board / My tasks = desk at night (Zoshua Colah), Idea lab = glowing bulb (Logan Voss), Meeting log = studio microphone (Jonathan Velasquez), Scout = person looking at the horizon (Robert Bye). **Overview** = company dashboard: revenue / profit / sales this week / time left (bars show time used), day-by-day climb to €30K, June forecast at the last-4-weeks pace, teams table (health, open, overdue, done this week, on time, blockers, active people), people active, morale, needs attention (blockers, overdue tasks, customer problems, low stock), due in the next 7 days, money per week, what sells (channel + best sellers), latest decisions, activity. Logo: orange tile with a white twin summit (`src/components/summit/logo.tsx`, favicon `src/app/icon.svg`). Idea lab layout unchanged |
| My Projects (leaders create projects, members work inside them) | ✅ Built (2026-10-21) | Profile → My Projects · `/projects/<id>` · `dashboard/src/components/projects/` · migration `0027_my_projects.sql` | Same projects Finance tags sales/expenses with. Only leaders (Liderazgo + admins) create, edit, delete projects and choose the people; members + leaders see a project, Finance only sees names (to tag sales). Each project: Overview (goal bar, money, latest updates/links, people), Money (revenue/costs/profit + revenue per week from Finance), Tasks (its own private task board — tasks show in My Tasks, Today and Ask emet, open inside the project), Links (Google Docs/Sheets/Slides/Drive/Canva/Notion… with icons, one click opens), Files (25 MB each, private bucket `projects`), Updates feed. Notifications when added and on new links/files/updates. **Tick-off tasks** (2026-10-21): in a project's Tasks tab leaders give tasks to the project's people (like "From the team leader"); each person ticks their own, everyone in the project sees who finished; they also show in My Tasks with the project's name; private to the project (`team_tasks.project_id`, migration 0028). Project boards are private to their members (board/card read rules use `can_see_board`; activity feed skips project boards) |
| Documents: company documents + private My folder | ✅ Built (2026-10-21) | Team Leader → Tools → Company documents (leaders) · Avatar menu → My profile → Documents (everyone) · `dashboard/src/components/documents/` · migration `0026_documents.sql` | Folders inside folders. Leaders create folders and upload / rename / delete company files; everyone opens them read-only from their own profile and gets a notification for each new file. My folder is each person's private drive — not even admins can see it (database + storage rules, tested). Files in the private Supabase bucket `documents`, opened with 5-minute links; PDFs and images open in a tab, other files download. Max 25 MB per file; the free 1 GB is shared with meeting recordings (leaders see a storage bar) |
| Task boards: 1 general company board + 1 per group (6 total) | ✅ Built into the dashboard | Dashboard → General board and each group tab | Drag and drop, assignees, due dates, labels, checklists, comments, My Tasks. Optional Trello sync per board, off by default ([`dashboard/TRELLO_SETUP.md`](dashboard/TRELLO_SETUP.md)) |
| Base camp: each member's private area (My week + reflection, Agenda, Docs, Idea wall, Password vault) | ✅ Live in the dashboard (Base camp in the menu) | Dashboard → Base camp · tables in `dashboard/supabase/migrations/0008_basecamp.sql` | Private to its owner, even from admins (database-enforced, 15 tests). Docs can be shared read-only and downloaded as Word/PDF/Markdown. Vault is encrypted on the device with a personal passphrase: forgotten = unrecoverable. Note-taker: **Docs → 🎙 Record** turns a class/meeting into a dated doc (key points, decisions, action items + full transcript). Each member connects their **own free Groq account** (own ~8 h/day of audio); keys are stored encrypted and private. No account → browser transcription |
| Finance tab (upgrade, spec by Stefan) | ✅ Live · Google Sheet mirror waits for the Google connection | `dashboard/src/components/finance/` · migration `0016_finance.sql` · [`dashboard/FINANCE_SHEET_SETUP.md`](dashboard/FINANCE_SHEET_SETUP.md) | Overview (waterfall, margin gauge, expense donut, over-time vs the €30K pace, sales heatmap, payment method & channel, 14 explained metric cards) · Projects (picker, ROI, budget vs actual, expedition leaderboard) · Ledgers (payment method, project, filters with totals, reversals instead of deletes) · Stock (value, low-stock alerts, days left, product linking switch — off) · Bookkeeper (quick add with receipt photo, expense claims, cash count, month close, audit log, CSV import, 24 h compliance, sync status) · live “emet Books” Google Sheet + nightly .xlsx + Download as Excel |
| Workspace tools | ✅ Live | migration `0015_workspace.sql` · `src/components/workspace/` | **Today** (first screen after login: due today/late, priorities, agenda, quick actions, Friday report, goal) · **Notifications** bell (assigned, comments, meetings, ideas, shared docs, design requests, due tomorrow, report — live, in each reader's language) · **⌘K search** across tasks, docs, meetings, decisions, ideas, people · **Ask emet** (questions answered from the data you can see, with your Groq key) · **Templates** (product launch, stall day, event, campaign, Friday report) and **Repeat** on any card · **Automatic Friday report** · **Calendar sync** (private feed for Google/Apple/Outlook) |
| Idea lab | ✅ Live (menu → Idea lab) | `dashboard/src/app/(app)/lab` · migration `0014_idea_lab.sql` · scoring `src/lib/lab/score.ts` | Anyone pitches an idea; AI (member's own free Groq key) researches it on the web with sources and scores 7 criteria against our goal (demand, ≥50% margin, €0 start, time to first sale, reach €30K, team fit, risk). The app computes the score /100 + verdict, the numbers, a 7-day €0 test (→ tasks in one tap) and stronger versions to explore. Team votes and discusses |
| Meeting log (shared recordings) | ✅ Live (menu → Meeting log) | `dashboard/src/app/(app)/meetings` · migration `0012_meetings.sql` | Anyone records a training session, phone call, video call or leaders’ meeting with the mic inside Meeting log → notes + transcript + audio for the whole team, sorted by date, filter by type. Leaders’ meetings only visible to leaders (database rule, tested). Audio stays 30 days in the dashboard, then moves nightly to the team Google Drive (15 GB free) and still plays from here; admins see a storage meter and connect Drive from this page |
| Database backups (weekly, encrypted) | ✅ Running, first backup verified (opens, 33 app tables + logins) | Private repo `alvaroli01/emet-backups` (restore steps in its README) | Every Sunday via GitHub Actions, €0, last 12 weeks kept. AES-256 encrypted; the passphrase is kept by Alvaro — without it backups can't be opened |
| Reliability housekeeping | ✅ Daily | `dashboard/src/app/api/health` (Vercel Cron) | Keeps the free database from pausing; deletes note-taker audio older than 60 days (1 GB free storage). Transcripts and notes are kept forever |
| Marketing section (deep build, spec [`docs/marketing-build-prompt.md`](docs/marketing-build-prompt.md)) | ✅ Live · works with manual logging now; Instagram sync later (needs a Business/Creator account) | `dashboard/src/components/marketing/` · migration `0017_marketing.sql` · calculations `src/lib/marketing.ts` | **Pulse** (profit vs €15K pace, posts/week, hit rate = 7-day views ≥ 2× our own median, share + save rate, DMs that bought, revenue by channel, do more / do less by tag, data-quality warnings) · **My week** (numbers to log at 24 h / 48 h / 7 days, content due, briefs, design requests) · **Content** pipeline idea → posted with glossary tags + leaderboard · **Briefs** (leader approves → content in one click) and **Campaigns** (objective + target, post-mortem prefilled) · **What works** (scale/iterate/kill decisions, performance by tag, experiments, swipe file) · **Attribution** (emet short links `/go/…` with UTMs, click counts and printable QR codes; discount codes per channel; DM inquiries; funnel; how often code and “heard about us” agree). Finance sales now ask “how did they hear about us?” |
| Plans: workspace roadmap | 📝 Approved ideas built except 9 (phone app, postponed) | [`docs/workspace-roadmap.md`](docs/workspace-roadmap.md) · research: [`docs/reports/`](docs/reports/) | Marketing spec built from a 4-part sourced research report (metrics, marketing ops, free data sources, visualisation) |
| Scout: find first clients (lead finder) | ✅ Built (menu → Scout) · spec [`docs/lead-finder-build-prompt.md`](docs/lead-finder-build-prompt.md) | `dashboard/src/app/(app)/scout` · `src/lib/scout/` · migration `0018_scout.sql` | Describe a project (what we sell, to which businesses, deal-breakers) → pick country + city + radius → Scout finds places on OpenStreetMap + web search (no Google scraping, €0), reads each place's own website (robots.txt respected), and judges it for THIS project: score /100 from 7 criteria computed by the app, strong/good/maybe/not worth it, what to offer first, channel, opening lines, who/when, objections. Every place is stored once and never researched twice; "Check a place" takes a pasted Google Maps link, website or Instagram. Leads get an owner, status and next-step date (shows on Today); "contacted" creates a Customer prospect. Explained live on a 3D globe with a plain-language step log. Uses each member's own free Groq key. **Team key pool** (2026-10-21, migration 0032): **My connections** (avatar menu → My connections, on your own profile page) shows Groq, the Mistral backup, "Lend my key to Scout" and Google Calendar in one place — anything not connected shows its steps right there; Scout also has a small **AI connections** button with the same controls; Scout then tries the searcher's own key, then lent keys (least used today first), skipping keys that are out (remembered in `ai_key_usage`), and uses a lent key for at most 60% of each model's daily allowance so its owner keeps the rest. Lent keys are only decrypted on the server and only by Scout (never Ask, Idea lab or notes); nobody sees them, members see only who lends. Last resort: Mistral backup keys — each member can connect their own free Mistral key in AI connections (Experiment plan, no card; encrypted, owner-only table `backup_keys`), used for their own searches and, if they lend their Groq key, for everyone's; an optional team key in Vercel env `MISTRAL_API_KEY` is tried last. Used for planning, filtering and scoring — never web search. Members' own Ask, Idea lab and notes use is counted too, so the 60% cap really leaves lenders their share. The final score always comes from gpt-oss-120b or Mistral Medium, never a smaller model; if both are out Scout waits. Each search logs the AI tokens it used (`src/lib/ai/pool.ts`, `call.ts`, `ring-server.ts`). Customer, Marketing and admins run searches; everyone reads |
| Idea lab council + business checks | ✅ Built (Idea lab → open an analysed idea) | `src/lib/lab/council.ts` · `src/components/lab/council.tsx` | Based on Alvaro's LLM Council skill: 5 advisors (Contrarian, First principles, Expansionist, Outsider, Executor) → anonymous peer review → chairman's verdict and first step. Unit economics (profit per sale, margin vs 50%, break-even ROAS and max cost per sale, from the ecom-profit-check method) and proof-of-demand links (Meta Ad Library, Google Trends; research now looks for proof it already sells). Strong/promising ideas get "Find first clients with Scout". The app's score stays the official number |
| Shared Claude Code skills (24) | ✅ In the repo, load automatically for everyone | [`.claude/skills/`](.claude/skills/) · versions in [`skills-lock.json`](skills-lock.json) | Database: `supabase`, `supabase-postgres-best-practices` · Server/React: `next-best-practices`, `vercel-react-best-practices` · Design: `impeccable` (main), `design-taste-frontend`, `redesign-existing-projects`, `minimalist-ui` · Testing in a browser: `webapp-testing` · Animated components: `magic-ui` (Magic UI, MIT, via the shadcn registry) · also `interface-design`, `kpi-dashboard-design`, `shadcn` · Clone and improve an existing app: the 11 Replica skills (`replica-recon` → `replica-architect` → `replica-design` → `replica-build` → `replica-backend` → `replica-test` → `replica-diff` → `replica-entrepreneur` → `replica-brand` → `replica-launch` → `replica-deploy`; from [Jakeschincariol/replica-skill](https://github.com/Jakeschincariol/replica-skill), MIT; run in order, each writes to a `replica/` folder; `replica-entrepreneur` alone is a quick way to check if an app idea is worth building). All free. Update with `npx skills update` |
| Design references (the pictures the dashboard was built from) | ✅ In the repo | [`docs/design-references/`](docs/design-references/) | 7 reference pictures (Today, Base camp, Finance ×2, Marketing, member page, Team table), each mapped to the screen it shaped, with the shared "emet glass" rules. **Reference only:** these are third-party designs and must never be shipped in `dashboard/public/` |
| Obsidian vault (team knowledge base) | ✅ In the repo | [`obsidian/emet/`](obsidian/emet/) | Open the folder in Obsidian (free) as a vault. It holds company, team, systems, history (changelog, decisions, daily notes) and resources, linked to each other, plus a canvas map. Built from this README and the team chats on 21 Oct 2026; keep this README as the source of truth |

## 9. Decisions log

| Date | Decision | Decided by |
|---|---|---|
| 2026-10-13 | Repo created as the shared source of truth; every change also updates this README | Alvaro |
| 2026-10-13 | Team split into 5 groups / 15 roles (section 4) — names not assigned yet | Team |
| 2026-10-13 | Build one shared dashboard with personal logins, per-group edit rights and view-all for everyone | Alvaro |
| 2026-10-13 | Deadline set to June 2027; no fixed weekly revenue pace | Alvaro |
| 2026-10-13 | €0 tool budget for now — free plans only | Alvaro |
| 2026-10-13 | Dashboard in English, Spanish, German, French, Finnish, Portuguese (Brazil), Russian | Alvaro |
| 2026-10-13 | 6 task boards: 1 general company board + 1 per group | Alvaro |
| 2026-10-13 | Preliminary team profiles (self + peer reviews) added as a quick reference, not final roles | Alvaro |
| 2026-10-13 | Dashboard built step by step in `dashboard/` (7 steps); step 1 = database, login, permissions | Alvaro |
| 2026-10-13 | Dashboard is invite-only: a login only works for emails an admin added; members start with no group/role | Alvaro |
| 2026-10-13 | Alvaro is the starting dashboard admin until Team Leaders are chosen (Team Leader group = admins) | Alvaro |
| 2026-10-13 | Any member can comment on any card and request a design from Marketing; editing stays group-only | Alvaro |
| 2026-10-13 | Overview: profit = sales − cost of goods − expenses; a task is on time if it reaches Done by its due date | Alvaro |
| 2026-10-13 | Dashboard finished (steps 3–7): 6 task boards, group tools, Team management, 7 languages, optional Trello sync, dark mode | Alvaro |
| 2026-10-13 | Morale comments are private to Communications + team leaders; everyone sees the anonymous weekly average | Alvaro |
| 2026-10-13 | Anyone can request a design from Marketing; only Marketing works the queue | Alvaro |
| 2026-10-14 | Claude Code skills live in the repo (`.claude/skills/`) so every teammate's Claude uses the same ones | Alvaro |
| 2026-10-14 | Dashboard look = "Summit": €30K is a mountain summit, a base camp every €5K; one interactive 3D mountain (Overview + login), clean 2D everywhere else | Alvaro |
| 2026-10-14 | Dashboard put online on free plans: Supabase project `emet` (Frankfurt) + Vercel Hobby at emet-hq.vercel.app; public sign-up off | Alvaro |
| 2026-10-14 | Every member gets a private Base camp; nobody else (admins included) can read it. Shared team passwords belong in a shared manager like Bitwarden, not personal vaults | Alvaro |
| 2026-10-14 | Note-taker will use Groq's free tier (Whisper) with automatic fallback to the browser's speech recognition; Spanish + English | Alvaro |
| 2026-10-14 | Each member uses their own free Groq account for the note-taker, so everyone has their own daily allowance | Alvaro |
| 2026-10-14 | Weekly encrypted database backups in a private GitHub repo; recordings' audio kept 60 days, transcripts forever | Alvaro |
| 2026-10-14 | Stefan added as a second admin | Alvaro |
| 2026-10-14 | Meeting log: team meetings are recorded and shared with everyone; leaders’ meetings only with leaders; only the author or an admin can delete one | Alvaro |
| 2026-10-14 | North star for emet HQ: the team works inside it daily; every feature must save time. Approved roadmap ideas 2, 4, 5, 6, 7, 8, 9, 10 | Alvaro |
| 2026-10-14 | Business idea not decided yet; ideas go through the Idea lab (AI research + score + team votes). Instagram account and products to come; phone app postponed | Alvaro |
| 2026-10-14 | Marketing measures itself against its own numbers: a “hit” is a post with ≥ 2× our 30-day median views; posts only count when tagged from the shared glossary; every sale asks “how did you hear about us?” (it decides stall/word-of-mouth, codes and links decide online) | Alvaro |
| 2026-10-14 | Scout uses only free, legal sources (OpenStreetMap, web search, the business's own site); no Google Maps scraping; Google Places stays off unless the team agrees (needs a billing card). Outreach advice avoids cold email (Spanish LSSI) | Alvaro |
| 2026-10-14 | A Grok bot account (gert@mail.grokbot.com) was added with full admin rights at Alvaro's request, so it can learn the dashboard. Martin added as view-only member | Alvaro |
| 2026-10-14 | Dashboard redesign: keep the Summit identity (mountain, base camp, map palette), add a personal hero with one 3D/interactive visual to every section, group tabs into categories, use Magic UI for motion components | Alvaro |
| 2026-10-14 | Visual style changed to "Studio" (bento tiles, iris accent, team colours, Onest font) chosen by Alvaro over "Night Ops" and "Aurora"; the 3D mountain, camp, globe and terrain stay | Alvaro |
| 2026-10-14 | Style changed again to match Google I/O 2026 (black default, white optional, Google Sans); team sections lead with an AI assistant that only drafts — nothing is saved without the person tapping "Add it"; tools move into a Tools panel | Alvaro |
| 2026-10-14 | Every page uses the home look (dark glass, orange). Tools live inside each section on the right, task board is one of the tools, section assistant is a bubble pop-up. Base camp is no longer light. "Active" on the Team page = did something on 3+ days in the last 30 (1–2 = somewhat); login times can't be read safely so dashboard activity is used instead | Alvaro |
| 2026-10-14 | Final look follows Alvaro's reference pictures (home: dark photo + ask box; finance: total + methods + flow; marketing: map + AI panel; base camp: light glass + 3D scene; sidebar: folding groups). Base camp was light glass (replaced the same day, see above) | Alvaro |
| 2026-10-21 | Idea lab judges ideas exactly as written (no swapping in a better idea), fatal flaws (demand, margin or path to €30K ≤ 3/10, or no sense as written) cap the score at 44 = Not recommended, and the LLM Council (5 advisors → anonymous review → chairman, from Alvaro's council method) runs on every idea and can only make the verdict harsher. Tested: "selling lemons to investors" 74 → 10/100 | Alvaro |
| 2026-10-21 | Scout stays €0: OpenStreetMap + verified web search (+ Overture via the Open Places API free plan when a key is added; it stops at 10,000 searches/month, never bills). Every place and link must come from real data — nothing the AI can't back with a search result is kept | Alvaro |
| 2026-10-21 | Scout's free AI limit: members can opt in to lend their Groq key to Scout (max 60% of its daily allowance), plus a free Mistral key as last resort; the final score never drops to a weaker model | Alvaro |
| 2026-10-21 | My Projects reuse Finance's projects; only leaders create projects and add people (Finance can still edit budget/status and tag sales); project content is private to members + leaders | Alvaro |
| 2026-10-21 | Company documents are managed by leaders in Team Leader and read by everyone on their own profile; My folder is private even from admins; 25 MB per file in the free 1 GB | Alvaro |
| 2026-10-21 | Google Calendar is connected with each person's secret iCal link, not Google sign-in (sign-in needs Google's review of calendar access or hand-added test users). Read only, private to each person | Alvaro |
| 2026-10-15 | Dark theme only — the light theme option was removed at Alvaro's request; everyone sees the dark glass look. | Alvaro |
| 2026-10-18 | Team Contract signed by all 15 members (by Stefan): group membership, €3 late fines, Mon–Fri attendance, 24h replies | Team |
| 2026-10-21 | Leadership team: Alvaro Team Leader, Rocco Finance Leader, Stefan Communications Leader, Mario Customer Leader, Nahuel Marketing Leader | Team |
| 2026-10-21 | Dashboard: all 15 members put in their Team Contract groups; group leaders carry the title and their own group's rights only — company-wide leader powers (company documents, assigning tasks to everyone, leaders' meetings, managing people) stay with the Liderazgo group and with Stefan, who is an admin with the same access as Alvaro | Alvaro |
| 2026-10-21 | Design reference pictures and the Obsidian vault are now kept in the repo so every teammate's Claude builds from the same look | Alvaro |
| 2026-10-21 | Added the 11 Replica skills to `.claude/skills/` so everyone's Claude can clone an existing app's features (never its code, brand or content) and fix what its users complain about | Alvaro |

## 10. Open questions

- Remove the `[DEMO]` class data from the live database once the presentation is done (`dashboard/supabase/demo/remove-all-demo-data.sql`). (Alvaro)

- Scout: who may run searches (now Customer + Marketing + admins)? Daily search limit per member? Ever enable Google Places (free cap, but needs a billing card)?
- Grok bot has full admin (can edit/delete finance, members, leaders-only meetings, and the team's data goes to an outside AI service): confirm the team is OK with this, or downgrade it to view-only.

- **Finance Bookkeeper permissions:** the Bookkeeper section is open to the whole Finance group + admins for now. Restricting it to the Financial leader and Bookkeeper roles is a later step with its own tests (`TODO(permissions)` in code).
- **Google connection:** needed for the Meeting log archive and the emet Books sheet (see `dashboard/FINANCE_SHEET_SETUP.md`).
- **First project names** for the Finance tab.

- [x] ~~Confirm deadline~~ → June 2027
- [ ] What exactly is emet selling? (brainstorm week of 19 Oct 2026)
- [x] ~~Who are the group leaders?~~ → Alvaro, Rocco, Stefan, Mario (section 4). Individual roles inside groups are still open
- [ ] Domain: start on the free hosting subdomain; buy a custom domain later if the team agrees to spend
- [x] ~~Names of all 15 members~~ → section 5
- [ ] Emails of all 15 members (for dashboard logins)
- [ ] Who creates the free Supabase project and Vercel account for the dashboard (needed before it can go live)
- [ ] Missing self-reviews (Nico, Nahuel), Fran's redo, and missing peer reviews — see `docs/team-profiles.md`
- [x] ~~Trello: built-in boards or Trello?~~ → built-in boards; any group can link its board to Trello later (off by default)
- [ ] Vercel Hobby is for non-commercial use — fine for a student non-profit; revisit if emet starts trading as a business

---

## How to contribute

This is a **shared repo** — several people (and their Claudes) push here. To keep it clean:

1. **Pull before you start:** `git pull` so you don't overwrite someone else's work.
2. **Update this README in the same commit** as any change: new system → section 8; decision → section 9; answered question → tick it in section 10.
3. **Add a line to [`CHANGELOG.md`](CHANGELOG.md)** with date, your name, and what changed.
4. **Show the diff to your human before pushing.** Never push without their OK.
5. **Don't delete or rewrite other people's sections** without asking them. Add, don't replace.
6. **Free only:** don't add anything that costs money (paid APIs, paid plans) without a team decision logged in section 9.
7. Put long specs and docs in `docs/`, code in its own folder (e.g. `dashboard/`), and link them from this README.
