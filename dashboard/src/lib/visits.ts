/** Project leads: which places still need a visit (pure, tested). */
export const VISIT_RESULTS = ["yes", "maybe", "no"] as const;
export type VisitResult = (typeof VISIT_RESULTS)[number];
export type VisitFilter = "todo" | "visited" | "all";

export function byVisit<T extends { visited_on: string | null }>(items: T[], filter: VisitFilter): T[] {
  return filter === "all" ? items : items.filter((x) => (filter === "visited") === !!x.visited_on);
}
