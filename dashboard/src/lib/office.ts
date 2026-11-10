/** Office check-in: what to do when a phone says "arrived" / "left", and how many hours a person was in. */
import type { SupabaseClient } from "@supabase/supabase-js";

export type OfficeEvent = "arrive" | "leave";
export type Visit = { id: string; user_id: string; arrived_at: string; left_at: string | null; forgot: boolean };
export type Op = { op: "insert" } | { op: "close"; id: string } | { op: "forgot"; id: string } | { op: "reopen"; id: string };

const H = 3600e3;
export const STALE_MS = 16 * H;   // still "in" after 16 h → they forgot to check out; that visit counts 0 h
export const REJOIN_MS = 15 * 60e3; // left and back within 15 min (GPS wobble, a coffee) → same visit

export function decide(open: Visit | null, lastClosed: Visit | null, event: OfficeEvent, now: number): Op[] {
  const stale = open && now - Date.parse(open.arrived_at) >= STALE_MS;
  if (event === "arrive") {
    if (open && !stale) return [];
    if (open) return [{ op: "forgot", id: open.id }, { op: "insert" }];
    if (lastClosed?.left_at && !lastClosed.forgot && now - Date.parse(lastClosed.left_at) < REJOIN_MS) return [{ op: "reopen", id: lastClosed.id }];
    return [{ op: "insert" }];
  }
  if (!open) return [];
  return [stale ? { op: "forgot", id: open.id } : { op: "close", id: open.id }];
}

/** Hours of one visit: open ones count up to now; forgotten or stale ones count 0. */
export function visitMs(v: Visit, now: number): number {
  if (v.forgot) return 0;
  const start = Date.parse(v.arrived_at);
  if (!v.left_at) return now - start >= STALE_MS ? 0 : Math.max(0, now - start);
  return Math.max(0, Date.parse(v.left_at) - start);
}

export const isInNow = (v: Visit, now: number) => !v.left_at && !v.forgot && now - Date.parse(v.arrived_at) < STALE_MS;

/** "7h 05m" */
export const hm = (ms: number) => { const m = Math.round(ms / 60e3); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`; };

/** "09:12", Spanish time */
export const madridTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });

/** Midnight in Spain on that date ("2026-11-10" → "2026-11-09T23:00:00.000Z"), as an ISO instant. */
export function madridMidnight(day: string): string {
  const noon = Date.parse(`${day}T12:00:00Z`);
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hourCycle: "h23" }).format(noon));
  return new Date(Date.parse(`${day}T00:00:00Z`) - (h - 12) * 3600e3).toISOString();
}

/** Apply a phone/button event for one person. `db` must be the service-role client (visits are server-written only). */
export async function applyEvent(db: SupabaseClient, userId: string, event: OfficeEvent, source: "phone" | "manual") {
  const { data } = await db.from("office_visits").select("id, user_id, arrived_at, left_at, forgot").eq("user_id", userId)
    .order("arrived_at", { ascending: false }).limit(2).returns<Visit[]>();
  const rows = data ?? [];
  const open = rows.find((v) => !v.left_at) ?? null;
  const lastClosed = rows.find((v) => v.left_at) ?? null;
  const now = new Date().toISOString();
  for (const o of decide(open, lastClosed, event, Date.now())) {
    const { error } =
      o.op === "insert" ? await db.from("office_visits").insert({ user_id: userId, source })
      : o.op === "close" ? await db.from("office_visits").update({ left_at: now }).eq("id", o.id)
      : o.op === "forgot" ? await db.from("office_visits").update({ left_at: open!.arrived_at, forgot: true }).eq("id", o.id)
      : await db.from("office_visits").update({ left_at: null }).eq("id", o.id);
    if (error && error.code !== "23505") throw error; // 23505: two "arrived" at the same instant — the first one won
  }
  return event;
}
