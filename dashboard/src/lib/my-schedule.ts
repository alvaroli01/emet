import type { GEvent } from "./gcal.ts";
import type { NotionDeadline } from "./notion/deadlines.ts";

/** What Ask emet knows about the asker's own schedule: tasks, team-leader tasks, Base camp plans, Google events and Notion deadlines. */
export type ScheduleItem = {
  type: "task" | "leader_task" | "plan" | "google" | "notion"; title: string; day: string;
  start?: string; end?: string; board?: string; all_day?: boolean; done?: boolean; late?: boolean;
};

const DAY = 864e5;
const shift = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);
const STATUS = { connected: "connected", not_connected: "not connected", unreachable: "couldn't be loaded" } as const;
const MAX = 120; // keeps the prompt small enough for Groq's free per-minute limit

/** Last 14 days to the next 60. */
export function scheduleRange(today: string) {
  return { from: shift(today, -14), to: shift(today, 60) };
}

export function buildMySchedule(x: {
  today: string; from: string; to: string;
  cards: { title: string; board?: string | null; due_at: string; completed_at: string | null }[];
  subtasks: { text: string; card?: string | null; due_on: string }[];
  teamTasks: { title: string; due_on: string | null; done_at: string | null }[];
  plans: { title: string; day: string; start_time: string | null; end_time: string | null; done: boolean }[];
  google: { status: keyof typeof STATUS; events: GEvent[] };
  notion?: { status: keyof typeof STATUS; items: NotionDeadline[] };
}) {
  const { today, from, to } = x;
  const inRange = (d: string) => d >= from && d <= to;
  const rows: ScheduleItem[] = [
    ...x.cards.map((c) => { const day = c.due_at.slice(0, 10);
      return { type: "task" as const, title: c.title, board: c.board ?? undefined, day, done: !!c.completed_at, late: !c.completed_at && day < today }; }),
    ...x.subtasks.map((s) => ({ type: "task" as const, title: s.text, board: s.card ?? undefined, day: s.due_on, done: false, late: s.due_on < today })),
    ...x.teamTasks.filter((t) => t.due_on && inRange(t.due_on))
      .map((t) => ({ type: "leader_task" as const, title: t.title, day: t.due_on!, done: !!t.done_at, late: !t.done_at && t.due_on! < today })),
    ...x.plans.map((p) => ({ type: "plan" as const, title: p.title, day: p.day, start: p.start_time?.slice(0, 5), end: p.end_time?.slice(0, 5), done: p.done })),
    ...x.google.events.map((g) => ({ type: "google" as const, title: g.title, day: g.day, start: g.start ?? undefined, end: g.end ?? undefined, all_day: g.allDay })),
    ...(x.notion?.items ?? []).map((n) => ({ type: "notion" as const, title: n.title, day: n.day, start: n.start ?? undefined, end: n.end ?? undefined, done: n.done, late: !n.done && n.day < today })),
  ].filter((r) => inRange(r.day));

  const away = (d: string) => Math.abs(Date.parse(d) - Date.parse(today));
  const items = rows.sort((a, b) => away(a.day) - away(b.day)).slice(0, MAX)
    .sort((a, b) => a.day.localeCompare(b.day) || (a.start ?? "").localeCompare(b.start ?? ""));
  return { range: { from, to }, google_calendar: STATUS[x.google.status], notion: STATUS[x.notion?.status ?? "not_connected"], items };
}

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LABEL = { task: "due task", leader_task: "due team-leader task", plan: "plan", google: "Google", notion: "Notion deadline" } as const;

/** One short line per entry, e.g. "Thu 2026-10-22 10:00-11:30 Google: Marketing class" — far smaller than JSON. */
export function scheduleLines(items: ScheduleItem[]): string[] {
  return items.map((i) => {
    const when = i.all_day ? "all day" : i.start ? `${i.start}${i.end ? `-${i.end}` : ""}` : "";
    const what = `${LABEL[i.type]}${i.board ? ` (${i.board})` : ""}`;
    const flag = i.late ? " [LATE]" : i.done ? " [done]" : "";
    return `${WD[new Date(i.day + "T12:00:00Z").getUTCDay()]} ${i.day}${when ? ` ${when}` : ""} ${what}: ${i.title}${flag}`;
  });
}
