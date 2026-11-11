# Office check-in

Built 2026-11-10 · **live** · one tap since 2026-11-11 (migration `0060_office_taps.sql`) · code `dashboard/src/lib/office.ts`, `src/app/api/office/tap/`, `src/app/(app)/office/`, `src/components/office/`, `src/components/tools/office-review.tsx`, `src/components/tools/leader-message.tsx`

## What it does (since 11 Nov)
- **9:00, Monday–Friday:** everyone gets a notification (bell + phone): *At the office? Tap to check in.* It opens **/office**, which reads the phone's position once. emet checks them in **only within 30 m of Dock** (up to 20 m GPS slack in their favour).
  - Tuesday/Thursday (office days) the tap checks in straight away (`/office?go=in`).
  - Monday/Wednesday/Friday the page also offers **I'm working outside**.
- **Check out:** they tap *Check out* when they leave. It **only counts at Dock (within 80 m)**. Anywhere else, emet warns first; checking out anyway, or never checking out, makes that stretch **0 h**. So leaving the time running earns nothing. 
- **14:00 and 17:00:** everyone still checked in gets *Still at the office? If you've left, check out.* (Alvaro: someone leaving at 2 without saying anything.)
- **Auto check-out on opening emet (11 Nov, 18:00):** Alvaro got home and his time was still running. Now, opening emet on a phone while checked in and **away from Dock** (and location already allowed) checks out at that moment and spot (`/api/office/tap` action `auto-out`, from the top-bar pill), with a message. Nothing happens at Dock or with a rough fix (>150 m).
- **I'm out works anywhere (11 Nov, latest):** finishing away from Dock is allowed; the exact spot is kept (`office_visits.out_lat/out_lng/out_distance_m`, migration 0066) and the team calendar shows *checked out here (not at Dock)* with a map link. *I'm in* and *Pause* stay Dock-only.
- **Only at Dock (11 Nov, later — check-out part replaced above):** *I'm in*, *Pause* and *I'm out* only work at Dock. Away from Dock the screen offers only **I'm out eating** (the time stops now and carries on when they're back at Dock) and, Mon/Wed/Fri, **I'm out working** (note + this exact spot; the Dock stretch ends now). The old "check out anyway (0 h)" is gone; never checking out still makes that stretch 0 h at 21:00.
- **Three choices on the check-in screen (11 Nov evening):** **I'm in**, **I'm out** (done for the day) and **Pause — going out, back later** (eating, an errand; back at Dock → **I'm back**). The big clock is the **whole day at Dock** (finished stretches + the current one), so coming back never restarts it; while paused it shows the break timer (red past 1 h). Pause is the old *Going to eat* (same rules below).
- **Going to eat / Pause (14:00 option, also on /office):** tapped **at Dock**, before leaving. The time stops for **max 1 hour** and the break doesn't count. 10 minutes before the end: *Lunch ends soon — back at Dock by 15:42*. Back late no longer costs anything (Alvaro, 11 Nov evening, migration 0065): the morning keeps its hours, and Everyone now / the team calendar show the longer lunch (*Eating 1h 25m +25 min*, red); the check-in screen counts up in red past the hour (`office_visits.lunch_until`). Tested 11 Nov in a rolled-back transaction: 14:00 and 17:00 questions, reminder, back in time, not back.
- **Working outside (Mon/Wed/Fri):** they write what they're doing (e.g. *Visiting shops in Indautxu*). emet saves the position at the start, every **2 hours** (notification *Still working outside?* → one tap) and at the end (`office_outside.places`). No answer within 30 minutes ends it at the last tap. Checking in at Dock ends it, and the questions stop.
- **Everyone can see (Today → At the office):**
  - **Everyone now:** each class member with their status — *At Dock since 09:02* / *Eating · back by 15:10* / *Outside since 10:00 · note* / *Left at 14:00* / *Not in* — their time at Dock today, and **when they last opened emet** (`presence.last_seen_at`).
  - **Team calendar this week:** every Dock stretch (from–to, hours, or **0 h** in red if never checked out at Dock) and every outside stretch (note, map links to where they said they were out and the last place).
- **21:00 the day closes** (Alvaro, 11 Nov): anyone still checked in gets 0 h for that stretch, working outside ends at the last tap, and no check-in is accepted after 21:00 (migration 0063). The 18:00 reminder was dropped.
- **The 9:00 tap checks in straight away** at Dock. Away from Dock on Mon/Wed/Fri, emet says how far they are and opens *working outside*, saving that exact spot.
- **Phones only:** a laptop's location is easy to fake in dev tools.
- Pause rule stays: checking out pauses the day until 21:00; checking in again resumes it.

## How it runs
- `office_tick()` runs **every 5 minutes** (pg_cron job `office-tick`, Supabase free plan): 9:00 check-in notifications (one per person per day, dedupe `office_checkin:<date>`), 14:00 and 17:00 questions (only people still in), lunch reminders and expiry, 2-hour outside questions, closing unanswered outside stretches, and the 21:00 day close.
- New notification kinds: `office_checkin`, `office_checkout`, `office_outside_check` (in `push_worthy`, texts in all 7 languages).
- Who gets them: `office_people()` = active class members (no coach, Ollin guests or bot).
- Tested 11 Nov in a rolled-back transaction with a fake clock: Thu 9:00 → 14 notifications linking `/office?go=in`, no duplicates on the next run; Fri 9:00 → offers working outside; Wed 18:00 → only Alvaro (still in; that reminder was removed later the same day — tested again: 0 at 18:00, Alvaro's open stretch closed as 0 h at 21:01); outside question once per 2 h, ended 30 min after an unanswered question.

## Why not an app (11 Nov)
- Same day we first moved to **OwnTracks** (free background app). It worked on Alvaro's iPhone at Dock (signals 14:34, 14:43, 14:50), but iPhone blocks its one-tap setup ("URI or file configuration not allowed") and Alvaro decided people won't install and keep an app → removed, along with the iPhone shortcut and MacroDroid links (`/api/office/<token>` deleted).
- Also ruled out: a device at the office door (none spare), NFC sticker (Alvaro's choice), our own app (Apple €99/year), Bluetooth (iPhones change address), university Wi-Fi (shared). A website can't read location in the background.
- Repeated "still at the office?" taps were rejected (Alvaro: people won't do it) → the Dock-only check-out rule instead.

## The office point
**Dock Bilbao, Uribitarte Pasealekua 3, 48001 Bilbao** (43.2646286, -2.9268837), set 10 Nov (table `office_place`, migration 0055). Alvaro's Mac read 15 m from it at the office on 11 Nov (±35 m), so it was left as is. An admin can fine-tune it with **Move the office location to here** on Today → At the office.

## Away, automatic fines, leader tools (11 Nov, migration 0064)
- **Not checked in at all on Tue/Thu:** at **9:11** emet adds €3 (`late_fine`, bell + phone alert); still not in at **9:30** it becomes €3 + 1 strike (`late_arrival`). Each step runs once per person per day (`office_auto_fines`), so a fine a leader deletes is never added again. Coach, guests, bot and **away** people are never charged. `office-tick` now runs every minute so 9:11 and 9:30 are on time. Tested in a rolled-back transaction: 14 fined at 9:11 (the away one not), no duplicates, a deleted fine not re-added, 12 strikes at 9:30 (the 9:20 arrival kept only €3).
- **Away (trip, sick, other):** Team Leaders → Office → *Away*: person, from, to, reason (`office_absences`). Away people get no check-in / 14:00 / 17:00 notifications and no automatic fines; everyone sees *Away until … · reason* in Everyone now and in the team calendar.
- **Team Leaders → Office → Check someone in or out:** now, or at a time today (`office_leader_set(p_user, 'in'|'out', p_time)`, leaders only; refuses the future and overlaps). Check-out also fixes a stretch closed as 0 h. **Today's late fines** list with Delete (also in Team Leaders → Strikes).
- **Check-in screen (/office):** one big round button that is also the status (green ring + live timer at Dock, amber while eating with minutes left), the other choices as full-width rows (no text overflowing), rules folded away.
- **Phone app icon/name:** the app is called **emet** (was "emet HQ"); icons renamed to `emet-icon-192/512.png` so Android refreshes them. iPhones keep the icon from when emet was added (before the 5 Nov logo it was an "E"): remove emet from the Home Screen and add it again.

## Late fines (Tuesdays & Thursdays, migration 0054)
- From the **first** check-in of the day (before 14:00), Spanish time: up to 9:10:59 on time · **9:11:00–9:29:59 = €3** (kind `late_fine`, 0 strikes) · **9:30:00+ = €3 + 1 strike** (`late_arrival`).
- Added automatically by the DB trigger `office_late`; the person gets a bell + phone alert. Coach, Ollin guests and the bot are never charged. One per day.
- Leaders delete a wrong one in Team Leaders → Strikes (automatic ones say *automatic*), e.g. for someone who worked elsewhere that day.

## Where to see it
- **Top bar:** pill next to the bell, green *In the office* / grey *Out of office* (amber = paused). Tap it for my time today and this week, the rules, and *Check in / out →*.
- **Profiles:** anyone's office time today and this week.
- **Team Leaders → Office:** everyone's status and hours, and who has **phone alerts off** (they won't get the 9:00 tap).

## Send a notification (Team Leaders)
Team Leaders section → **Send a notification**: leaders and admins write up to 300 characters to everyone, one team or chosen people. It goes to the bell and to the phone (kind `leader_message`, DB function `leader_send`, which checks `is_leader()`).

## Open
- First real 9:00 run: Thursday 12 Nov. Check the next morning that notifications arrived and people could check in.
- Everyone needs phone alerts on (14 of 15 people had them on 11 Nov). On iPhone that needs emet added to the Home Screen.
- Should only leaders see everyone's hours and the outside locations?

Related: [[Today]], [[Phone version]], [[🔵 How the dashboard works]]
