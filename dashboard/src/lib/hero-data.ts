import "server-only";
import { createClient } from "@/lib/supabase/server";
import { totals, weekStart } from "@/lib/metrics";

/**
 * Numbers for the hero at the top of each group page: what needs the viewer, the 3 numbers that matter,
 * and a weekly series for the 3D terrain. Counts only — the page turns them into sentences in the viewer's language.
 */
export type Need = { key: string; count: number; tab?: string; href?: string; tone: "ok" | "warn" | "bad" | "info"; values?: Record<string, string | number> };
export type GroupHero = { needs: Need[]; stats: { key: string; value: number | null; kind: "eur" | "num" | "pct" }[]; series: { label: string; value: number }[]; seriesKind: "eur" | "num"; seriesKey: string };

const DAY = 864e5;
/** The last `n` Monday-weeks (oldest first) as YYYY-MM-DD. */
export function lastWeeks(n: number, now = Date.now()) {
  const cur = Date.parse(weekStart(now) + "T00:00:00Z");
  return Array.from({ length: n }, (_, i) => new Date(cur - (n - 1 - i) * 7 * DAY).toISOString().slice(0, 10));
}
export function perWeek(rows: { date: string; value: number }[], weeks: string[]) {
  const m = new Map(weeks.map((w) => [w, 0]));
  for (const r of rows) { const w = weekStart(r.date); if (m.has(w)) m.set(w, m.get(w)! + r.value); }
  return weeks.map((w) => ({ week: w, value: Math.round(m.get(w)! * 100) / 100 }));
}

