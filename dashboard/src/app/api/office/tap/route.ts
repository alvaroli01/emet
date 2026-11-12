import { NextResponse, type NextRequest } from "next/server";
import { createClient as admin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { applyEvent, distanceM, zoneStepWithAccuracy, checkoutCounts, isInNow, isWorkday, isOutsideDay, madridTime, dayClosesAt, LUNCH_MS, type Visit } from "@/lib/office";

/**
 * One-tap office check-in (Alvaro, 2026-11-11; replaces the phone apps): the 9:00 notification opens /office, which sends
 * the phone's position with one of these actions. The server decides from the real position:
 * - in: within 30 m of Dock (up to 20 m GPS slack in the person's favour). Also ends a working-outside stretch.
 * - out: anywhere; away from Dock the exact spot is kept for the team calendar. Never checked out by 21:00 = 0 h.
 * - lunch: Pause at Dock / "I'm out eating" anywhere — the time stops and carries on when they check in again at Dock.
 * - outside while checked in ("I'm out working", Mon/Wed/Fri): the Dock stretch ends now and the outside one starts here.
 * - outside: Mon/Wed/Fri only, with a note — logged with the position for everyone to see (the outside calendar).
 * - still: "still working outside" (asked every 2 h) — logs the position again. done: ends it (position logged).
 * Phones only: a laptop's location is easy to fake in dev tools.
 */
type Body = { action?: unknown; lat?: unknown; lng?: unknown; accuracy?: unknown; note?: unknown; away?: unknown };
type Outside = { id: string; places: unknown[] };

export async function POST(request: NextRequest) {
  if (!/iPhone|iPad|Android/i.test(request.headers.get("user-agent") ?? "")) return NextResponse.json({ status: "phone-only" }, { status: 403 });
  const supabase = await createClient();
  const [{ data: me }, { data: member }] = await Promise.all([supabase.rpc("my_profile_id"), supabase.rpc("is_member")]);
  if (!me || !member) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const b = (await request.json().catch(() => ({}))) as Body;
  const action = String(b.action ?? "");
  const lat = Number(b.lat), lng = Number(b.lng), accuracy = Number(b.accuracy);
  if (![lat, lng, accuracy].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || accuracy < 0) return NextResponse.json({ status: "no-location" }, { status: 400 });
  const now = Date.now();
  if (!isWorkday(now)) return NextResponse.json({ status: "weekend" });
  if (now >= dayClosesAt(now)) return NextResponse.json({ status: "closed" }); // the day closes at 21:00

  const db = admin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const userId = me as string;
  const [{ data: office }, { data: open }, { data: outside }] = await Promise.all([
    db.from("office_place").select("lat, lng").maybeSingle<{ lat: number; lng: number }>(),
    db.from("office_visits").select("id, user_id, arrived_at, left_at, forgot").eq("user_id", userId).is("left_at", null).maybeSingle<Visit>(),
    db.from("office_outside").select("id, places").eq("user_id", userId).is("ended_at", null).maybeSingle<Outside>(),
  ]);
  if (!office) return NextResponse.json({ status: "no-office" });
  const dist = Math.round(distanceM(office, { lat, lng }));
  const isIn = !!open && isInNow(open, now);
  const place = { at: new Date(now).toISOString(), lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5, acc: Math.round(accuracy) };
  const endOutside = async () => outside && await db.from("office_outside").update({ ended_at: place.at, confirmed_at: place.at, places: [...outside.places, place] }).eq("id", outside.id);

  if (action === "in") {
    if (isIn) return NextResponse.json({ status: "already-in", distance: dist });
    if (accuracy > 150) return NextResponse.json({ status: "vague", distance: dist });
    if (zoneStepWithAccuracy(dist, accuracy, false).event !== "arrive")
      return NextResponse.json({ status: isOutsideDay(now) && !outside ? "too-far-outside" : "too-far", distance: dist }); // Mon/Wed/Fri: offer working outside
    await endOutside();
    await applyEvent(db, userId, "arrive", "phone");
    return NextResponse.json({ status: "in", distance: dist });
  }
  if (action === "out") {
    if (!isIn) return NextResponse.json({ status: "not-in", distance: dist });
    // "I'm out" works anywhere (Alvaro, 2026-11-11): away from Dock the exact spot is kept and shown in the team calendar
    const atDock = checkoutCounts(dist, accuracy);
    await db.from("office_visits").update({ left_at: place.at, out_distance_m: dist, ...(atDock ? {} : { out_lat: place.lat, out_lng: place.lng }) }).eq("id", open!.id);
    return NextResponse.json({ status: atDock ? "out" : "out-away", distance: dist });
  }
  if (action === "auto-out") { // emet opened on the phone away from Dock while still checked in → checked out now, here
    // Only when clearly away (2026-11-12: Lassi was checked out inside Dock by a GPS jump): 250 m+ even counting the error
    if (!isIn || accuracy > 100 || dist - accuracy < 250) return NextResponse.json({ status: "nothing", distance: dist });
    await db.from("office_visits").update({ left_at: place.at, out_distance_m: dist, out_lat: place.lat, out_lng: place.lng }).eq("id", open!.id);
    return NextResponse.json({ status: "out-away", distance: dist });
  }
  if (action === "will-return") { // after an automatic check-out: "I'm out, I'll be back" → that stretch becomes a pause
    const { data: last } = await db.from("office_visits").select("id, left_at").eq("user_id", userId).not("left_at", "is", null).eq("forgot", false)
      .order("arrived_at", { ascending: false }).limit(1).maybeSingle<{ id: string; left_at: string }>();
    if (isIn || !last || Date.parse(last.left_at) < now - 6 * 3600e3) return NextResponse.json({ status: "nothing" });
    await db.from("office_visits").update({ lunch_until: new Date(Date.parse(last.left_at) + LUNCH_MS).toISOString() }).eq("id", last.id);
    return NextResponse.json({ status: "lunch" });
  }
  if (action === "lunch") {
    if (!isIn) return NextResponse.json({ status: "not-in", distance: dist });
    // Pause only at Dock; away from Dock the only way to stop is "I'm out eating" (away: true). The time carries on when they're back
    if (!checkoutCounts(dist, accuracy) && b.away !== true) return NextResponse.json({ status: "far", distance: dist });
    const until = new Date(now + LUNCH_MS).toISOString();
    await db.from("office_visits").update({ left_at: place.at, lunch_until: until }).eq("id", open!.id);
    return NextResponse.json({ status: "lunch", time: madridTime(until) });
  }
  if (action === "outside") {
    const note = String(b.note ?? "").trim().slice(0, 200);
    if (!isOutsideDay(now)) return NextResponse.json({ status: "office-day" });
    if (!note) return NextResponse.json({ status: "no-note" }, { status: 400 });
    if (outside) return NextResponse.json({ status: "already-outside" });
    if (isIn) await db.from("office_visits").update({ left_at: place.at }).eq("id", open!.id); // "I'm out working": the Dock stretch ends now
    const { error } = await db.from("office_outside").insert({ user_id: userId, note, places: [place] });
    if (error && error.code !== "23505") throw error;
    return NextResponse.json({ status: "outside" });
  }
  if (action === "still" || action === "done") {
    if (!outside) return NextResponse.json({ status: "not-outside" });
    if (action === "done") await endOutside();
    else await db.from("office_outside").update({ confirmed_at: place.at, places: [...outside.places, place] }).eq("id", outside.id);
    return NextResponse.json({ status: action === "done" ? "outside-done" : "outside-still" });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
