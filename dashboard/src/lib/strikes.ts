/** Strikes (pure, tested). The database computes weight/fine and creates punishments; this mirrors it for the screens. */
export const STRIKE_KINDS = ["late_tasks", "sleeping", "phone", "late_arrival", "missed_validation", "missed_customer_deadline"] as const;
export type StrikeKind = (typeof STRIKE_KINDS)[number];
export const PUNISHMENT_EUR = 75;

export const weightOf = (k: string) => (k === "missed_validation" || k === "missed_customer_deadline" ? 3 : 1);
export const fineOf = (k: string) => (k === "late_arrival" ? 3 : 0);

/** The first day of the quarter a day falls in (strikes reset every 3 months). */
export function quarterOf(day: string): string {
  const [y, m] = day.split("-").map(Number);
  return `${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, "0")}-01`;
}
const nextQuarter = (q: string) => { const [y, m] = q.split("-").map(Number); return m === 10 ? `${y + 1}-01-01` : `${y}-${String(m + 3).padStart(2, "0")}-01`; };

export type StrikeRow = { kind: string; weight: number; fine: number | string; paid_at: string | null; happened_on: string };
export function strikeSummary(rows: StrikeRow[], today: string) {
  const q = quarterOf(today);
  const total = rows.filter((r) => quarterOf(r.happened_on) === q).reduce((a, r) => a + r.weight, 0);
  return {
    total,
    toNext: 3 - (total % 3),
    unpaid: rows.filter((r) => !r.paid_at).reduce((a, r) => a + Number(r.fine), 0),
    reset: nextQuarter(q),
  };
}
