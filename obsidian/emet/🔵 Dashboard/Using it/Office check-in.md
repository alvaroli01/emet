# Office check-in

Built 2026-11-10 · **live** · migration `0053_office_and_leader_messages.sql` · code `dashboard/src/lib/office.ts`, `src/app/api/office/`, `src/components/office/office-card.tsx`, `src/components/tools/leader-message.tsx`

## What it does
- **Today → At the office:** who is in right now and since when (Spanish time), my hours today and this week, everyone's hours this week, and a **Check in / Check out** button as a fallback.
- **Automatic:** each member's phone checks them in when they come within **30 m** of the office (Alvaro picked 30 m on 10 Nov because the building is big) and out when they leave. It works with emet closed and on mobile data.
- **Privacy:** emet only receives "arrived" / "left" and the time. It never gets a location.

## Why the phone does the detecting
A website can't read location while it's closed (iPhones block it completely), and GPS is ±10–30 m indoors, so 7 m wasn't possible. The university Wi-Fi is shared, so Wi-Fi detection was out too. The phone's own geofence (Shortcuts / MacroDroid) runs in the background for free.

## Phone setup (each member, once)
Today → At the office → *Check in automatically with my phone* → **Create my check-in links**, then:
- **iPhone (Shortcuts):** Automation → + → Arrive → the office, radius 30 m → Run Immediately → "Get Contents of URL" → paste the *arrive* link → Method **POST**. Repeat with Leave + the *leave* link.
- **Android (MacroDroid, free):** Geofence trigger (office, 30 m, Area entered) → HTTP Request POST with the arrive link; a second macro for Area exited + the leave link. Location "All the time".
- The links are private. **Reset them** makes new ones (the old ones stop working).

## Rules
- Back within 15 min = the same visit (GPS wobble, a coffee).
- Never checked out after 16 h = "forgotten", counts 0 h.
- Visits are written only by the server. Members can read everyone's visits but can't edit hours.
- The link only accepts POST, so a WhatsApp link preview can't check anyone in.

## Send a notification (Team Leaders)
Team Leaders section → **Send a notification**: leaders and admins write up to 300 characters to everyone, one team or chosen people. It goes to the bell and to the phone (kind `leader_message`, DB function `leader_send`, which checks `is_leader()`).

## Open
- Every member has to do the phone setup.
- Should only leaders see everyone's hours?

Related: [[Today]], [[Phone version]], [[🔵 How the dashboard works]]