export async function groupHero(slug: string, meId: string, groupId: string, today: string): Promise<GroupHero> {
  const sb = await createClient();
  const weeks = lastWeeks(10);
  const since = weeks[0];
  const { data: board } = await sb.from("boards").select("id").eq("slug", slug).maybeSingle();
  const { data: myCards } = board ? await sb.from("cards").select("id, due_at, card_assignees!inner(user_id)").eq("board_id", board.id).eq("card_assignees.user_id", meId).is("completed_at", null) : { data: [] };
  const overdue = (myCards ?? []).filter((c) => c.due_at && c.due_at.slice(0, 10) < today).length;
  const open = (myCards ?? []).length;
  const needs: Need[] = [];
  if (overdue) needs.push({ key: "overdue", count: overdue, tab: "board", tone: "bad" });
  else if (open) needs.push({ key: "myCards", count: open, tab: "board", tone: "info" });
  const { count: blockers } = await sb.from("blockers").select("id", { count: "exact", head: true }).eq("group_id", groupId).neq("status", "resolved");
  if (blockers) needs.push({ key: "blockers", count: blockers, tab: "blockers", tone: "warn" });

  if (slug === "finance") {
    const [sales, expenses, claims, inv, locks] = await Promise.all([
      sb.from("sales").select("date, amount, cost"), sb.from("expenses").select("date, amount"),
      sb.from("expense_claims").select("id", { count: "exact", head: true }).eq("status", "pending"),
      sb.from("inventory").select("stock, low_stock"), sb.from("month_locks").select("month"),
    ]);
    const s = sales.data ?? [], e = expenses.data ?? [];
    const t = totals(s, e);
    if (claims.count) needs.unshift({ key: "claims", count: claims.count, tab: "books", tone: "warn" });
    const low = (inv.data ?? []).filter((i) => i.low_stock != null && Number(i.stock) <= Number(i.low_stock)).length;
    if (low) needs.push({ key: "lowStock", count: low, tab: "stock", tone: "warn" });
    const prev = new Date(Date.parse(today.slice(0, 7) + "-01T00:00:00Z") - DAY).toISOString().slice(0, 7);
    if (Number(today.slice(8, 10)) >= 3 && !(locks.data ?? []).some((l) => String(l.month).startsWith(prev))) needs.push({ key: "closeMonth", count: 1, tab: "books", tone: "info", values: { month: prev } });
    return {
      needs, stats: [{ key: "revenue", value: t.revenue, kind: "eur" }, { key: "profit", value: t.profit, kind: "eur" }, { key: "margin", value: t.margin, kind: "pct" }],
      series: perWeek(s.map((x) => ({ date: x.date, value: Number(x.amount) || 0 })), weeks).map((w) => ({ label: w.week, value: w.value })), seriesKind: "eur", seriesKey: "revenuePerWeek",
    };
  }

  if (slug === "marketing") {
    const [items, metrics, briefs, inq, clicks] = await Promise.all([
      sb.from("content_items").select("id, status, planned_for, posted_at, owner_id"), sb.from("content_metrics").select("content_id, age_hours, views"),
      sb.from("briefs").select("id", { count: "exact", head: true }).eq("status", "draft"),
      sb.from("inquiries").select("id", { count: "exact", head: true }).gte("date", new Date(Date.now() - 30 * DAY).toISOString().slice(0, 10)),
      sb.from("go_clicks").select("id", { count: "exact", head: true }).gte("at", new Date(Date.now() - 7 * DAY).toISOString()),
    ]);
    const it = items.data ?? [], ms = metrics.data ?? [];
    const toLog = it.filter((c) => c.owner_id === meId && c.posted_at).reduce((n, c) => n + [24, 48, 168].filter((a) => Date.parse(c.posted_at!) + a * 36e5 <= Date.now() && !ms.some((m) => m.content_id === c.id && m.age_hours === a)).length, 0);
    if (toLog) needs.unshift({ key: "toLog", count: toLog, tab: "my-week", tone: "warn" });
    const due = it.filter((c) => c.status !== "posted" && c.planned_for && c.planned_for <= new Date(Date.now() + 7 * DAY).toISOString().slice(0, 10)).length;
    if (due) needs.push({ key: "contentDue", count: due, tab: "content", tone: "info" });
    if (briefs.count) needs.push({ key: "briefsDraft", count: briefs.count, tab: "briefs", tone: "info" });
    const posted7 = it.filter((c) => c.posted_at && Date.parse(c.posted_at) >= Date.now() - 7 * DAY).length;
    const views = it.filter((c) => c.posted_at && c.posted_at.slice(0, 10) >= since).map((c) => {
      const best = [168, 48, 24].map((a) => ms.find((m) => m.content_id === c.id && m.age_hours === a)).find(Boolean);
      return { date: c.posted_at!.slice(0, 10), value: Number(best?.views ?? 0) };
    });
    const hasViews = views.some((v) => v.value > 0);
    return {
      needs, stats: [{ key: "posts7", value: posted7, kind: "num" }, { key: "inquiries30", value: inq.count ?? 0, kind: "num" }, { key: "clicks7", value: clicks.count ?? 0, kind: "num" }],
      series: perWeek(hasViews ? views : views.map((v) => ({ ...v, value: 1 })), weeks).map((w) => ({ label: w.week, value: w.value })), seriesKind: "num", seriesKey: hasViews ? "viewsPerWeek" : "postsPerWeek",
    };
  }

  if (slug === "customer") {
    const [prospects, complaints, leads] = await Promise.all([
      sb.from("prospects").select("stage, created_at, owner_id, updated_at"),
      sb.from("complaints").select("id", { count: "exact", head: true }).neq("status", "resolved"),
      sb.from("scout_leads").select("id", { count: "exact", head: true }).eq("owner_id", meId).lte("next_step_at", today).not("status", "in", "(won,lost,ignored)"),
    ]);
    const ps = prospects.data ?? [];
    if (complaints.count) needs.unshift({ key: "complaints", count: complaints.count, tab: "complaints", tone: "bad" });
    const stale = ps.filter((p) => p.owner_id === meId && ["new", "contacted", "interested"].includes(p.stage) && Date.parse(p.updated_at) < Date.now() - 5 * DAY).length;
    if (stale) needs.push({ key: "followUp", count: stale, tab: "sales", tone: "warn" });
    if (leads.count) needs.push({ key: "scoutDue", count: leads.count, href: "/scout", tone: "info" });
    return {
      needs, stats: [{ key: "openProspects", value: ps.filter((p) => !["won", "lost"].includes(p.stage)).length, kind: "num" }, { key: "won", value: ps.filter((p) => p.stage === "won").length, kind: "num" }, { key: "openComplaints", value: complaints.count ?? 0, kind: "num" }],
      series: perWeek(ps.map((p) => ({ date: p.created_at.slice(0, 10), value: 1 })), weeks).map((w) => ({ label: w.week, value: w.value })), seriesKind: "num", seriesKey: "prospectsPerWeek",
    };
  }

  // Communications and Team leader: the team's rhythm — decisions, morale, cards finished
  const [decisions, morale, done, allOverdue] = await Promise.all([
    sb.from("decisions").select("id", { count: "exact", head: true }).gte("date", new Date(Date.now() - 30 * DAY).toISOString().slice(0, 10)),
    sb.from("morale_checks").select("score, user_id, week_start").eq("week_start", weekStart(Date.now())),
    sb.from("cards").select("completed_at").not("completed_at", "is", null).gte("completed_at", since),
    sb.from("cards").select("id", { count: "exact", head: true }).is("completed_at", null).lt("due_at", today),
  ]);
  if (slug === "communications" && !(morale.data ?? []).some((m) => m.user_id === meId)) needs.push({ key: "morale", count: 1, tab: "morale", tone: "info" });
  if (slug === "team-leader" && allOverdue.count) needs.push({ key: "teamOverdue", count: allOverdue.count, href: "/board", tone: "warn" });
  const ms = (morale.data ?? []).map((m) => Number(m.score)).filter((n) => n > 0);
  return {
    needs, stats: [{ key: "decisions30", value: decisions.count ?? 0, kind: "num" }, { key: "moraleAvg", value: ms.length ? Math.round((ms.reduce((a, b) => a + b, 0) / ms.length) * 10) / 10 : null, kind: "num" }, { key: "teamOverdue", value: allOverdue.count ?? 0, kind: "num" }],
    series: perWeek((done.data ?? []).map((c) => ({ date: c.completed_at!.slice(0, 10), value: 1 })), weeks).map((w) => ({ label: w.week, value: w.value })), seriesKind: "num", seriesKey: "doneTasksPerWeek",
  };
}
