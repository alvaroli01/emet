# emet HQ — team dashboard

The live team dashboard for emet. Spec: [`../docs/dashboard-build-prompt.md`](../docs/dashboard-build-prompt.md).

**Costs €0.** Everything runs on free plans: **Supabase** (database + logins), **Vercel Hobby** (hosting), and optionally the **Trello** API.

---

## What it does

| Page | What's there |
|---|---|
| **Overview** | Revenue and profit vs €30K / €15K (rings), countdown to 30 June 2027 with pace so far vs pace needed, margin vs 50%, on-time task rate vs 85%, weekly and running-total charts, a health card per group, blockers, live activity feed |
| **General board** | Company-wide Trello-style board. Anyone can add cards; you edit cards you created or are assigned to |
| **5 group tabs** | Members, KPI cards (targets editable by the group), the group's own task board, the group's tools, blockers |
| **My Tasks** | Every card assigned to you on all 6 boards, overdue first |
| **Team** | All members. Team leaders invite people, set groups and roles, remove access |

**Group tools**

- 💰 **Finance:** sales and expenses ledgers (with a "logged within 24h?" check), stock list with margins, totals, one-click Friday profit report to paste in the chat.
- 🤝 **Customer:** revenue per sales rep vs personal target, prospects pipeline (new → contacted → interested → won/lost) with 20-per-rep weekly goal, complaints with a 48h timer.
- 📣 **Marketing:** content calendar, campaigns, weekly follower counts with growth chart, design request queue with 48h timer (anyone can ask), product and price tests.
- 🗂️ **Communications:** Friday scorecard (every KPI vs target, filled in automatically, one-click copy), decision log, weekly morale check (anonymous average; comments only for Communications and team leaders).
- 👑 **Team Leader:** on-time rate per group, every group's blockers, leaders' meeting notes, school and upperclassmen outreach.

