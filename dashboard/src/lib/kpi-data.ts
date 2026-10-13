import { createClient } from "@/lib/supabase/server";
import { computeKpis, type KpiTarget } from "@/lib/kpis";
import type { CardLite } from "@/lib/metrics";

/** Loads everything the KPIs need and returns targets with current values. */
export async function loadKpis(customerGroupId: string | undefined) {
  const supabase = await createClient();
  const [targets, sales, expenses, cards, prospects, complaints, followers, designs, morale, reps] = await Promise.all([
    supabase.from("kpi_targets").select("*").order("metric").returns<KpiTarget[]>(),
    supabase.from("sales").select("date, amount, cost, created_at, rep_id"),
    supabase.from("expenses").select("date, amount, created_at"),
    supabase.from("cards").select("board_id, due_at, completed_at").returns<CardLite[]>(),
    supabase.from("prospects").select("created_at, owner_id"),
    supabase.from("complaints").select("opened_at, resolved_at"),
    supabase.from("follower_snapshots").select("platform, week_start, followers"),
    supabase.from("design_requests").select("requested_at, delivered_at"),
    supabase.rpc("morale_weekly"),
    customerGroupId
      ? supabase.from("profiles").select("id", { count: "exact", head: true }).eq("group_id", customerGroupId).eq("active", true)
      : Promise.resolve({ count: 0 }),
  ]);

  const values = computeKpis({
    sales: sales.data ?? [],
    expenses: expenses.data ?? [],
    cards: cards.data ?? [],
    prospects: prospects.data ?? [],
    complaints: complaints.data ?? [],
    followers: followers.data ?? [],
    designRequests: designs.data ?? [],
    morale: (morale.data as { week_start: string; avg_score: number }[] | null) ?? [],
    customerReps: reps.count ?? 0,
  });

  return (targets.data ?? []).map((k) => ({ ...k, current: values[k.metric] ?? null }));
}

export type KpiWithValue = Awaited<ReturnType<typeof loadKpis>>[number];
