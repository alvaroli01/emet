/**
 * Today's Sales / Tasks / Money cards for any week or month (pure, tested).
 * A week = 7 days (Monday first); a month = its weeks, clipped to the month. Future periods show tasks due.
 */
export type Unit = "week" | "month";
export type Bucket = { start: string; end: string };
export type Period = { unit: Unit; offset: number; from: string; to: string; prevFrom: string; prevTo: string; buckets: Bucket[]; prevBuckets: Bucket[]; future: boolean };
export type Channel = "stall" | "online" | "other";
export type Series = {
  channels: Record<Channel, number[]>; salesCount: number;
  money: number[]; moneyTotal: number;
  tasks: { mode: "done" | "due"; this: number[]; prev: number[]; done: number };
};

const DAY = 864e5;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const at = (d: string) => Date.parse(d + "T00:00:00Z");
const add = (d: string, n: number) => iso(at(d) + n * DAY);
const monday = (d: string) => add(d, -((new Date(at(d)).getUTCDay() + 6) % 7));

function weeksOf(from: string, to: string): Bucket[] {
  const out: Bucket[] = [];
  for (let s = from; s <= to;) {
    const sunday = add(monday(s), 6);
    const e = sunday < to ? sunday : to;
    out.push({ start: s, end: e });
    s = add(e, 1);
  }
  return out;
}

function span(unit: Unit, offset: number, today: string): { from: string; to: string; buckets: Bucket[] } {
  if (unit === "week") {
    const from = add(monday(today), offset * 7);
    return { from, to: add(from, 6), buckets: Array.from({ length: 7 }, (_, i) => ({ start: add(from, i), end: add(from, i) })) };
  }
  const d = new Date(at(today));
  const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1));
  const from = iso(first.getTime());
  const to = iso(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
  return { from, to, buckets: weeksOf(from, to) };
}

export function period(unit: Unit, offset: number, today: string): Period {
  const cur = span(unit, offset, today), prev = span(unit, offset - 1, today);
  return { unit, offset, from: cur.from, to: cur.to, prevFrom: prev.from, prevTo: prev.to, buckets: cur.buckets, prevBuckets: prev.buckets, future: cur.from > today };
}

const bucketOf = (day: string, buckets: Bucket[]) => buckets.findIndex((b) => day >= b.start && day <= b.end);
const running = (xs: number[]) => xs.map((_, i) => xs.slice(0, i + 1).reduce((a, b) => a + b, 0));

export function cardSeries(p: Period, _today: string, data: { sales: { date: string; amount: number; channel: Channel }[]; done: string[]; due: string[] }): Series {
  const n = p.buckets.length;
  const zero = () => Array<number>(n).fill(0);
  const channels: Record<Channel, number[]> = { stall: zero(), online: zero(), other: zero() };
  const money = zero();
  let salesCount = 0;
  for (const s of data.sales) {
    const i = bucketOf(s.date.slice(0, 10), p.buckets);
    if (i < 0 || !(Number(s.amount) > 0)) continue;
    channels[s.channel][i]++; money[i] += Number(s.amount); salesCount++;
  }
  const count = (stamps: string[], buckets: Bucket[]) => {
    const c = Array<number>(buckets.length).fill(0);
    for (const t of stamps) { const i = bucketOf(t.slice(0, 10), buckets); if (i >= 0) c[i]++; }
    return c;
  };
  let tasks: Series["tasks"];
  if (p.future) {
    const due = count(data.due, p.buckets);
    tasks = { mode: "due", this: due, prev: zero(), done: due.reduce((a, b) => a + b, 0) };
  } else {
    const mine = running(count(data.done, p.buckets)), prev = running(count(data.done, p.prevBuckets));
    tasks = { mode: "done", this: mine, prev: Array.from({ length: n }, (_, i) => prev[Math.min(i, prev.length - 1)] ?? 0), done: mine[n - 1] ?? 0 };
  }
  return { channels, salesCount, money, moneyTotal: money.reduce((a, b) => a + b, 0), tasks };
}

/** Same channel rule as the Today cards: stall, online (Instagram/TikTok/WhatsApp/web) or other. */
export function channelOf(x: { heard_about: string | null; channel: string | null }): Channel {
  if (x.heard_about === "stall") return "stall";
  return ["instagram", "tiktok", "whatsapp"].includes(x.heard_about ?? "") || /insta|tiktok|online|web/i.test(x.channel ?? "") ? "online" : "other";
}
