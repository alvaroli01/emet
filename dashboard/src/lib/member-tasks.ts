/** A member's tasks on their page (pure, tested): what they still have to do, and what wasn't finished on time. */
export type MemberTaskItem = { id: string; title: string; due: string | null; done_at: string | null; href?: string };

/** A due date as a moment: date-only due dates (team tasks) count until the end of that day in Madrid (≈ 21:59 UTC). */
const dueMs = (due: string) => Date.parse(due.length > 10 ? due : `${due}T21:59:00Z`);

export function memberTaskLists<T extends MemberTaskItem>(items: T[], now = Date.now()) {
  const open = items.filter((x) => !x.done_at);
  const todo = [...open].sort((a, b) => (a.due ? dueMs(a.due) : Infinity) - (b.due ? dueMs(b.due) : Infinity));
  const late = items.flatMap((x) => {
    if (!x.due) return [];
    const due = dueMs(x.due), end = x.done_at ? Date.parse(x.done_at) : now;
    return end > due ? [{ ...x, done: !!x.done_at, daysLate: Math.max(1, Math.round((end - due) / 864e5)) }] : [];
  });
  // Finished late first, then still open past the due date
  return { todo, late: [...late.filter((x) => x.done), ...late.filter((x) => !x.done)] };
}
