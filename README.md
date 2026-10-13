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

Roles and leaders have **not been chosen yet** (decision expected in the coming days). The structure below is the plan; names go in section 5.

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
| Alvaro | _TBD_ | _TBD_ | — |
| Stefan | _TBD_ | _TBD_ | — |
| Rocco | _TBD_ | _TBD_ | — |
| Fran | _TBD_ | _TBD_ | — |
| Zayd | _TBD_ | _TBD_ | — |
| Nico | _TBD_ | _TBD_ | — |
| Nahuel | _TBD_ | _TBD_ | — |
| Emily | _TBD_ | _TBD_ | — |
| Elizabeth | _TBD_ | _TBD_ | — |
| Lassi | _TBD_ | _TBD_ | — |
| Mario | _TBD_ | _TBD_ | — |
| Martin | _TBD_ | _TBD_ | — |
| Fernando | _TBD_ | _TBD_ | — |
| Sasha | _TBD_ | _TBD_ | — |
| Mirage | _TBD_ | _TBD_ | — |

*(Groups and roles get filled in once the team decides.)*

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
| Team dashboard (web app, personal logins, per-group permissions, task boards) | 🚧 Step 1 of 7 done: database, invite-only login, permissions (47 tests passing), app shell. Not deployed yet | Code: [`dashboard/`](dashboard/) · Spec: [`docs/dashboard-build-prompt.md`](docs/dashboard-build-prompt.md) | Next.js + Supabase free + Vercel Hobby; 7 languages; progress table in [`dashboard/README.md`](dashboard/README.md) |
| Task boards: 1 general company board + 1 per group (6 total) | ⏳ To create | Inside the dashboard | Trello's free plan caps a workspace at 10 members, so the 15-person general board can't be free on Trello — boards are built into the dashboard, with Trello sync ready for later |

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

## 10. Open questions

- [x] ~~Confirm deadline~~ → June 2027
- [ ] What exactly is emet selling? (brainstorm week of 19 Oct 2026)
- [ ] Who are the group leaders and who has which role?
- [ ] Domain: start on the free hosting subdomain; buy a custom domain later if the team agrees to spend
- [x] ~~Names of all 15 members~~ → section 5
- [ ] Emails of all 15 members (for dashboard logins)
- [ ] Who creates the free Supabase project and Vercel account for the dashboard (needed before it can go live)
- [ ] Missing self-reviews (Nico, Nahuel), Fran's redo, and missing peer reviews — see `docs/team-profiles.md`
- [ ] Trello: use the dashboard's built-in boards for now, or split across several free Trello workspaces?

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
