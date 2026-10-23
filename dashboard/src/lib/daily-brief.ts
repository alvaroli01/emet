/** The daily pop-up (pure, tested): which tasks it lists, which training weeks exist, and once-a-day showing. */

/** Training leaders are planned week by week up to this day (Alvaro, 2026-10-23). */
export const TRAINING_UNTIL = "2026-12-19";
/** Upcoming = from today up to a month ahead. */
export const BRIEF_DAYS = 30;

const DAY = 864e5;
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/** The Monday of the week a day falls in (weeks run Monday–Sunday). */
export function mondayOf(day: string): string {
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
}

/** Mondays from this week up to the week of `until`. */
export function trainingWeeks(today: string, until = TRAINING_UNTIL): string[] {
  const out: string[] = [];
  for (let w = mondayOf(today), last = mondayOf(until); w <= last; w = addDays(w, 7)) out.push(w);
  return out;
}

/** A due date (date, or timestamp read in Madrid time) as a day. */
const dayOf = (due: string) => due.length > 10 ? new Date(due).toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" }) : due;

export type BriefItem = { id: string; title: string; due: string | null; href?: string };

/** Late tasks, and tasks due from today up to a month ahead (soonest first). Tasks without a date are left out. */
export function briefTasks<T extends BriefItem>(items: T[], today: string): { late: T[]; upcoming: T[] } {
  const until = addDays(today, BRIEF_DAYS);
  const dated = items.filter((x) => x.due).map((x) => ({ x, day: dayOf(x.due!) })).sort((a, b) => a.day.localeCompare(b.day) || a.x.due!.localeCompare(b.x.due!));
  return {
    late: dated.filter((d) => d.day < today).map((d) => d.x),
    upcoming: dated.filter((d) => d.day >= today && d.day <= until).map((d) => d.x),
  };
}

export const shouldShowBrief = (lastShown: string | null, today: string) => lastShown !== today;
