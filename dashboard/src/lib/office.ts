/** Office check-in: what to do when a phone says "arrived" / "left", and how many hours a person was in. */
import type { SupabaseClient } from "@supabase/supabase-js";

export type OfficeEvent = "arrive" | "leave";
export type Visit = { id: string; user_id: string; arrived_at: string; left_at: string | null; forgot: boolean };
export type Op = { op: "insert" } | { op: "close"; id: string } | { op: "forgot"; id: string };

const H = 3600e3;
export const STALE_MS = 16 * H; // still "in" after 16 h, or at midnight → never checked out; that stretch counts 0 h (no cheating by switching the phone off)
export const PAUSE_UNTIL = "21:00"; // left the office: the day is paused until 21:00 (Spanish time); back before then = it resumes

/** Each stretch inside the office is one visit. Leaving pauses the day (the time away never counts); arriving resumes it. */
/** A visit still open at the next Spanish midnight (or after 16 h) was never checked out. */
export const isStale = (v: Visit, now: number) => {
  const nextDay = new Date(Date.parse(madridMidnight(madridDay(v.arrived_at))) + 36 * H).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
  return now >= Date.parse(madridMidnight(nextDay)) || now - Date.parse(v.arrived_at) >= STALE_MS;
};

export function decide(open: Visit | null, event: OfficeEvent, now: number): Op[] {
  const stale = open && isStale(open, now);
  if (event === "arrive") {
    if (open && !stale) return [];
    return open ? [{ op: "forgot", id: open.id }, { op: "insert" }] : [{ op: "insert" }];
  }
  if (!open) return [];
  return [stale ? { op: "forgot", id: open.id } : { op: "close", id: open.id }];
}

/** Hours of one visit: open ones count up to now; forgotten or stale ones count 0. */
export function visitMs(v: Visit, now: number): number {
  if (v.forgot) return 0;
  const start = Date.parse(v.arrived_at);
  if (!v.left_at) return isStale(v, now) ? 0 : Math.max(0, now - start);
  return Math.max(0, Date.parse(v.left_at) - start);
}

export const isInNow = (v: Visit, now: number) => !v.left_at && !v.forgot && !isStale(v, now);

const madridDay = (t: number | string) => new Date(t).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
/** Someone's latest visit ended today and it isn't 21:00 yet → their day is paused (they may still come back). */
export function isPaused(latest: Visit, now: number): boolean {
  if (!latest.left_at || latest.forgot || madridDay(latest.left_at) !== madridDay(now)) return false;
  return madridTime(new Date(now).toISOString()) < PAUSE_UNTIL;
}

/** "7h 05m" */
export const hm = (ms: number) => { const m = Math.round(ms / 60e3); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`; };

/** "09:12", Spanish time */
export const madridTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });

export const IN_M = 30;   // within 30 m of the office = arrived
export const OUT_M = 80;  // 80 m away = left (Alvaro, 2026-11-10)

/** Metres between two points (haversine). */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/** The emet shortcut sends its position every 15 s: in at 30 m, out at 150 m, otherwise keep checking ("wait"). */
export function zoneStep(dist: number, isIn: boolean): { event: OfficeEvent | null; reply: "done" | "wait" } {
  if (dist <= IN_M) return { event: isIn ? null : "arrive", reply: "done" };
  if (dist >= OUT_M) return { event: isIn ? "leave" : null, reply: "done" };
  return { event: null, reply: "wait" };
}

/** Midnight in Spain on that date ("2026-11-10" → "2026-11-09T23:00:00.000Z"), as an ISO instant. */
export function madridMidnight(day: string): string {
  const noon = Date.parse(`${day}T12:00:00Z`);
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hourCycle: "h23" }).format(noon));
  return new Date(Date.parse(`${day}T00:00:00Z`) - (h - 12) * 3600e3).toISOString();
}

/** Apply a phone/button event for one person. `db` must be the service-role client (visits are server-written only). */
export async function applyEvent(db: SupabaseClient, userId: string, event: OfficeEvent, source: "phone" | "manual") {
  const { data: open } = await db.from("office_visits").select("id, user_id, arrived_at, left_at, forgot").eq("user_id", userId)
    .is("left_at", null).maybeSingle<Visit>();
  const now = new Date().toISOString();
  for (const o of decide(open, event, Date.now())) {
    const { error } =
      o.op === "insert" ? await db.from("office_visits").insert({ user_id: userId, source })
      : o.op === "close" ? await db.from("office_visits").update({ left_at: now }).eq("id", o.id)
      : await db.from("office_visits").update({ left_at: open!.arrived_at, forgot: true }).eq("id", o.id);
    if (error && error.code !== "23505") throw error; // 23505: two "arrived" at the same instant — the first one won
  }
  // When this person's current visit started (for the phone's reply), so a repeated "arrive" shows the real time
  const { data: cur } = await db.from("office_visits").select("arrived_at").eq("user_id", userId).is("left_at", null).maybeSingle();
  return { arrivedAt: (cur?.arrived_at as string | undefined) ?? null };
}
