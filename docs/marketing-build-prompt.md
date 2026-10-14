# emet HQ — Marketing section build prompt

> Status: **draft for review** (2026-10-14). Based on the research report
> [`docs/reports/Marketing ops for student startup.md`](reports/Marketing%20ops%20for%20student%20startup.md).
> Change anything below, then paste everything under the line into Claude Code inside this repo.

---

You are extending **emet HQ** (`dashboard/`, Next.js 15 + Supabase + Vercel Hobby, €0). Read `README.md`, `CLAUDE.md`,
`dashboard/PRODUCT.md` and the research report above first. Today the Marketing tab has 4 simple tools (content calendar,
campaigns + product tests, follower counts, design requests). Replace them with a **deep Marketing section** that the 5 marketers
work in every day and that tells the whole team, at a glance, **what is working and what to do more of**.

## 0. Rules (from the research — do not drift)

- **€0.** No paid tools (no Shopify, Motion, Foreplay, Dub/Bitly paid, Fairing). Free APIs and our own code only.
- **The dashboard is where the work happens.** Every screen must remove a step, a chat message or a spreadsheet.
  Logging anything takes ≤ 3 taps on a phone. Automate what can be automated (Instagram sync, redirects, reports).
- **Data must be right.** One definition per metric (written in the UI as a tooltip), one owner per input, required fields
  at the moment of entry, and a visible **data-quality** indicator (e.g. "3 posts missing 7-day numbers").
- **2D for anything people read precisely or act on**; 3D only as an overview that opens exact 2D numbers on tap
  (research: Cleveland & McGill, Munzner "no unjustified 3D"). One 3D scene per phone screen, static fallback, reduced motion.
- Status colours: never colour alone — icon + word, blue/orange-safe palette (existing tokens).
- Everything in the 7 languages; permissions enforced in the database with tests (Marketing edits, everyone views).

## 1. What we measure (definitions shown in the app)

**North Star:** contribution profit vs the €15K pacing line (≈ €405/week; revenue ≈ €810/week from zero).

| Layer | Metric | Definition | Source |
|---|---|---|---|
| Output | Revenue & orders **by channel** | sum of orders grouped by attributed channel | orders log |
| Output | AOV · margin % | revenue ÷ orders · (revenue − COGS) ÷ revenue | orders + inventory |
| Output | Repeat purchase rate | customers with ≥2 orders ÷ customers | orders (customer handle/email) |
| Input | Posts shipped / week | posts with status *posted* | content log |
| Input | **Hit rate** | posts whose 7-day views ≥ 2× the account's trailing 30-day median ÷ posts | content log + Instagram sync |
| Input | **Share+save rate** | (shares + saves) ÷ reach, per post | Instagram sync / manual for TikTok |
| Input | Inquiry → order rate | DM/comment inquiries that became orders ÷ inquiries | inquiries log |
| Input | Revenue per stall-hour | stall revenue ÷ hours open | stall log |
| Guardrail | MER (only once anything is paid) | revenue ÷ marketing spend; break-even = 1 ÷ margin% (≈ 2.0) | expenses tagged *marketing* |

**Do not show as goals:** follower count, industry engagement benchmarks (they disagree from 0.36% to 5%), ROAS,
multi-touch attribution, LTV projections. Compare every post to **our own median**, not to the internet.

## 2. Attribution at €0 (three signals, one rule)

1. **UTM links** with a fixed `utm_source` list (instagram, tiktok, whatsapp, stall, ambassador, other).
2. **One discount code per channel / stall / ambassador** (managed in the app; shows usage).
3. **Required "How did you hear about us?" dropdown on every order** (web, DM and stall alike).
- Rule: the survey answer decides stall and word-of-mouth sales; codes/UTMs decide online sales.
  Show the **disagreement rate** so the team sees how trustworthy attribution is.
- Build our own **`/go/[slug]` short links** (bio link, campaign links, stall QR codes) that log every click in Supabase
  and append UTMs — replaces Linktree/Bitly. Generate printable QR codes for stalls in the app.

## 3. Data sources

| Source | How | Notes |
|---|---|---|
| **Instagram** (Business/Creator account) | **API, automatic** — Instagram API with Instagram Login, own account → Standard Access, no App Review | Daily cron snapshot per post (views, reach, saved, shares, follows, profile_visits, total_interactions, reel watch time); Stories captured within 24 h; long-lived token refreshed every ~50 days; use `views` (impressions/plays removed Apr 2025); follower demographics only ≥100 followers |
| TikTok | **Manual quick-log** (+ optional Display API public counts later) | Research API closed to commercial teams; Business organic API unverified |
| Orders | In-app order form (stall/DM) now; **Stripe Payment Links + webhook** when selling online | Stripe EEA 1.5% + €0.25, no monthly fee; promo code per channel |
| Clicks & QR | Own `/go/[slug]` redirect | free, unlimited |
| Competitors | Weekly manual swipe log (Meta Ad Library / TikTok Creative Center links) | API needs ID verification; not worth it yet |
| GA4 | Later, once a website has traffic | Data API free quota is ample |

## 4. Data model (new/changed tables; RLS: everyone reads, Marketing + admins write)

