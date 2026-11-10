---
tags: [emet, resource]
updated: 2026-10-22
---

# Video walkthrough prompt

Prompt to give Claude for the AI walkthrough video of emet HQ (full feature map + click paths). Overview video first, then one per section.

You are writing the script for an AI-generated walkthrough video of **emet HQ**, the team dashboard of emet (15 university students, Mondragon University, LEINN). Live at https://emet-hq.vercel.app.

## Goal of this video
One overview video (target 10–14 minutes) that shows **every feature everyone can use**, and **exactly how to get to each one** (which button, which menu, which tab). After this, we will make one short video per section, so end with that list.

## Rules
- Cover EVERY item in the feature map below, in the order given. Do not skip anything (language switching, company documents and My folder included). Do not invent features that aren't listed.
- For each feature, say the click path first ("Click your avatar, top right, then My connections"), then what it does in 1–2 plain sentences, then one example of when you'd use it.
- Mark features that only some people have with a short "(leaders only)" or "(Customer, Marketing and leaders)" note. Mention them, but keep them brief.
- Mention once, near the start, that everything also works on the phone: the bottom tab bar (Today, Board, My team, Base camp, More) replaces the left menu.
- Plain, friendly English, short sentences, no jargon. Speak to a new team member on their first day.

## Output format
1. A table of scenes with these columns: # · Section · Click path (what the viewer clicks) · What's on screen (what to record or show) · Voiceover (exact words) · On-screen text (max 8 words) · Seconds
2. The total runtime.
3. A list of the follow-up videos, one per section, each with a title, a 1-line goal and a target length.

## Feature map (everything in emet HQ)

**0. Getting in and around**
- Log in with your university Google account (or the email login link).
- Left menu groups: Workspace (Today, Overview, Base camp, My Tasks), Groups (Team Leader, Finance, Customer, Marketing, Communications), Tools (General board, Idea lab, Scout, Meeting log, Team). The menu folds and unfolds.
- Phone: bottom tab bar (Today, Board, My team, Base camp, More). More opens the full menu.
- Top bar:
  - **Search** (magnifier, or ⌘K / Ctrl+K): jump to any page, task or person.
  - **Synced** dot.
  - **Notifications** bell: new ideas, tasks, documents, projects. "Mark all read".
  - **Orange mic**: record a meeting from anywhere.
  - **Avatar menu**:
    - My profile
    - My connections
    - Language: English, Español, Deutsch, Français, Suomi, Português (Brasil), Русский
    - Log out
- **Ask emet**: the card at the bottom of the menu, and the big question box on Today. Ask anything about the team, money, tasks or your schedule ("What do I have this week?"), answered from our own data.
- **Section assistant**: the orange sparkle button, bottom right, in every team section. A chat that knows that section and can open its tools.

**1. Today** (the home page)
- Ask box ("Hey [name], need help?").
- Quick buttons:
  - Search
  - New task
  - This week's dates
  - Log a sale (Finance)
  - Weekly report
- Cards:
  - Sales this week by channel
  - Tasks done this week vs last week
  - Money in per day
  - Team health (on time, blockers)
- **Your week** calendar: your tasks, your plans and your Google Calendar events.
  - Due today
  - Google Calendar connect/status
  - Expand to full screen
  - Phone: small day buttons with a list
- Summit mountain: progress to the €30,000 goal and days left until June 2027.
- Due today, This week's priorities, Today's agenda.

**2. Overview**: the company dashboard.
- Revenue, profit, sales this week, time left.
- The day-by-day climb to €30K and the June forecast.
- Teams table (health, open, overdue, done, on time, blockers).
- People active, morale, needs attention, due in the next 7 days, money per week, what sells, latest decisions, activity.

**3. Base camp** (your personal space)
- Focus timer (today / daily goal), my open tasks (star, play), today's plans + "Plan something".
- My week: Today / Week view, with Google events.
- Activity %, where my work is, Reminders (+ Add).
- My Projects cards.
- Tabs:
  - **My week**: 3 priorities and the weekly reflection.
  - **Agenda**: plan events, and connect Google Calendar.
  - **Docs**: recordings and notes; Record and Upload an audio file (up to 90 minutes) turn into notes plus a transcript; Redo transcript.
  - **Idea wall**: personal ideas.
  - **Vault**: private encrypted passwords with your own passphrase. Nobody else can read it; it locks after 5 minutes.

