# emet

> **For Claude (and humans) reading this repo:** this README is the single source of truth for what emet is, what we're aiming for, who does what, and which systems exist. Read it fully before doing any work. If you change anything in this repo, update this README in the same commit (see [How to contribute](#how-to-contribute)).

---

## 1. What emet is

emet is a 15-person non-profit team that is part of **LEINN Internacional** (university programme). This repo holds every idea, dashboard, system, and decision the team builds, so that any team member's Claude can pick up the full context.

- **Repo:** https://github.com/alvaroli01/emet
- **Started:** 13 Oct 2026
- **Repo owner:** Alvaro

## 2. The goal

| Metric | Target | Pace needed |
|---|---|---|
| Revenue | **€30,000** | ~€3,000 / week |
| Profit | **€15,000** | 50% minimum margin |
| Deadline | **31 Dec 2026** ⚠️ *to confirm* | ~11 weeks from 13 Oct 2026 |

> ⚠️ **Open question:** the deadline was also mentioned as "June 2026". Since that date has already passed, the working assumption is **31 Dec 2026** (which matches the ~€3K/week pace). Update this line once confirmed.

## 3. Team structure (15 people, 5 groups)

Leaders have **not been chosen yet** (decision expected in the coming days). Names will be filled into the table in section 4.

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
| Customer leader | Hit €3K revenue every week, resolve complaints within 48h |
| Sales rep ×2 | ~€1,000 / week each, 20 new prospects / week each |

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
| Project manager | Keep the task board current, publish the Friday scorecard |
| Documentation & wellness | Record decisions, run the weekly morale check |

## 4. Who's who

| Name | Group | Role | Contact |
|---|---|---|---|
| Alvaro | _TBD_ | _TBD_ | — |
| _TBD_ | | | |

*(Fill in as roles are assigned. 15 rows total.)*

## 5. Weekly rhythm

| When | What | Owner |
|---|---|---|
| Daily | Check-ins with each group | Operations monitor |
| Within 24h of any sale/expense | Log it | Bookkeeper |
| Weekly | Leaders' meeting | Team leader |
| Weekly | Morale check | Documentation & wellness |
| Friday | Profit report | Financial leader |
| Friday | Scorecard (KPIs vs targets) | Project manager |

## 6. Systems

| System | Status | Where | Notes |
|---|---|---|---|
| Team dashboard (web app, logins, per-group permissions, Trello sync) | 📝 Spec written, not built | [`docs/dashboard-build-prompt.md`](docs/dashboard-build-prompt.md) | One Trello board per group, synced into the dashboard |
| Trello boards (1 per group) | ⏳ To create | — | Boards: Team Leader, Finance, Customer, Marketing, Communications |

## 7. Decisions log

| Date | Decision | Decided by |
|---|---|---|
| 2026-10-13 | Repo created as the shared source of truth; every change also updates this README | Alvaro |
| 2026-10-13 | Team split into 5 groups / 15 roles (section 3) | Team |
| 2026-10-13 | Build one shared dashboard with personal logins, per-group edit rights, view-all for everyone, and one Trello board per group | Alvaro |

## 8. Open questions

- [ ] Confirm deadline (31 Dec 2026 vs June 2027)
- [ ] What exactly is emet selling (product / service / channel)?
- [ ] Who are the group leaders?
- [ ] Domain name for the dashboard
- [ ] Names + emails of all 15 members

---

## How to contribute

This is a **shared repo** — several people (and their Claudes) push here. To keep it clean:

1. **Pull before you start:** `git pull` so you don't overwrite someone else's work.
2. **Update this README in the same commit** as any change: new system → section 6; decision → section 7; answered question → tick it in section 8.
3. **Add a line to [`CHANGELOG.md`](CHANGELOG.md)** with date, your name, and what changed.
4. **Show the diff to your human before pushing.** Never push without their OK.
5. **Don't delete or rewrite other people's sections** without asking them. Add, don't replace.
6. Put long specs and docs in `docs/`, code in its own folder (e.g. `dashboard/`), and link them from this README.
