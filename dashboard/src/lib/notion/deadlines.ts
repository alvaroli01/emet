import { readProp, titleOf } from "./props.ts";

/**
 * A member's Notion "deadlines" database → items for Your week, My week and My Tasks (pure, tested).
 * Columns are detected automatically (title, a date, and a status or checkbox meaning "done"); the member can change them.
 */
export type DeadlineMap = { title: string; date: string; done?: string; doneValue?: string };
export type NotionDeadline = { id: string; title: string; day: string; start: string | null; end: string | null; done: boolean; url: string };
type Schema = Record<string, { type: string; status?: { options?: { id?: string; name: string }[]; groups?: { name: string; option_ids?: string[] }[] } }>;

const DATE_HINT = /due|deadline|date|fecha|entrega|when|cuándo|termin/i;
const DONE_HINT = /done|complete|finished|hecho|terminad/i;

export function detectMap(schema: Schema): DeadlineMap | null {
  const entries = Object.entries(schema);
  const title = entries.find(([, p]) => p.type === "title")?.[0];
  const dates = entries.filter(([, p]) => p.type === "date").map(([k]) => k);
  const date = dates.find((k) => DATE_HINT.test(k)) ?? dates[0];
  if (!title || !date) return null;
  const status = entries.find(([, p]) => p.type === "status");
  if (status) {
    const s = status[1].status ?? {};
    const doneIds = s.groups?.find((g) => /complete|done/i.test(g.name))?.option_ids ?? [];
    const doneValue = s.options?.find((o) => o.id && doneIds.includes(o.id))?.name ?? s.options?.find((o) => DONE_HINT.test(o.name))?.name;
    if (doneValue) return { title, date, done: status[0], doneValue };
  }
  const boxes = entries.filter(([, p]) => p.type === "checkbox").map(([k]) => k);
  const box = boxes.find((k) => DONE_HINT.test(k)) ?? boxes[0];
  return box ? { title, date, done: box } : { title, date };
}

/** Madrid wall-clock day and time of an ISO date-time. */
function madrid(iso: string, tz: string): { day: string; time: string } {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export function toDeadlines(rows: unknown[], map: DeadlineMap, tz = "Europe/Madrid"): NotionDeadline[] {
  const out: NotionDeadline[] = [];
  for (const r of rows as { id: string; url?: string; properties?: Record<string, unknown> }[]) {
    const props = r.properties ?? {};
    const d = readProp(props[map.date]).date;
    if (!d) continue;
    const timed = d.start.length > 10;
    const s = timed ? madrid(d.start, tz) : { day: d.start.slice(0, 10), time: null };
    const e = d.end && d.end.length > 10 ? madrid(d.end, tz).time : null;
    const doneProp = map.done ? readProp(props[map.done]) : null;
    const done = !!doneProp && (doneProp.checked === true || (!!map.doneValue && doneProp.text === map.doneValue));
    out.push({ id: r.id, title: map.title in props ? readProp(props[map.title]).text.trim() || "Untitled" : titleOf(r), day: s.day, start: s.time, end: timed ? e : null, done, url: r.url ?? "" });
  }
  return out;
}
