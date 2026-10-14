# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The 15 members of emet, a student non-profit team in the LEINN Internacional university programme. They are split into 5 groups (Team Leader, Finance, Customer, Marketing, Communications); roles and leaders are not decided yet. They speak 7 languages (English, Spanish, German, French, Finnish, Portuguese (Brazil), Russian), use it mostly on their phones, between classes and during team meetings, and none of them should need training: a new member must understand it in 30 seconds.

## Product Purpose

emet HQ is the team's single shared place to run the company: see progress toward **€30,000 revenue and €15,000 profit by June 2027** (50% minimum margin), work the task boards, log sales and expenses, and run the weekly rituals. Success means every member opens it daily, trusts the numbers, and knows what to do next without asking.

## Positioning

One live screen the whole team shares: every sale, task move and blocker appears for everyone instantly, and each person can only change their own group's work. It replaces scattered chats, spreadsheets and a Trello free plan that can't hold 15 people.

## Operating Context

- Daily: group check-ins, moving cards, logging a sale or expense within 24h.
- Weekly: leaders' meeting, morale check.
- Friday: profit report (Finance) and scorecard of every KPI vs target (Communications), both copied into the team chat.
- Shared on a big screen in team meetings as well as on phones.

## Capabilities and Constraints

- Already built: Overview (goal progress, countdown and pace, margin, on-time rate, charts, group health, blockers, live activity), a general board plus one board per group (drag and drop, assignees, due dates, labels, checklists, comments), group tools, My Tasks, Team management, optional Trello sync, light/dark mode.
- Permissions are enforced in the database: everyone views everything, each person edits only their group's data; Team Leader group = admins. Read-only areas show no edit controls.
- Stack: Next.js 15, Tailwind 4, Supabase (database, auth, realtime), Vercel Hobby. **€0 budget**: free libraries, fonts and services only.
- All text in 7 locale files; long German/Finnish/Russian words must not break layouts.
- Undecided: what emet sells (brainstorm week of 19 Oct 2026), roles, leaders, member emails.

## Brand Commitments

- Name: **emet** / **emet HQ**.
- Each group keeps an identity colour and emoji used consistently: General 🏢, Team Leader 👑, Finance 💰, Customer 🤝, Marketing 📣, Communications 🗂️.
- Status colours: green = on track, amber = at risk, red = behind, always with an icon and a word, never colour alone.
- Requested by Alvaro (2026-10-14): simple to understand, very interactive, must not look AI-generated ("vibe coded"), with one signature 3D element on Overview and a 3D login, and real depth elsewhere.

## Evidence on Hand

Seed data only: 15 first names, 5 groups, 6 boards, KPI targets. No real sales, products, logo or photos exist yet; never invent revenue, customers or products in the UI.

## Product Principles

1. The goal is the heartbeat: every screen ties back to €30K / €15K by June 2027.
2. Next action over decoration: anyone knows in seconds what they should do today.
3. Live and trustworthy: numbers update for everyone instantly and match the ledger exactly.
4. Your group, everyone's view: edit what's yours, see everything.
5. Phone first, meeting-screen second.

## Accessibility & Inclusion

7 languages, colour-blind-safe status and charts, readable on phones in daylight, keyboard usable, respects reduced motion (the 3D must have a still fallback).
