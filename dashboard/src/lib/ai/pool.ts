/**
 * Scout's key pool (pure, tested): which free Groq keys to try and when one is "out" for today.
 * Members lend their key to Scout; Scout uses a lent key for at most 60% of each model's daily allowance,
 * so the owner always keeps the rest for their own Ask, Idea Lab and notes.
 */
export const DAILY_TOKENS = 200_000;
export const LEND_SHARE = 0.6;
export type PoolKey = { owner: string; key: string; own: boolean };
export type UsageRow = { owner_id: string; model: string; tokens: number; limited_until: string | null; bad: boolean };
export type PoolEvent = { owner: string; model: string; tokens?: number; until?: string; bad?: boolean };

const rowsOf = (usage: UsageRow[], owner: string) => usage.filter((r) => r.owner_id === owner);
const capped = (k: PoolKey, r?: UsageRow) => !k.own && (r?.tokens ?? 0) >= DAILY_TOKENS * LEND_SHARE;

export function canUse(k: PoolKey, model: string, usage: UsageRow[], now = Date.now()): boolean {
  const rows = rowsOf(usage, k.owner);
  if (rows.some((r) => r.bad)) return false;
  const r = rows.find((x) => x.model === model);
  if (r?.limited_until && Date.parse(r.limited_until) > now) return false;
  return !capped(k, r);
}

/** Seconds until the first waiting/capped key+model can be tried again (capped lent key: next UTC midnight); null if none is waiting. */
export function waitSeconds(keys: PoolKey[], models: string[], usage: UsageRow[], now = Date.now()): number | null {
  const d = new Date(now);
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  let best = Infinity;
  for (const k of keys) {
    const rows = rowsOf(usage, k.owner);
    if (rows.some((r) => r.bad)) continue;
    for (const m of models) {
      const r = rows.find((x) => x.model === m);
      const until = r?.limited_until ? Date.parse(r.limited_until) : 0;
      if (capped(k, r)) best = Math.min(best, midnight - now);
      else if (until > now) best = Math.min(best, until - now);
    }
  }
  return best === Infinity ? null : Math.max(1, Math.ceil(best / 1000));
}

export class KeyRing {
  keys: PoolKey[];
  usage: UsageRow[];
  tokens = 0;
  usedLent = false;
  private persist: (e: PoolEvent) => unknown;
  constructor(keys: PoolKey[], usage: UsageRow[] = [], persist: (e: PoolEvent) => unknown = () => {}) {
    this.usage = usage;
    this.persist = persist;
    const total = (o: string) => rowsOf(usage, o).reduce((s, r) => s + r.tokens, 0);
    this.keys = [...keys.filter((k) => k.own), ...keys.filter((k) => !k.own).sort((a, b) => total(a.owner) - total(b.owner))];
  }
  private row(owner: string, model: string): UsageRow {
    let r = this.usage.find((x) => x.owner_id === owner && x.model === model);
    if (!r) { r = { owner_id: owner, model, tokens: 0, limited_until: null, bad: false }; this.usage.push(r); }
    return r;
  }
  private async save(e: PoolEvent) { try { await this.persist(e); } catch { /* saving usage must never break a search */ } }
  async used(k: PoolKey, model: string, tokens: number) {
    this.row(k.owner, model).tokens += tokens;
    this.tokens += tokens;
    if (!k.own) this.usedLent = true;
    await this.save({ owner: k.owner, model, tokens });
  }
  async limited(k: PoolKey, model: string, seconds: number, now = Date.now()) {
    const until = new Date(now + seconds * 1000).toISOString();
    this.row(k.owner, model).limited_until = until;
    await this.save({ owner: k.owner, model, until });
  }
  async bad(k: PoolKey) { this.row(k.owner, "*").bad = true; await this.save({ owner: k.owner, model: "*", bad: true }); }
  allBad() { return this.keys.every((k) => rowsOf(this.usage, k.owner).some((r) => r.bad)); }
}
