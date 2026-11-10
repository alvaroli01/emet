import { createClient } from "@supabase/supabase-js";
import { applyEvent, madridTime, distanceM, zoneStep, isInNow, isWorkday, type Visit } from "@/lib/office";

/**
 * Automatic office check-in from the member's phone (dashboard closed, mobile data is fine): POST /api/office/<token>
 * with JSON {lat, lng}. iPhone: the emet shortcut, every 15 s after Apple's ~100 m zone wakes it. Android: MacroDroid.
 * emet decides from the real position only — in within 30 m, out from 80 m — so nobody can start or stop their time
 * by hand (Alvaro, 2026-11-10: "nobody can cheat"). Answers "done" or "wait" (keep checking). The position is only
 * compared with the office point; it is never stored. POST only, so a link preview can't trigger it.
 */
const num = (v: unknown) => Number(String(v ?? "").trim().replace(",", ".")); // Spanish iPhones send "43,26"
const text = (s: string, status = 200) => new Response(s, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{40,80}$/.test(token)) return text("Not found", 404);
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: link } = await db.from("office_links").select("user_id, profiles(active)").eq("token", token)
    .maybeSingle<{ user_id: string; profiles: { active: boolean } | null }>();
  if (!link?.profiles?.active) return text("Not found", 404);

  const body = (await request.json().catch(() => ({}))) as { lat?: unknown; lng?: unknown };
  const here = { lat: num(body.lat), lng: num(body.lng) };
  if (!Number.isFinite(here.lat) || !Number.isFinite(here.lng) || Math.abs(here.lat) > 90 || Math.abs(here.lng) > 180) return text("emet: no location", 400);
  const [{ data: office }, { data: open }] = await Promise.all([
    db.from("office_place").select("lat, lng").maybeSingle<{ lat: number; lng: number }>(),
    db.from("office_visits").select("id, user_id, arrived_at, left_at, forgot").eq("user_id", link.user_id).is("left_at", null).maybeSingle<Visit>(),
  ]);
  const dist = office ? distanceM(office, here) : null;
  // "Phone connected": leaders see when each phone last reported and how far away it was (the distance only, never the position)
  await db.from("office_links").update({ last_ping_at: new Date().toISOString(), last_distance_m: dist === null ? null : Math.round(dist) }).eq("token", token);
  if (!isWorkday(Date.now())) return text("done emet: weekends don't count"); // Monday–Friday only
  if (dist === null) return text("done emet: the office location isn't set yet");
  const step = zoneStep(dist, !!open && isInNow(open, Date.now()));
  if (!step.event) return text(`${step.reply} emet: ${Math.round(dist)} m from the office`);
  const ev = step.event;
  const { arrivedAt } = await applyEvent(db, link.user_id, ev, "phone");
  const time = madridTime(ev === "arrive" && arrivedAt ? arrivedAt : new Date().toISOString());
  return text(ev === "arrive" ? `done emet: checked in ${time}` : `done emet: checked out ${time}`);
}
