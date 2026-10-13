// Pure calculations for the Overview. No database or React here, so they can be unit-tested.

export const GOAL = { revenue: 30000, profit: 15000, minMargin: 0.5, onTimeTarget: 0.85 } as const;
export const START = "2026-10-13";         // emet started
export const DEADLINE = "2027-06-30";      // end of June 2027

export type Sale = { date: string; amount: number | string; cost: number | string };
export type Expense = { date: string; amount: number | string };
export type CardLite = { board_id: string; due_at: string | null; completed_at: string | null };

const DAY = 86_400_000;
const n = (v: number | string | null | undefined) => Number(v ?? 0) || 0;
const utc = (d: string) => Date.parse(d.length === 10 ? d + "T00:00:00Z" : d);

/** Monday (UTC) of the week a date falls in, as YYYY-MM-DD */
export function weekStart(d: string | number): string {
  const t = typeof d === "number" ? d : utc(d);
  const day = new Date(t).getUTCDay();          // 0 = Sunday
  const monday = t - ((day + 6) % 7) * DAY;
  return new Date(monday).toISOString().slice(0, 10);
}

export function totals(sales: Sale[], expenses: Expense[]) {
  const revenue = sales.reduce((s, x) => s + n(x.amount), 0);
  const cogs = sales.reduce((s, x) => s + n(x.cost), 0);
  const spend = expenses.reduce((s, x) => s + n(x.amount), 0);
  const profit = revenue - cogs - spend;
  return { revenue, cogs, expenses: spend, profit, margin: revenue > 0 ? profit / revenue : null };
}

/** Days/weeks left, average pace so far and pace needed from now on (information only — no fixed target). */
export function pace(revenue: number, profit: number, now = Date.now()) {
  const start = utc(START);
  const end = utc(DEADLINE) + DAY;              // through the end of 30 June
  const daysLeft = Math.max(0, Math.ceil((end - now) / DAY));
  const weeksElapsed = Math.max(1, (now - start) / (7 * DAY));
  const weeksLeft = daysLeft / 7;
  return {
    daysLeft,
    weeksLeft: Math.floor(weeksLeft),
    revenuePerWeekSoFar: revenue / weeksElapsed,
    profitPerWeekSoFar: profit / weeksElapsed,
    revenuePerWeekNeeded: weeksLeft > 0 ? Math.max(0, GOAL.revenue - revenue) / weeksLeft : 0,
    profitPerWeekNeeded: weeksLeft > 0 ? Math.max(0, GOAL.profit - profit) / weeksLeft : 0,
  };
}

/** On-time rate: cards with a due date that were finished by it, out of those finished or already overdue. */
export function onTimeRate(cards: CardLite[], now = Date.now()) {
  let onTime = 0, late = 0, overdueOpen = 0;
  for (const c of cards) {
    if (!c.due_at) continue;
    const due = utc(c.due_at);
    if (c.completed_at) {
      if (utc(c.completed_at) <= due) onTime++; else late++;
    } else if (due < now) {
      late++; overdueOpen++;
    }
  }
  const counted = onTime + late;
  return { rate: counted ? onTime / counted : null, onTime, late, overdueOpen, counted };
}

export type WeekPoint = { week: string; revenue: number; profit: number; cumRevenue: number; cumProfit: number; evenPace: number };

/** One point per week from the first week shown up to this week. Cumulative values always count from the start. */
export function weekly(sales: Sale[], expenses: Expense[], fromWeeks: number | "all", now = Date.now()): WeekPoint[] {
  const byWeek = new Map<string, { revenue: number; profit: number }>();
  const add = (w: string, r: number, p: number) => {
    const cur = byWeek.get(w) ?? { revenue: 0, profit: 0 };
    byWeek.set(w, { revenue: cur.revenue + r, profit: cur.profit + p });
  };
  sales.forEach((s) => add(weekStart(s.date), n(s.amount), n(s.amount) - n(s.cost)));
  expenses.forEach((e) => add(weekStart(e.date), 0, -n(e.amount)));

  const first = weekStart(START);
  const last = weekStart(now);
  const totalSpan = utc(DEADLINE) - utc(START);
  const points: WeekPoint[] = [];
  let cumR = 0, cumP = 0;
  for (let t = utc(first); t <= utc(last); t += 7 * DAY) {
    const w = new Date(t).toISOString().slice(0, 10);
    const v = byWeek.get(w) ?? { revenue: 0, profit: 0 };
    cumR += v.revenue; cumP += v.profit;
    const weekEnd = Math.min(t + 7 * DAY, utc(DEADLINE));
    const evenPace = Math.round(GOAL.revenue * Math.max(0, Math.min(1, (weekEnd - utc(START)) / totalSpan)));
    points.push({ week: w, revenue: v.revenue, profit: v.profit, cumRevenue: cumR, cumProfit: cumP, evenPace });
  }
  return fromWeeks === "all" ? points : points.slice(-fromWeeks);
}

export type Health = "good" | "warning" | "critical";

/** Green / amber / red for a group, from overdue cards, open blockers and on-time rate. */
export function groupHealth(overdue: number, blockers: number, rate: number | null): Health {
  if (overdue >= 3 || blockers >= 3 || (rate !== null && rate < 0.7)) return "critical";
  if (overdue > 0 || blockers > 0 || (rate !== null && rate < GOAL.onTimeTarget)) return "warning";
  return "good";
}
