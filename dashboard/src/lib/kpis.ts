// Current value for each KPI in kpi_targets, worked out from the data in the other tabs.
// Pure functions (no database) so they're easy to test.
import { totals, onTimeRate, weekStart, type Sale, type Expense, type CardLite, type Health } from "./metrics.ts";

export type KpiTarget = { id: string; group_id: string; role_title: string | null; metric: string; target: number | null; unit: string | null; period: string };

export type KpiInputs = {
  sales: (Sale & { created_at: string; rep_id?: string | null })[];
  expenses: (Expense & { created_at: string })[];
  cards: CardLite[];
  prospects: { created_at: string; owner_id: string | null }[];
  complaints: { opened_at: string; resolved_at: string | null }[];
  followers: { platform: string; week_start: string; followers: number }[];
  designRequests: { requested_at: string; delivered_at: string | null }[];
  morale: { week_start: string; avg_score: number | string }[];
  customerReps: number;
  now?: number;
};

/** Metric name in the database → translation key + whether lower is better */
export const METRICS: Record<string, { key: string; lowerIsBetter?: boolean }> = {
  "Revenue": { key: "revenue" },
  "Profit": { key: "profit" },
  "On-time task rate": { key: "onTime" },
  "Group check-ins": { key: "checkins" },
  "Profit margin": { key: "margin" },
  "Entries logged within 24h": { key: "logged24" },
  "Complaints resolved within 48h": { key: "complaints48" },
  "New prospects per rep": { key: "prospectsPerRep" },
  "Personal sales target": { key: "personalSales" },
  "Leads generated": { key: "leads" },
  "Follower growth": { key: "followerGrowth" },
  "Design turnaround": { key: "designTurnaround", lowerIsBetter: true },
  "Friday scorecard published": { key: "scorecard" },
  "Team morale average": { key: "morale" },
};

const H = 3600_000;

export function loggedOnTime(date: string, created: string) {
  return Date.parse(created) <= Date.parse(date + "T23:59:59+02:00") + 24 * H;
}

/** Current value per metric name. null = no data yet (or not measurable automatically). */
export function computeKpis(i: KpiInputs): Record<string, number | null> {
  const now = i.now ?? Date.now();
  const week = weekStart(now);
  const t = totals(i.sales, i.expenses);
  const thisWeek = (d: string) => weekStart(d) === week;

  const entries = [...i.sales, ...i.expenses].filter((e) => thisWeek(e.date));
  const logged = entries.length ? (entries.filter((e) => loggedOnTime(e.date, e.created_at)).length / entries.length) * 100 : null;

  let inTime = 0, late = 0;
  for (const c of i.complaints) {
    const due = Date.parse(c.opened_at) + 48 * H;
    if (c.resolved_at) { if (Date.parse(c.resolved_at) <= due) inTime++; else late++; }
    else if (due < now) late++;
  }

  const newProspects = i.prospects.filter((p) => thisWeek(p.created_at)).length;

  const byPlatform = new Map<string, { week_start: string; followers: number }[]>();
  i.followers.forEach((f) => byPlatform.set(f.platform, [...(byPlatform.get(f.platform) ?? []), f]));
  let growth: number | null = null;
  for (const list of byPlatform.values()) {
    const sorted = [...list].sort((a, b) => a.week_start.localeCompare(b.week_start));
    if (sorted.length >= 2) growth = (growth ?? 0) + sorted.at(-1)!.followers - sorted.at(-2)!.followers;
  }

  const delivered = i.designRequests.filter((d) => d.delivered_at && now - Date.parse(d.delivered_at) < 30 * 24 * H);
  const turnaround = delivered.length
    ? delivered.reduce((s, d) => s + (Date.parse(d.delivered_at!) - Date.parse(d.requested_at)) / H, 0) / delivered.length
    : null;

  const onTime = onTimeRate(i.cards, now).rate;
  const lastMorale = [...i.morale].sort((a, b) => a.week_start.localeCompare(b.week_start)).at(-1);

  return {
    "Revenue": t.revenue,
    "Profit": t.profit,
    "On-time task rate": onTime === null ? null : onTime * 100,
    "Group check-ins": null,
    "Profit margin": t.margin === null ? null : t.margin * 100,
    "Entries logged within 24h": logged,
    "Complaints resolved within 48h": inTime + late ? (inTime / (inTime + late)) * 100 : null,
    "New prospects per rep": i.customerReps > 0 ? newProspects / i.customerReps : null,
    "Personal sales target": null,
    "Leads generated": newProspects,
    "Follower growth": growth,
    "Design turnaround": turnaround === null ? null : Math.round(turnaround),
    "Friday scorecard published": null,
    "Team morale average": lastMorale ? Number(lastMorale.avg_score) : null,
  };
}

/** Green / amber / red for a KPI against its target */
export function kpiStatus(metric: string, value: number | null, target: number | null): Health | null {
  if (value === null || target === null) return null;
  if (METRICS[metric]?.lowerIsBetter) {
    if (value <= target) return "good";
    if (value <= target * 1.25) return "warning";
    return "critical";
  }
  if (value >= target) return "good";
  if (value >= target * 0.85) return "warning";
  return "critical";
}
