/** Marketing calculations (pure, tested). Definitions match docs/marketing-build-prompt.md §1. */
export type TagKey = "product" | "format" | "hook_visual" | "hook_message" | "audience" | "channel";
export const TAG_KEYS: TagKey[] = ["product", "format", "hook_visual", "hook_message", "audience", "channel"];
export type Content = { id: string; title: string; platform: string; status: string; tags: Partial<Record<TagKey, string>>; posted_at: string | null; planned_for: string | null; decision: string | null; owner_id: string | null; thumbnail_url?: string | null; permalink?: string | null; campaign_id?: string | null };
export type Metric = { content_id: string; age_hours: number; views: number | null; reach: number | null; likes?: number | null; comments?: number | null; saves: number | null; shares: number | null; profile_visits?: number | null; link_clicks?: number | null };

export function median(xs: number[]): number | null {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** The most mature snapshot of a post: 7 days, else 48 h, else 24 h. */
export function bestMetric(id: string, metrics: Metric[]): Metric | null {
  const own = metrics.filter((m) => m.content_id === id);
  return [168, 48, 24].map((h) => own.find((m) => m.age_hours === h)).find(Boolean) ?? null;
}

/** Shares + saves per person reached — the signals Instagram says drive reach. */
export function shareSaveRate(m: Metric | null): number | null {
  if (!m || !m.reach) return null;
  return ((m.shares ?? 0) + (m.saves ?? 0)) / m.reach;
}

/** A "hit" = 7-day views ≥ 2× the median of our own posts from the 30 days before it (or all posts if too few). */
export function hits(items: Content[], metrics: Metric[]) {
  const posted = items.filter((c) => c.posted_at).map((c) => ({ c, views: metrics.find((m) => m.content_id === c.id && m.age_hours === 168)?.views ?? null }))
    .filter((x) => x.views !== null) as { c: Content; views: number }[];
  return posted.map(({ c, views }) => {
    const t = Date.parse(c.posted_at!);
    const prior = posted.filter((p) => p.c.id !== c.id && Date.parse(p.c.posted_at!) < t && Date.parse(p.c.posted_at!) >= t - 30 * 864e5).map((p) => p.views);
    const base = prior.length >= 3 ? median(prior) : median(posted.filter((p) => p.c.id !== c.id).map((p) => p.views));
    return { id: c.id, views, baseline: base, ratio: base ? views / base : null, hit: base ? views >= 2 * base : false };
  });
}

export function hitRate(items: Content[], metrics: Metric[]) {
  const h = hits(items, metrics).filter((x) => x.baseline !== null);
  return h.length ? h.filter((x) => x.hit).length / h.length : null;
}

/** Which tag values perform best/worst (by median share+save rate, at least 2 posts each). */
export function tagWinners(items: Content[], metrics: Metric[], minPosts = 2) {
  const rows: { key: TagKey; value: string; rate: number; posts: number }[] = [];
  for (const key of TAG_KEYS) {
    const groups = new Map<string, number[]>();
    for (const c of items) {
      const v = c.tags?.[key];
      const r = shareSaveRate(bestMetric(c.id, metrics));
      if (!v || r === null) continue;
      groups.set(v, [...(groups.get(v) ?? []), r]);
    }
    for (const [value, rates] of groups) if (rates.length >= minPosts) rows.push({ key, value, rate: median(rates)!, posts: rates.length });
  }
  const all = median(rows.map((r) => r.rate)) ?? 0;
  return {
    doMore: rows.filter((r) => r.rate > all).sort((a, b) => b.rate - a.rate).slice(0, 3),
    stop: rows.filter((r) => r.rate < all).sort((a, b) => a.rate - b.rate).slice(0, 3),
  };
}

export type SaleAttr = { amount: number | string; heard_about: string | null; code: string | null; utm_source: string | null; reverses_id?: string | null };
/** Revenue by channel: survey answer decides offline/word-of-mouth, code or UTM decides online (spec §2). */
export function revenueByChannel(sales: SaleAttr[], codeChannel: Record<string, string>) {
  const out = new Map<string, number>();
  for (const s of sales) {
    const online = (s.code && codeChannel[s.code]) || s.utm_source;
    const ch = s.heard_about && ["stall", "friend", "poster", "ambassador"].includes(s.heard_about) ? s.heard_about : online || s.heard_about || "unknown";
    out.set(ch, (out.get(ch) ?? 0) + Number(s.amount));
  }
  return [...out.entries()].map(([channel, revenue]) => ({ channel, revenue: Math.round(revenue * 100) / 100 })).sort((a, b) => b.revenue - a.revenue);
}

/** Share of sales where the code/UTM channel and the "heard about us" answer disagree — how trustworthy attribution is. */
export function disagreement(sales: SaleAttr[], codeChannel: Record<string, string>) {
  const both = sales.filter((s) => s.heard_about && ((s.code && codeChannel[s.code]) || s.utm_source));
  if (!both.length) return null;
  return both.filter((s) => ((s.code && codeChannel[s.code]) || s.utm_source) !== s.heard_about).length / both.length;
}

export function rate(part: number, whole: number) { return whole > 0 ? part / whole : null; }

/** Revenue per stall-hour for stall days with opening hours and linked sales. */
export function revenuePerStallHour(stalls: { id: string; opened_at: string | null; closed_at: string | null }[], sales: { stall_id?: string | null; amount: number | string }[]) {
  let hours = 0, revenue = 0;
  for (const s of stalls) {
    if (!s.opened_at || !s.closed_at) continue;
    const [h1, m1] = s.opened_at.split(":").map(Number), [h2, m2] = s.closed_at.split(":").map(Number);
    const h = (h2 * 60 + m2 - (h1 * 60 + m1)) / 60;
    if (h <= 0) continue;
    hours += h;
    revenue += sales.filter((x) => x.stall_id === s.id).reduce((a, x) => a + Number(x.amount), 0);
  }
  return hours ? Math.round((revenue / hours) * 100) / 100 : null;
}
