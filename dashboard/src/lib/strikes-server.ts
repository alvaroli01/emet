import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Strike = { id: string; user_id: string; kind: string; weight: number; fine: number | string; paid_at: string | null; happened_on: string; note: string | null; given_by: string | null; created_at: string };
export type Punishment = { id: string; user_id: string; period_start: string; number: number; told_on: string; due_on: string; done_at: string | null };
export type StrikesData = { strikes: Strike[]; punishments: Punishment[] };

/** Strikes and punishments of the last 12 months (one person, or everyone). Everyone may read them. */
export async function loadStrikes(userId?: string): Promise<StrikesData> {
  const sb = await createClient();
  const since = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
  let s = sb.from("strikes").select("*").gte("happened_on", since).order("happened_on", { ascending: false }).order("created_at", { ascending: false });
  let p = sb.from("strike_punishments").select("*").gte("period_start", since.slice(0, 8) + "01").order("told_on", { ascending: false });
  if (userId) { s = s.eq("user_id", userId); p = p.eq("user_id", userId); }
  const [strikes, punishments] = await Promise.all([s.returns<Strike[]>(), p.returns<Punishment[]>()]);
  return { strikes: strikes.data ?? [], punishments: punishments.data ?? [] };
}
