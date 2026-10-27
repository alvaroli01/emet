/** Community points, customer visits and learning points (pure, tested). Each person's goal, set by Alvaro 2026-10-27. */
export const POINT_KINDS = ["community", "visit", "learning"] as const;
export type PointKind = (typeof POINT_KINDS)[number];
export const POINT_GOALS: Record<PointKind, number> = { community: 20, visit: 50, learning: 40 };
export const POINTS_DEADLINE = "2027-06-01";

export function pointTotals(entries: { kind: string; amount: number | string }[]): Record<PointKind, number> {
  const t: Record<PointKind, number> = { community: 0, visit: 0, learning: 0 };
  for (const e of entries) if (e.kind in t) t[e.kind as PointKind] += Number(e.amount) || 0;
  return t;
}

/** How many a week are still needed to reach the goal by the deadline (1 decimal, rounded up); null once it has passed. */
export function perWeekNeeded(done: number, goal: number, today: string, deadline = POINTS_DEADLINE): number | null {
  const days = (Date.parse(`${deadline}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 864e5;
  if (days < 0) return null;
  const left = Math.max(0, goal - done);
  return Math.ceil((left / Math.max(1, days / 7)) * 10) / 10;
}