- `content_items` (replaces `content_posts`): platform, format (reel/carousel/story/tiktok/static), title, caption, permalink,
  thumbnail_url, product, campaign_id, brief_id, **6 required tags** (product, format, hook_visual, hook_message, audience, channel —
  values from `tag_glossary`), planned_for, posted_at, owner, status (idea → briefed → in production → scheduled → posted),
  **decision** (scale / iterate / kill) + why, external_id (IG media id).
- `content_metrics`: content_id, captured_at, age_hours (24/48/168 snapshots), views, reach, likes, comments, saves, shares,
  follows, profile_visits, link_clicks, watch_time — filled by the Instagram sync or the TikTok quick-log.
- `tag_glossary`: tag type, value, description (owned by the editor & designer; only glossary values allowed).
- `briefs`: one-page brief — goal, audience, **hypothesis**, key message + reason to believe, **2–3 hook variants**,
  customer quote (researcher), deliverables (format, channel, specs, owner, due), references, DACI (driver, **single approver =
  marketing leader**, contributors, informed), status. A brief creates its content items and cards in one click.
- `campaigns` (extend): objective, product, dates, budget (default 0), target metric + target, linked briefs/content,
  **post-mortem** (summary, goal vs actual, what worked, what didn't, root cause, decisions, actions) auto-prefilled with numbers.
- `go_links` + `go_clicks`: slug, destination, utm fields, campaign/content/stall link; click log (time, referrer, device class).
- `discount_codes`: code, channel/stall/ambassador, active; usage computed from orders.
- `orders` (extend `sales`): channel (attributed), heard_about (required), code, utm_source, customer handle, items.
- `inquiries`: platform, handle, product, date, converted_order_id (social media manager logs DMs in 2 taps).
- `stall_sessions`: place, date, opened/closed time, staff, notes → revenue per stall-hour from linked orders.
- `swipe_file`: competitor/inspiration links with the same tags (flag `is_competitor`).
- Keep `design_requests` (48 h timer) and `follower_snapshots` (now auto-filled by the IG sync).

## 5. Screens (Marketing tab → sub-tabs; phone-first)

1. **Pulse** (default) — the weekly scorecard in a fixed order (Amazon WBR style): North Star bullet graph vs pacing line,
   revenue by channel (sorted horizontal bars), the 4 inputs as KPI cards with sparkline + one-line "what changed" note,
   data-quality indicator, and **"Do more of / Stop doing"** auto-picked from the Library (top tags by hit rate this month).
2. **Content** — calendar + pipeline (idea → posted) with drag-and-drop; tap a post to log/see numbers; **creative
   leaderboard** (thumbnail grid ranked by share+save rate or views vs median, winner badges); filters by tag.
   Optional **3D content landscape**: each post a peak (height = views vs median, colour = format), tap → exact 2D card.
3. **Campaigns & briefs** — briefs board (draft → approved → in production → live → reviewed); campaign page with linked
   content, results vs target, and the post-mortem (prefilled; leader completes it).
4. **Library — what works** — the content log filtered to *scale* decisions, grouped by tag ("hooks with a question beat
   statements 2.1× on reels"), with the evidence (posts, dates, numbers) one tap away. Every new brief shows the relevant
   winners for its product and channel. This is the team's memory for future projects.
5. **Attribution** — channel mix, codes & go-links performance, survey vs code agreement, funnel
   (views → profile visits → link clicks → inquiries → orders) as a horizontal stepped funnel with the biggest drop highlighted.
6. **Experiments** — hypothesis → test → result → decision, results shown against zero with plain verdicts
   ("clearly better / unclear / worse") and the note that organic results are directional, not significant.
7. **My scorecard** — each role sees only the numbers it can move:
   leader (approvals waiting, campaign results, post-mortems due) · social media manager (posts shipped, hit rate, inquiries,
   response time) · content creator (pieces delivered, hit rate of own pieces) · editor & designer (design queue 48 h SLA,
   glossary health) · market researcher (customer quotes added, swipe entries, product tests).

## 6. Rituals built into the app

- **Monday 30-min review mode**: full-screen walk-through of Pulse in fixed order, ending in 3 decisions saved to the decision log.
- **Monthly 60-min retro**: prompts post-mortems for finished campaigns and promotes winners to the Library.
- DACI on briefs: the leader is the only approver; contributors comment; informed get a notification.

## 7. Acceptance criteria

- A post can be planned, briefed, published and measured without leaving the app; Instagram numbers appear automatically
  within 24 h of posting; TikTok numbers take ≤ 3 taps.
- Every order has a channel and a "heard about" answer (database constraint), every content item has the 6 tags.
- Pulse loads in < 1 s on a phone (precomputed weekly aggregates), works in all 7 languages and in dark mode.
- Permission tests: non-marketing members can view everything but not edit; tokens and secrets never reach the browser.
- Tests for every metric formula (hit rate, median, share+save rate, MER, pacing).

## 8. Build order

1. Data model + migrations + permission tests; migrate existing content/campaign rows.
2. Orders attribution (channel + heard-about + codes) and `/go/` links with QR codes.
3. Content pipeline + quick-log + tags/glossary.
4. Instagram sync (connect flow for the Marketing leader, daily cron, token refresh).
5. Pulse + My scorecard.
6. Briefs + campaigns + post-mortems.
7. Library + experiments + attribution views; 3D content landscape last.

## Open questions for the team

- Which Instagram account (needs to be Business/Creator) and who owns the login?
- Products and prices list (needed for orders and codes).
- Will there be a website/online checkout this year, or only DMs + stalls?
