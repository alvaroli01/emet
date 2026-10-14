import type { SupabaseClient } from "@supabase/supabase-js";
import { totals, pace, onTimeRate, weekStart, type Sale, type Expense, type CardLite } from "@/lib/metrics";

/** The numbers behind the automatic Friday report. Stored as data, rendered in each reader's language. */
export type WeeklyReport = {
  week: string;
  week_revenue: number; week_profit: number; week_margin: number | null; week_sales: number; week_expenses: number;
  total_revenue: number; total_profit: number; days_left: number; revenue_per_week_needed: number;
  tasks_done: number; tasks_overdue: number; on_time_rate: number | null;
  blockers_open: number; meetings: number; ideas: number; top_idea: { title: string; score: number } | null;
};

export async function buildWeeklyReport(db: SupabaseClient, now = Date.now()): Promise<WeeklyReport> {
  const week = weekStart(now);
  const weekEnd = new Date(Date.parse(week) + 7 * 864e5).toISOString().slice(0, 10);
  const [sales, expenses, cards, blockers, meetings, ideas] = await Promise.all([
    db.from("sales").select("date, amount, cost").returns<Sale[]>(),
    db.from("expenses").select("date, amount").returns<Expense[]>(),
    db.from("cards").select("board_id, due_at, completed_at").returns<CardLite[]>(),
    db.from("blockers").select("id", { count: "exact", head: true }).eq("status", "open"),
    db.from("meetings").select("id", { count: "exact", head: true }).gte("meeting_date", week).lt("meeting_date", weekEnd),
    db.from("lab_ideas").select("title, score, created_at").gte("created_at", week),
  ]);
  const s = sales.data ?? [], e = expenses.data ?? [], c = cards.data ?? [];
  const ws = s.filter((x) => weekStart(x.date) === week), we = e.filter((x) => weekStart(x.date) === week);
  const w = totals(ws, we), all = totals(s, e), p = pace(all.revenue, all.profit, now), ot = onTimeRate(c, now);
  const doneThisWeek = c.filter((x) => x.completed_at && x.completed_at.slice(0, 10) >= week && x.completed_at.slice(0, 10) < weekEnd).length;
  const top = (ideas.data ?? []).filter((i) => i.score !== null).sort((a, b) => b.score - a.score)[0];
  return {
    week, week_revenue: w.revenue, week_profit: w.profit, week_margin: w.margin, week_sales: ws.length, week_expenses: w.expenses,
    total_revenue: all.revenue, total_profit: all.profit, days_left: p.daysLeft, revenue_per_week_needed: p.revenuePerWeekNeeded,
    tasks_done: doneThisWeek, tasks_overdue: ot.overdueOpen, on_time_rate: ot.rate,
    blockers_open: blockers.count ?? 0, meetings: meetings.count ?? 0, ideas: (ideas.data ?? []).length,
    top_idea: top ? { title: top.title, score: top.score } : null,
  };
}