**Everywhere:** updates appear for everyone instantly. There are 7 languages (each person's choice is saved), light and dark mode, and it works on phones.

## Who can do what

The **database** enforces these rules, not just the screens, so they hold even if someone tries to get around the app.

| Who | Can see | Can change |
|---|---|---|
| Any member | Everything (except other people's morale comments) | Their own group's data and board; cards they created or are assigned to on the general board; their own name, photo and language. Anyone can comment on any card and request a design |
| Team Leader group, or anyone marked admin | Everything | Everything, including invites, groups, roles and Trello sync |
| Not logged in | Nothing | Nothing |

- **Invite only.** Logging in works only for emails a team leader added first.
- Changing someone's group changes their rights immediately.
- **Alvaro starts as admin** so someone can invite the others. Once Team Leaders are chosen they're admins automatically. Untick Alvaro's "Admin" box if it's no longer needed.

---

## Put it online — step by step (about 30 minutes, no coding)

You need a GitHub account with access to this repo. Do the steps on a computer.

### 1. Create the database (Supabase, free)

1. Go to **[supabase.com](https://supabase.com)** → **Start your project** → sign in with GitHub. No card needed.
2. **New project** → name `emet-hq`, make up a strong database password (save it somewhere), region **Central EU (Frankfurt)** → **Create**. Wait about 2 minutes.
3. Open **SQL Editor** (left menu) → **New query**. For each file below, open it on GitHub, copy everything, paste, click **Run**. Go **in this order**:
   1. `dashboard/supabase/migrations/0001_schema.sql`
   2. `dashboard/supabase/migrations/0002_security.sql`
   3. `dashboard/supabase/migrations/0003_activity_realtime.sql`
   4. `dashboard/supabase/migrations/0004_auto_timestamps.sql`
   5. `dashboard/supabase/migrations/0005_locale_optional.sql`
   6. `dashboard/supabase/migrations/0006_trello.sql`
   7. `dashboard/supabase/seed.sql` (adds the 5 groups, 6 boards, 15 members and KPI targets)

   Each should say *Success*.
4. **Put in real emails.** Still in SQL Editor, run one line per person (first names are already there):
   ```sql
   update profiles set email = 'alvaro@example.com' where full_name = 'Alvaro';
   update profiles set email = 'stefan@example.com' where full_name = 'Stefan';
   -- …one line for each of the 15
   ```
   At minimum, set **your own** email now. You can do everyone else's later from the Team page.
5. **Make it invite-only:** **Authentication → Sign In / Providers → Email** → turn **off** *"Allow new users to sign up"* → Save.
6. **Copy three keys** from **Project Settings → API** (keep the tab open):
   - *Project URL*
   - *anon public* key
   - *service_role* key (**secret**: never share it or put it in GitHub)

### 2. Put the website online (Vercel, free)

1. Go to **[vercel.com](https://vercel.com)** → **Sign up** → **Hobby** (free) → continue with GitHub.
2. **Add New → Project** → import **`alvaroli01/emet`**.
3. **Root Directory:** click *Edit* → choose **`dashboard`**. Framework is detected as Next.js.
4. **Environment Variables** — add:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase *Project URL* |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase *anon public* key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase *service_role* key |

5. **Deploy**. After about 2 minutes you get a link like `https://emet-xxxx.vercel.app`. You can rename it under **Settings → Domains** (e.g. `emet-hq.vercel.app`).

### 3. Connect the two

In Supabase:

1. **Authentication → URL Configuration**
   - *Site URL*: your Vercel link, e.g. `https://emet-hq.vercel.app`
   - *Redirect URLs*: add `https://emet-hq.vercel.app/**`
2. **Authentication → Email Templates**. In each template, replace the link `{{ .ConfirmationURL }}` with the line shown:
   - **Invite user:** `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`
   - **Magic link:** `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink`
   - **Reset password:** `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`

### 4. Log in and invite the team

1. Supabase → **Authentication → Users → Invite user** → your own email. Open the email → choose a password. You're in. 🎉
2. In the dashboard → **Team** → for each person: ✏️ set their real email (and group/role once decided) → **Invite**. They get an email, choose a password, and they're in.

> **Free-plan limits worth knowing**
> - Supabase's built-in email sends only a few emails per hour. Invite people in small batches, or ask them to use "Email link" on the login page later.
> - A Supabase free project **pauses after 7 days with nobody using it**. If the dashboard stops loading: Supabase → your project → **Restore project**. Daily use keeps it awake.
> - Vercel Hobby is for non-commercial use. A student non-profit team fits; check again if emet starts operating as a business.

### Later (optional)

- **Custom domain:** Vercel → Settings → Domains → add it, then update the Supabase *Site URL* and *Redirect URLs*. A domain costs money, so it needs a team decision first.
- **Trello sync:** see [`TRELLO_SETUP.md`](TRELLO_SETUP.md). Off by default.

---

## For whoever maintains the code

```bash
cp .env.example .env.local   # fill in the values
npm install
npm run dev                  # http://localhost:3000
npm test                     # calculation tests (pace, profit, on-time rate, KPIs)
npm run test:db              # 55 permission tests on a local Postgres 15+ — no Supabase needed
npm run check:i18n           # all 7 translation files have every text, same placeholders
```

- **Stack:** Next.js 15 (App Router) + TypeScript + Tailwind 4, Supabase (`@supabase/ssr`), next-intl, dnd-kit, Recharts, lucide-react.
- **Translations:** `messages/{en,es,de,fr,fi,pt-BR,ru}.json`. Add a text to `en.json` and all 6 others, then run `npm run check:i18n`. No text is hard-coded in components.
- **Permissions** live in `supabase/migrations/0002_security.sql`. If you add a table, add its policies there (or in a new migration) and a test in `supabase/tests/permissions_test.sql`.
- **New database changes** go in a new numbered file in `supabase/migrations/`. Never edit one that has already been run on the live project.
- Chart colours come from a palette checked for colour-blind readers in light and dark mode. Statuses always show an icon and a word, never colour alone.
