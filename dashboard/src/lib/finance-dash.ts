import "server-only";
import { createClient } from "@/lib/supabase/server";
import { weekStart } from "@/lib/metrics";

/** Everything the Finance dashboard draws, in one load (only rows the viewer may read). */
export type FinanceDash = {
  total: number; changePct: number | null; monthIn: number; monthOut: number;
  methods: { key: string; amount: number; spark: number[]; changePct: number | null }[];
  daily: { day: string; in: number; out: number }[]; in30: number;
  weekOut: number[]; todayIdx: number; weekOutTotal: number;
  recent: { id: string; kind: "sale" | "expense"; description: string; amount: number; date: string; created_at: string }[];
  flow: { nodes: { name: string }[]; links: { source: number; target: number; value: number }[] };
  heat: number[]; net30: number;
  pendingClaims: number;
};

const DAY = 864e5;
const n = (v: unknown) => Number(v ?? 0) || 0;

export async function loadFinanceDash(today: string): Promise<FinanceDash> {
  const sb = await createClient();
  const [s, e, p, c] = await Promise.all([
    sb.from("sales").select("id, date, amount, payment_method, heard_about, project_id, description, created_at, reverses_id"),
    sb.from("expenses").select("id, date, amount, payment_method, category, description, created_at, reverses_id"),
    sb.from("projects").select("id, name"),
    sb.from("expense_claims").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const sales = s.data ?? [], exps = e.data ?? [], projects = p.data ?? [];
  const month = today.slice(0, 7);
  const prevMonth = new Date(Date.parse(month + "-01T00:00:00Z") - DAY).toISOString().slice(0, 7);
  const inMonth = (rows: { date: string; amount: unknown }[], m: string) => rows.filter((r) => r.date.startsWith(m)).reduce((a, r) => a + n(r.amount), 0);
  const total = sales.reduce((a, r) => a + n(r.amount), 0);
  const monthIn = inMonth(sales, month), prevIn = inMonth(sales, prevMonth);
  const pct = (a: number, b: number) => (b > 0 ? (a - b) / b : null);

  // Payment methods: this month, change vs last month, 8-week sparkline
  const weeks = Array.from({ length: 8 }, (_, i) => new Date(Date.parse(weekStart(Date.now()) + "T00:00:00Z") - (7 - i) * 7 * DAY).toISOString().slice(0, 10));
  const methods = ["cash", "bizum", "card", "transfer"].map((key) => {
    const rows = sales.filter((r) => (r.payment_method ?? "other") === key);
    return {
      key, amount: inMonth(rows, month), changePct: pct(inMonth(rows, month), inMonth(rows, prevMonth)),
      spark: weeks.map((w) => rows.filter((r) => weekStart(r.date) === w).reduce((a, r) => a + n(r.amount), 0)),
    };
  });

  // Last 30 days in vs out
  const days = Array.from({ length: 30 }, (_, i) => new Date(Date.parse(today + "T00:00:00Z") - (29 - i) * DAY).toISOString().slice(0, 10));
  // Rolling 7-day totals: smooth waves that still show real ups and downs
  const sumRange = (rows: { date: string; amount: unknown }[], end: string) => {
    const from = new Date(Date.parse(end + "T00:00:00Z") - 6 * DAY).toISOString().slice(0, 10);
    return rows.filter((r) => r.date >= from && r.date <= end).reduce((a, r) => a + n(r.amount), 0);
  };
  const daily = days.map((d) => ({ day: d, in: sumRange(sales, d), out: sumRange(exps, d) }));

  // This week's spending per weekday
  const ws = weekStart(Date.now());
  const weekOut = Array.from({ length: 7 }, (_, i) => { const d = new Date(Date.parse(ws + "T00:00:00Z") + i * DAY).toISOString().slice(0, 10); return exps.filter((r) => r.date === d).reduce((a, r) => a + n(r.amount), 0); });
  const todayIdx = Math.min(6, Math.floor((Date.parse(today + "T00:00:00Z") - Date.parse(ws + "T00:00:00Z")) / DAY));

  const recent = [
    ...sales.map((r) => ({ id: r.id, kind: "sale" as const, description: r.description, amount: n(r.amount), date: r.date, created_at: r.created_at })),
    ...exps.map((r) => ({ id: r.id, kind: "expense" as const, description: r.description, amount: -n(r.amount), date: r.date, created_at: r.created_at })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6);

  // Money flow: how they found us → how they paid → which project
  const nodes: { name: string }[] = []; const idx = new Map<string, number>();
  const node = (k: string) => { if (!idx.has(k)) { idx.set(k, nodes.length); nodes.push({ name: k }); } return idx.get(k)!; };
  const agg = new Map<string, number>();
  for (const r of sales.filter((x) => n(x.amount) > 0 && !x.reverses_id)) {
    const from = `src:${r.heard_about ?? "unknown"}`, via = `pay:${r.payment_method ?? "other"}`;
    const proj = `prj:${projects.find((x) => x.id === r.project_id)?.name ?? "none"}`;
    agg.set(`${from}|${via}`, (agg.get(`${from}|${via}`) ?? 0) + n(r.amount));
    agg.set(`${via}|${proj}`, (agg.get(`${via}|${proj}`) ?? 0) + n(r.amount));
  }
  const links = [...agg].map(([k, v]) => { const [a, b] = k.split("|"); return { source: node(a), target: node(b), value: Math.round(v * 100) / 100 }; });

  // Net cashflow, last 35 days (oldest first)
  const heatDays = Array.from({ length: 35 }, (_, i) => new Date(Date.parse(today + "T00:00:00Z") - (34 - i) * DAY).toISOString().slice(0, 10));
  const heat = heatDays.map((d) => sales.filter((r) => r.date === d).reduce((a, r) => a + n(r.amount), 0) - exps.filter((r) => r.date === d).reduce((a, r) => a + n(r.amount), 0));

  return {
    in30: sales.filter((r) => r.date >= days[0]).reduce((a, r) => a + n(r.amount), 0),
    total, changePct: pct(monthIn, prevIn), monthIn, monthOut: inMonth(exps, month), methods, daily, weekOut, todayIdx,
    weekOutTotal: weekOut.reduce((a, b) => a + b, 0), recent, flow: { nodes, links }, heat, net30: heat.slice(-30).reduce((a, b) => a + b, 0),
    pendingClaims: c.count ?? 0,
  };
}
