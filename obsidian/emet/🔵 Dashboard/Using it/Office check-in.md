# Office check-in

Built 2026-11-10 · **live** · OwnTracks since 2026-11-11 (migration `0059_office_owntracks.sql`) · migration `0053_office_and_leader_messages.sql` · code `dashboard/src/lib/office.ts`, `src/app/api/office/`, `src/components/office/office-card.tsx`, `src/components/tools/leader-message.tsx`

## What it does
- **Today → At the office:** who is in right now and since when (Spanish time), my hours today and this week, everyone's hours this week. There is no Check in / Check out button (anti-cheat).
- **Automatic:** each member's phone checks them in when they come within **30 m** of the office (Alvaro picked 30 m on 10 Nov because the building is big) and out when they are **80 m** away. It works with emet closed and on mobile data.
- **Privacy:** emet only receives "arrived" / "left" and the time. It never gets a location.

## Why the phone does the detecting
A website can't read location while it's closed (iPhones block it completely), and GPS is ±10–30 m indoors, so 7 m wasn't possible. The university Wi-Fi is shared, so Wi-Fi detection was out too. The phone's own geofence (Shortcuts / MacroDroid) runs in the background for free.

## Phone setup (each member, once) — OwnTracks since 11 Nov
The iPhone shortcut didn't work well (didn't fire, too hard to set up, asked for confirmations, wrong in/out), so on 11 Nov Alvaro moved check-in to **OwnTracks**: a free, open-source app (iPhone + Android, no account) that runs in the background and sends the phone's position to emet.
- Today → At the office → *Check in automatically with my phone* → **Create my check-in links** → **1. Install OwnTracks** → open it once → back in emet on the same phone **2. Connect it to emet** (an `owntracks:///config?inline=…` link that imports everything: HTTP mode to my link, *significant* monitoring, remote commands on, a 100 m zone around the office). Allow location **Always**. Then never open OwnTracks or emet again.
- iPhone: keep Background App Refresh on for OwnTracks and don't swipe it closed. Android: battery → Unrestricted.
- **How emet decides:** OwnTracks posts `{_type: location|transition, lat, lon, acc, tst}`. Within 30 m = in, 80 m away = out. Between 30 and 80 m (and up to 500 m) emet answers `[{"_type":"cmd","action":"reportLocation"}]` after ~8 s, so the phone sends a fresh position about every 10 s — for at most 10 min (`office_links.wait_since`). Fixes rougher than ±80 m and queued ones older than 5 min decide nothing.
- Tested 11 Nov on live emet with fake OwnTracks payloads: far = nothing, 50 m = reportLocation after 8.6 s, rough fix = no decision, old queued = ignored, at the door = checked in, 160 m = checked out (test visit deleted). **Not yet tested on a real phone at Dock.**
- **iPhone, 11 Nov:** the one-tap import failed with “URI or file configuration not allowed” (OwnTracks blocks setup links by default; the switch wasn't visible in Settings). Done by hand instead: Settings → Mode **HTTP** → paste the link in **URL** → **Authentication off** → Map → up arrow. Alvaro's iPhone reached emet at 14:34 from Dock (14 m). emet now sends the office zone to such phones itself (`cmd setWaypoints`, until a report has `inregions: ["emet office"]`).
- The old iPhone shortcut and MacroDroid links still work (same `/api/office/<token>`), but emet no longer shows their steps.
- **Why not something else (11 Nov):** no spare device to leave at the office (a door screen was the other idea); NFC sticker rejected by Alvaro; our own app would need Apple's €99/year developer account; Bluetooth can't identify iPhones (they change address); the university Wi-Fi is shared.
- **The office point:** **Dock Bilbao, Uribitarte Pasealekua 3, 48001 Bilbao** (43.2646286, -2.9268837), set 10 Nov from Alvaro's Google Maps link (table `office_place`, migration 0055). An admin can fine-tune it by pressing **Move the office location to here** at the door.
- **Tested 10 Nov on Alvaro's Mac** with the real shortcut against live emet: location sent every 15 s, check-in, 200 m check-out, resume as a new stretch. The first file failed (empty If value, pasted link not applied); the fixed one has no If step and an empty link box.
- The shortcut lives in Alvaro's Mac Shortcuts app as **emet check-in** and is shared by that iCloud link. Don't delete it there (the link points to it). To change it, edit it on the Mac and share a new iCloud link.

## Rules
- **Pause:** leaving pauses the day until 21:00. Coming back before then resumes it, and the time away never counts. If they don't come back, the hours stop where they paused. Today shows a *Paused* list.
- **No cheating (Alvaro, 10 Nov):** there is no Check in/out button and no arrive/leave links. Only a real phone position counts, so running the shortcut from home can never check you in. No check-out by midnight (phone off, Leave deleted) = that stretch counts 0 h.
- Visits are written only by the server. Members can read everyone's visits but can't edit hours.
- The link only accepts POST, so a WhatsApp link preview can't check anyone in.

## Where to see it (10 Nov)
- **Top bar:** a pill next to the bell, green *In the office* / grey *Out of office* (amber dot = paused). Tap it for my time today and this week and the rules.
- **Profiles:** everyone can see anyone's office time today and this week.
- **Team Leaders → Office:** everyone's status and hours, and whose phone isn't set up or has no signal (`last_ping_at`, migration 0056).
- **Monday–Friday only:** weekend positions are ignored.
- **Deleting fines/strikes:** Team Leaders → Strikes. Automatic ones say *automatic*; delete them for anyone who worked elsewhere that day.
- **iOS 27:** the Arrive/Leave triggers live inside the shortcut (open emet check-in → Edit → Automation). There is no separate Automation tab anymore. Turn on ⓘ → Privacy → Allow Running When Locked.

## Late fines (Tuesdays & Thursdays, migration 0054)
- From the **first** check-in of the day (before 14:00), Spanish time: up to 9:10:59 on time · **9:11:00–9:29:59 = €3** (kind `late_fine`, 0 strikes) · **9:30:00+ = €3 + 1 strike** (`late_arrival`).
- Added automatically by the DB trigger `office_late`; the person gets a bell + phone alert. Coach, Ollin guests and the bot are never charged. One per day.
- Phones can fire a minute or two late: leaders delete a wrong one in Team Leaders → Strikes.
- Tested 10 Nov on live data in a rolled-back transaction: 9:10:59 nothing, 9:11:00 and 9:29:59 €3, 9:30:00 and Thu 9:45 €3 + strike, Wed nothing, second arrival nothing, coach nothing.

## Send a notification (Team Leaders)
Team Leaders section → **Send a notification**: leaders and admins write up to 300 characters to everyone, one team or chosen people. It goes to the bell and to the phone (kind `leader_message`, DB function `leader_send`, which checks `is_leader()`).

## Open
- Every member has to do the OwnTracks setup (on 11 Nov only Alvaro had a link).
- Test OwnTracks for real at Dock on an iPhone and an Android: does it keep sending in the background, and does reportLocation work while the phone is locked?
- The first walk (10 Nov) never got within 30 m by GPS. If that repeats with OwnTracks, the unfinished GPS-accuracy slack (`zoneStepWithAccuracy`, uncommitted since 10 Nov) could be reused.
- Should only leaders see everyone's hours?

Related: [[Today]], [[Phone version]], [[🔵 How the dashboard works]]