**4. My Tasks**
- Every task with your name from every board: done ring, overdue, coming up, due this week.
- "From the team leader" tasks you tick off.
- Assign a task.

**5. General board** (and each section's Task board)
- Columns To do / Doing / Done: drag cards, Add card, Use a template.
- Card window: details, due date, people, checklist, comments.
- Trello sync.

**6. Team sections** (Team Leader, Finance, Customer, Marketing, Communications)
- Each opens on its **Overview**: title box, "Needs you" list, number cards.
- **Tools** button (right column; on phone a "Tools" sheet).
- Everyone can view every section. You edit in your own group.
- **Team Leader** tools:
  - Overview
  - On-time rate by group
  - Leaders' meeting notes
  - School & upperclassmen outreach
  - Task board
  - (leaders only) Assign tasks: to everyone, a team, people or a project
  - (leaders only) All projects + New project
  - (leaders only) Documents: upload company documents
- **Finance** tools:
  - Overview: total revenue, payment methods (Cash, Bizum, Card, Transfer), money in and out, spending, where money comes from, cash flow
  - Log a sale / Add expense / Close month
  - Task board
  - Stock
  - Bookkeeper: quick add sale or expense with a receipt photo, cash count, month close, bank CSV import, Google Sheet / Excel download
  - Blockers
  - Projects (money per project)
  - Ledgers: sales and expenses, filters
- **Customer** tools:
  - Overview: prospects, won, open problems, targets
  - Task board
  - Prospects pipeline
  - Complaints
  - Blockers
- **Marketing** tools:
  - Overview: conversion, analytics, social traffic, top content
  - Pulse
  - My week
  - Content (Idea → Briefed → …)
  - Briefs
  - What works
  - Attribution
  - Follower growth
  - Design requests
  - Task board
  - Blockers
- **Communications** tools:
  - Overview
  - Friday scorecard
  - Decision log
  - Morale
  - Task board
  - Blockers
- Targets (KPIs) with an edit pencil, per group.

**7. Idea lab**
- Pitch an idea (Product / Service / Event / Online / Other) and Analyse idea.
- An honest score /100: Strong idea / Promising / …
- Sort by Best score, Most votes or Newest. Vote and comment.
- Open an idea:
  - research and sources
  - the **Council**: 5 advisors and a chairman's verdict
  - unit economics
  - proof of demand
  - "Find clients with Scout"

**8. Scout** (find first clients)
- Pick or create a project (+ New project, edit pencil).
- Set country, city, search area and places to judge. "Looking for" shows what to search.
- **Find clients**: "What Scout is doing" live log, plus the globe/map.
- Leads list:
  - score, fit, evidence level
  - Google Maps / website / Instagram links
  - owner, status, next step
  - Save to project
- **Check a place**: paste a Google Maps link, website or Instagram.
- **AI connections** button next to the title. Runs: Customer, Marketing and leaders. Everyone can read.

**9. Meeting log**
- Record a meeting (or upload audio) → notes + transcript for everyone.
- Filters: All / Training sessions / Phone calls / …
- Search meetings.

**10. Team**
- Search people. Filters: Inactive / Somewhat active / Active.
- Each person's status. Open a member page:
  - in progress, completed, sales
  - profile card + email
  - where they work, weekly activity, current task countdown
  - activity by team, month calendar, coming up

**11. Your profile** (avatar → My profile)
- Everything on a member page, plus:
- **My Projects**: the projects you're in.
- **Documents**:
  - **Company documents** (from leaders, read-only, "New" badge)
  - **My folder** (private, your own files and folders)
- **My connections** (also avatar → My connections):
  - **Groq** (main AI, free key: powers Ask emet, Idea Lab, notes, Scout)
  - **Mistral** (free backup AI)
  - **Lend my key to Scout** (switch; Scout uses at most 60% of your daily allowance)
  - **Google Calendar** (secret iCal link)
  - Each one not yet connected shows its steps right there.

**12. A project page** (Base camp or profile → a project)
- Header: icon, status, goal progress, deadline, members.
- Tabs:
  - **Overview**
  - **Money** (from Finance)
  - **Tasks**: leaders add, members move and tick
  - **Leads** (saved from Scout)
  - **Links** (Google Docs / Sheets / Slides…)
  - **Files**
  - **Updates** feed
