import { createClient } from "@supabase/supabase-js";
import { applyEvent, madridTime, distanceM, zoneStep, isInNow, isWorkday, type Visit } from "@/lib/office";

/**
 * Automatic office check-in from the member's phone (dashboard closed, mobile data is fine): POST /api/office/<token>.
 * Main way (Alvaro, 2026-11-11): the free OwnTracks app, set up once with one tap, runs in the background for good and
 * POSTs its JSON ({_type: "location"|"transition", lat, lon, acc, tst}). Older ways still work: the iPhone shortcut and
 * MacroDroid send {lat, lng}. emet decides from the real position only — in within 30 m, out from 80 m — so nobody can
 * start or stop their time by hand (Alvaro, 2026-11-10: "nobody can cheat"). Near the office but undecided, it asks
 * OwnTracks for a fresh position (cmd reportLocation) for up to 10 minutes. The position is only compared with the
 * office point; it is never stored. POST only, so a link preview can't trigger it.
 */
export const maxDuration = 30;
const num = (v: unknown) => Number(String(v ?? "").trim().replace(",", ".")); // Spanish iPhones send "43,26"
const text = (s: string, status = 200) => new Response(s, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
const ASK_AGAIN = [{ _type: "cmd", action: "reportLocation" }];
const WAIT_MAX_MS = 10 * 60e3;   // keep asking OwnTracks for positions for at most 10 min in the 30–80 m band (battery)
const ASK_DELAY_MS = 8e3;        // ~one position every 10 s while asking
const MAX_ACC_M = 80;            // a rougher fix than ±80 m decides nothing (no wrong check-out inside the building)
const MAX_AGE_S = 5 * 60;        // OwnTracks re-sends queued positions after being offline: old ones decide nothing

type Body = { _type?: unknown; lat?: unknown; lng?: unknown; lon?: unknown; acc?: unknown; tst?: unknown; inregions?: unknown };
const ZONE = "emet office";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{40,80}$/.test(token)) return text("Not found", 404);
  const body = (await request.json().catch(() => ({}))) as Body;
  const ot = typeof body._type === "string"; // OwnTracks always sends _type and expects a JSON array back
  // Phones set up by hand (the one-tap import is blocked by default on iPhone) don't have the office zone that wakes
  // OwnTracks on arrival: emet sends it with every answer until the phone reports from inside it (same tst = same zone).
  let zone: object[] = [];
  const reply = (s: string, cmds: object[] = []) => (ot ? Response.json([...cmds, ...zone]) : text(s));
  if (ot && body._type !== "location" && body._type !== "transition") return Response.json([]); // waypoints, status, card…

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: link } = await db.from("office_links").select("user_id, wait_since, profiles(active)").eq("token", token)
    .maybeSingle<{ user_id: string; wait_since: string | null; profiles: { active: boolean } | null }>();
  if (!link?.profiles?.active) return text("Not found", 404);

  const here = { lat: num(body.lat), lng: num(body.lng ?? body.lon) };
  if (!Number.isFinite(here.lat) || !Number.isFinite(here.lng) || Math.abs(here.lat) > 90 || Math.abs(here.lng) > 180) return ot ? Response.json([]) : text("emet: no location", 400);
  const tst = num(body.tst);
  if (ot && Number.isFinite(tst) && Date.now() / 1000 - tst > MAX_AGE_S) return Response.json([]);
  const [{ data: office }, { data: open }] = await Promise.all([
    db.from("office_place").select("lat, lng").maybeSingle<{ lat: number; lng: number }>(),
    db.from("office_visits").select("id, user_id, arrived_at, left_at, forgot").eq("user_id", link.user_id).is("left_at", null).maybeSingle<Visit>(),
  ]);
  const dist = office ? distanceM(office, here) : null;
  if (ot && office && !(Array.isArray(body.inregions) && body.inregions.includes(ZONE)))
    zone = [{ _type: "cmd", action: "setWaypoints", waypoints: { _type: "waypoints", waypoints: [{ _type: "waypoint", desc: ZONE, lat: office.lat, lon: office.lng, rad: 100, tst: 1762819200 }] } }];
  const rough = ot && num(body.acc) > MAX_ACC_M;
  const step = dist === null || rough ? { event: null, reply: "wait" as const } : zoneStep(dist, !!open && isInNow(open, Date.now()));
  const fresh = link.wait_since && Date.now() - Date.parse(link.wait_since) < 60 * 60e3; // a new approach after an hour starts a new 10 min
  const waitSince = step.reply === "wait" ? (fresh ? link.wait_since : new Date().toISOString()) : null;
  // "Phone connected": leaders see when each phone last reported and how far away it was (the distance only, never the position)
  await db.from("office_links").update({ last_ping_at: new Date().toISOString(), last_distance_m: dist === null ? null : Math.round(dist), wait_since: waitSince }).eq("token", token);
  if (!isWorkday(Date.now())) return reply("done emet: weekends don't count"); // Monday–Friday only
  if (dist === null) return reply("done emet: the office location isn't set yet");
  if (!step.event) {
    // OwnTracks only reports when it moves a lot; close to the office, ask it for another position in a few seconds
    if (ot && waitSince && Date.now() - Date.parse(waitSince) < WAIT_MAX_MS && dist < 500) {
      await new Promise((r) => setTimeout(r, ASK_DELAY_MS));
      return reply("", ASK_AGAIN);
    }
    return reply(`${step.reply} emet: ${Math.round(dist)} m from the office`);
  }
  const ev = step.event;
  const { arrivedAt } = await applyEvent(db, link.user_id, ev, "phone");
  const time = madridTime(ev === "arrive" && arrivedAt ? arrivedAt : new Date().toISOString());
  return reply(ev === "arrive" ? `done emet: checked in ${time}` : `done emet: checked out ${time}`);
}
