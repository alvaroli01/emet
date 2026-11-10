# Office check-in

Built 2026-11-10 · **live** · migration `0053_office_and_leader_messages.sql` · code `dashboard/src/lib/office.ts`, `src/app/api/office/`, `src/components/office/office-card.tsx`, `src/components/tools/leader-message.tsx`

## What it does
- **Today → At the office:** who is in right now and since when (Spanish time), my hours today and this week, everyone's hours this week, and a **Check in / Check out** button as a fallback.
- **Automatic:** each member's phone checks them in when they come within **30 m** of the office (Alvaro picked 30 m on 10 Nov because the building is big) and out when they are **150 m** away. It works with emet closed and on mobile data.
- **Privacy:** emet only receives "arrived" / "left" and the time. It never gets a location.

## Why the phone does the detecting
A website can't read location while it's closed (iPhones block it completely), and GPS is ±10–30 m indoors, so 7 m wasn't possible. The university Wi-Fi is shared, so Wi-Fi detection was out too. The phone's own geofence (Shortcuts / MacroDroid) runs in the background for free.

## Phone setup (each member, once)
Today → At the office → *Check in automatically with my phone* → **Create my check-in links**, then:
- **iPhone (Shortcuts):** Automation → + → Arrive → the office, radius 30 m → Run Immediately → "Get Contents of URL" → paste the *arrive* link → Method **POST**. Repeat with Leave (radius **150 m**) + the *leave* link.
- **Android (MacroDroid, free):** Geofence trigger (office, 30 m, Area entered) → HTTP Request POST with the arrive link; a second macro: geofence 150 m, Area exited + the leave link. Location "All the time".
- The links are private. **Reset them** makes new ones (the old ones stop working).

## Rules
- **Pause:** leaving pauses the day until 21:00. Coming back before then resumes it, and the time away never counts. If they don't come back, the hours stop where they paused. Today shows a *Paused* list.
- Never checked out after 16 h = "forgotten", counts 0 h.
- Visits are written only by the server. Members can read everyone's visits but can't edit hours.
- The link only accepts POST, so a WhatsApp link preview can't check anyone in.

## Late fines (Tuesdays & Thursdays, migration 0054)
- From the **first** check-in of the day (before 14:00), Spanish time: up to 9:10:59 on time · **9:11:00–9:29:59 = €3** (kind `late_fine`, 0 strikes) · **9:30:00+ = €3 + 1 strike** (`late_arrival`).
- Added automatically by the DB trigger `office_late`; the person gets a bell + phone alert. Coach, Ollin guests and the bot are never charged. One per day.
- Phones can fire a minute or two late: leaders delete a wrong one in Team Leaders → Strikes.
- Tested 10 Nov on live data in a rolled-back transaction: 9:10:59 nothing, 9:11:00 and 9:29:59 €3, 9:30:00 and Thu 9:45 €3 + strike, Wed nothing, second arrival nothing, coach nothing.

## Send a notification (Team Leaders)
Team Leaders section → **Send a notification**: leaders and admins write up to 300 characters to everyone, one team or chosen people. It goes to the bell and to the phone (kind `leader_message`, DB function `leader_send`, which checks `is_leader()`).

## Open
- Every member has to do the phone setup.
- Should only leaders see everyone's hours?

Related: [[Today]], [[Phone version]], [[🔵 How the dashboard works]]
