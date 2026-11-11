import { NextResponse, type NextRequest } from "next/server";
import { createClient as admin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { applyEvent, distanceM, zoneStepWithAccuracy, checkoutCounts, isInNow, isWorkday, isOutsideDay, type Visit } from "@/lib/office";

/**
 * One-tap office check-in (Alvaro, 2026-11-11; replaces the phone apps): the 9:00 notification opens /office, which sends
 * the phone's position with one of these actions. The server decides from the real position:
 * - in: within 30 m of Dock (up to 20 m GPS slack in the person's favour). Also ends a working-outside stretch.
 * - out: within 80 m of Dock = a normal check-out; anywhere else = that stretch counts 0 h (no time left running).
 * - outside: Mon/Wed/Fri only, with a note — logged with the position for everyone to see (the outside calendar).
 * - still: "still working outside" (asked every 2 h) — logs the position again. done: ends it (position logged).
 * Phones only: a laptop's location is easy to fake in dev tools.
 */
type Body = { action?: unknown; lat?: unknown; lng?: unknown; accuracy?: unknown; note?: unknown; anyway?: unknown };
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
    if (zoneStepWithAccuracy(dist, accuracy, false).event !== "arrive") return NextResponse.json({ status: "too-far", distance: dist });
    await endOutside();
    await applyEvent(db, userId, "arrive", "phone");
    return NextResponse.json({ status: "in", distance: dist });
  }
  if (action === "out") {
    if (!isIn) return NextResponse.json({ status: "not-in", distance: dist });
    const counts = checkoutCounts(dist, accuracy);
    if (!counts && b.anyway !== true) return NextResponse.json({ status: "far", distance: dist }); // warn first: 0 h
    await (counts
      ? db.from("office_visits").update({ left_at: place.at }).eq("id", open!.id)
      : db.from("office_visits").update({ left_at: place.at, forgot: true }).eq("id", open!.id)); // not at Dock → 0 h
    return NextResponse.json({ status: counts ? "out" : "out-zero", distance: dist });
  }
  if (action === "outside") {
    const note = String(b.note ?? "").trim().slice(0, 200);
    if (!isOutsideDay(now)) return NextResponse.json({ status: "office-day" });
    if (!note) return NextResponse.json({ status: "no-note" }, { status: 400 });
    if (isIn) return NextResponse.json({ status: "already-in", distance: dist });
    if (outside) return NextResponse.json({ status: "already-outside" });
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
