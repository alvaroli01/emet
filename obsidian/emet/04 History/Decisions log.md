---
tags: [emet, decisions]
updated: 2026-10-23
---

# Decisions log (synced from README §9, 2026-10-23)

| Date | Decision | Decided by |
|---|---|---|
| [[2026-10-23]] | Finance subscriptions book themselves as expenses (daily job, no login needed); deleting one keeps past charges. Team tasks can require a file to finish (enforced in the database) | Alvaro |
| [[2026-10-23]] | Daily pop-up with your tasks (late + next 30 days) on the first visit of the day; training leaders change every week (Mon–Sun) up to 19 Dec, first week 26 Oct = Mario & Rocco, the rest to be decided by Alvaro | Alvaro |
| [[2026-10-22]] | Notion is connected per member (their own uni or personal Notion, by OAuth), never shared; emet stores no Notion content, only encrypted tokens and which page/database each person picked | Alvaro |
| [[2026-10-22]] | Leire (the team's coach / teacher) joins as **Coach**: no group, sees everything, can add tasks on any team board and assign people, and edit only her own tasks. Only admins can make someone a coach | Alvaro |
| [[2026-10-22]] | New project: Chinese culture event in Bilbao on Wed 25 Nov 2026 with visiting students from a Chinese university (they bring products from China). Joint project with Olin (the other 15-person LEINN team in our class of 30) — emet: Alvaro, Mario, Nico; Olin: Andres, Eduardo, Gordon, Nico Yarnoz. Plan in the vault: `obsidian/emet/01 Company/Chinese event (25 Nov).md` | Alvaro |
| [[2026-10-22]] | Getting a task shows a live pop-up (title + due date) on whatever page you're on; Today's Sales / Tasks / Money cards can show any week or month | Alvaro |
| [[2026-10-21]] | Idea lab judges ideas exactly as written (no swapping in a better idea), fatal flaws (demand, margin or path to €30K ≤ 3/10, or no sense as written) cap the score at 44 = Not recommended, and the LLM Council (5 advisors → anonymous review → chairman, from Alvaro's council method) runs on every idea and can only make the verdict harsher. Tested: "selling lemons to investors" 74 → 10/100 | Alvaro |
| [[2026-10-21]] | Scout stays €0: OpenStreetMap + verified web search (+ Overture via the Open Places API free plan when a key is added; it stops at 10,000 searches/month, never bills). Every place and link must come from real data — nothing the AI can't back with a search result is kept | Alvaro |
| [[2026-10-21]] | Scout's free AI limit: members can opt in to lend their Groq key to Scout (max 60% of its daily allowance), plus a free Mistral key as last resort; the final score never drops to a weaker model | Alvaro |
| [[2026-10-21]] | My Projects reuse Finance's projects; only leaders create projects and add people (Finance can still edit budget/status and tag sales); project content is private to members + leaders | Alvaro |
| [[2026-10-21]] | Company documents are managed by leaders in Team Leader and read by everyone on their own profile; My folder is private even from admins; 25 MB per file in the free 1 GB | Alvaro |
| [[2026-10-21]] | Google Calendar is connected with each person's secret iCal link, not Google sign-in (sign-in needs Google's review of calendar access or hand-added test users). Read only, private to each person | Alvaro |
| [[2026-10-21]] | Leadership team: Alvaro Team Leader, Rocco Finance Leader, Stefan Communications Leader, Mario Customer Leader, Nahuel Marketing Leader | Team |
| [[2026-10-21]] | Dashboard: all 15 members put in their Team Contract groups; group leaders carry the title and their own group's rights only — company-wide leader powers (company documents, assigning tasks to everyone, leaders' meetings, managing people) stay with the Liderazgo group and with Stefan, who is an admin with the same access as Alvaro | Alvaro |
| [[2026-10-21]] | Design reference pictures and the Obsidian vault are now kept in the repo so every teammate's Claude builds from the same look | Alvaro |
| [[2026-10-21]] | Added the 11 Replica skills to `.claude/skills/` so everyone's Claude can clone an existing app's features (never its code, brand or content) and fix what its users complain about | Alvaro |
| 2026-10-18 | Team Contract signed by all 15 members (by Stefan): group membership, €3 late fines, Mon–Fri attendance, 24h replies | Team |
| [[2026-10-15]] | Dark theme only — the light theme option was removed at Alvaro's request; everyone sees the dark glass look. | Alvaro |
| [[2026-10-14]] | Claude Code skills live in the repo (`.claude/skills/`) so every teammate's Claude uses the same ones | Alvaro |
| [[2026-10-14]] | Dashboard look = "Summit": €30K is a mountain summit, a base camp every €5K; one interactive 3D mountain (Overview + login), clean 2D everywhere else | Alvaro |
| [[2026-10-14]] | Dashboard put online on free plans: Supabase project `emet` (Frankfurt) + Vercel Hobby at emet-hq.vercel.app; public sign-up off | Alvaro |
| [[2026-10-14]] | Every member gets a private Base camp; nobody else (admins included) can read it. Shared team passwords belong in a shared manager like Bitwarden, not personal vaults | Alvaro |
| [[2026-10-14]] | Note-taker will use Groq's free tier (Whisper) with automatic fallback to the browser's speech recognition; Spanish + English | Alvaro |
| [[2026-10-14]] | Each member uses their own free Groq account for the note-taker, so everyone has their own daily allowance | Alvaro |
| [[2026-10-14]] | Weekly encrypted database backups in a private GitHub repo; recordings' audio kept 60 days, transcripts forever | Alvaro |
| [[2026-10-14]] | Stefan added as a second admin | Alvaro |
| [[2026-10-14]] | Meeting log: team meetings are recorded and shared with everyone; leaders’ meetings only with leaders; only the author or an admin can delete one | Alvaro |
| [[2026-10-14]] | North star for emet HQ: the team works inside it daily; every feature must save time. Approved roadmap ideas 2, 4, 5, 6, 7, 8, 9, 10 | Alvaro |
| [[2026-10-14]] | Business idea not decided yet; ideas go through the Idea lab (AI research + score + team votes). Instagram account and products to come; phone app postponed | Alvaro |
| [[2026-10-14]] | Marketing measures itself against its own numbers: a “hit” is a post with ≥ 2× our 30-day median views; posts only count when tagged from the shared glossary; every sale asks “how did you hear about us?” (it decides stall/word-of-mouth, codes and links decide online) | Alvaro |
| [[2026-10-14]] | Scout uses only free, legal sources (OpenStreetMap, web search, the business's own site); no Google Maps scraping; Google Places stays off unless the team agrees (needs a billing card). Outreach advice avoids cold email (Spanish LSSI) | Alvaro |
| [[2026-10-14]] | A Grok bot account (gert@mail.grokbot.com) was added with full admin rights at Alvaro's request, so it can learn the dashboard. Martin added as view-only member | Alvaro |
| [[2026-10-14]] | Dashboard redesign: keep the Summit identity (mountain, base camp, map palette), add a personal hero with one 3D/interactive visual to every section, group tabs into categories, use Magic UI for motion components | Alvaro |
| [[2026-10-14]] | Visual style changed to "Studio" (bento tiles, iris accent, team colours, Onest font) chosen by Alvaro over "Night Ops" and "Aurora"; the 3D mountain, camp, globe and terrain stay | Alvaro |
| [[2026-10-14]] | Style changed again to match Google I/O 2026 (black default, white optional, Google Sans); team sections lead with an AI assistant that only drafts — nothing is saved without the person tapping "Add it"; tools move into a Tools panel | Alvaro |
| [[2026-10-14]] | Every page uses the home look (dark glass, orange). Tools live inside each section on the right, task board is one of the tools, section assistant is a bubble pop-up. Base camp is no longer light. "Active" on the Team page = did something on 3+ days in the last 30 (1–2 = somewhat); login times can't be read safely so dashboard activity is used instead | Alvaro |
| [[2026-10-14]] | Final look follows Alvaro's reference pictures (home: dark photo + ask box; finance: total + methods + flow; marketing: map + AI panel; base camp: light glass + 3D scene; sidebar: folding groups). Base camp was light glass (replaced the same day, see above) | Alvaro |
| [[2026-10-13]] | Repo created as the shared source of truth; every change also updates this README | Alvaro |
| [[2026-10-13]] | Team split into 5 groups / 15 roles (section 4) — names not assigned yet | Team |
| [[2026-10-13]] | Build one shared dashboard with personal logins, per-group edit rights and view-all for everyone | Alvaro |
| [[2026-10-13]] | Deadline set to June 2027; no fixed weekly revenue pace | Alvaro |
| [[2026-10-13]] | €0 tool budget for now — free plans only | Alvaro |
| [[2026-10-13]] | Dashboard in English, Spanish, German, French, Finnish, Portuguese (Brazil), Russian | Alvaro |
| [[2026-10-13]] | 6 task boards: 1 general company board + 1 per group | Alvaro |
| [[2026-10-13]] | Preliminary team profiles (self + peer reviews) added as a quick reference, not final roles | Alvaro |
| [[2026-10-13]] | Dashboard built step by step in `dashboard/` (7 steps); step 1 = database, login, permissions | Alvaro |
| [[2026-10-13]] | Dashboard is invite-only: a login only works for emails an admin added; members start with no group/role | Alvaro |
| [[2026-10-13]] | Alvaro is the starting dashboard admin until Team Leaders are chosen (Team Leader group = admins) | Alvaro |
| [[2026-10-13]] | Any member can comment on any card and request a design from Marketing; editing stays group-only | Alvaro |
| [[2026-10-13]] | Overview: profit = sales − cost of goods − expenses; a task is on time if it reaches Done by its due date | Alvaro |
| [[2026-10-13]] | Dashboard finished (steps 3–7): 6 task boards, group tools, Team management, 7 languages, optional Trello sync, dark mode | Alvaro |
| [[2026-10-13]] | Morale comments are private to Communications + team leaders; everyone sees the anonymous weekly average | Alvaro |
| [[2026-10-13]] | Anyone can request a design from Marketing; only Marketing works the queue | Alvaro |

Back to [[Timeline]]
