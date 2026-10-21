# Scout Key Pool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scout never stops on one person's Groq daily limit: it rotates through keys members lend (capped at 60% so lenders keep their own allowance), then falls back to a free Mistral key, while the final score always comes from the strongest model.

**Architecture:** A pure `KeyRing` (src/lib/ai/pool.ts) holds the ordered keys plus today's usage and decides which key/model may be tried. `call()` moves to src/lib/ai/call.ts and accepts a ring (or a plain key, so Ask/Lab/notes are unchanged); it records tokens, 429 waits and rejected keys through a persist callback. Scout routes build the ring on the server (service role reads lent keys + `ai_key_usage`). Mistral is just more entries in a model list (`mistral/<id>`), tried only after every Groq key, and only for calls without web search.

**Tech Stack:** Next.js App Router, Supabase (Postgres RLS), node:test, Groq + Mistral OpenAI-compatible chat APIs.

**Spec:** `docs/superpowers/specs/2026-10-21-scout-key-pool-design.md`

All paths below are relative to `dashboard/`. Test command: `npm test`. DB tests: `PGBIN=$(dirname $(readlink -f $(which psql))) bash supabase/tests/run-local.sh`.

## Global Constraints
- €0: free Groq + free Mistral Experiment plan only; Scout must work without `MISTRAL_API_KEY`.
- Lent keys: Scout uses at most 60% of 200K tokens/day per model (120K); own key uncapped.
- Judge (final score) only on `openai/gpt-oss-120b`, then `mistral/mistral-medium-latest`; never a smaller model.
- Keys never leave the server, never logged; only Scout routes use lent keys, after `can_scout()`.
- New tables: explicit grants + RLS (repo rule 9). All UI text in 7 languages (`messages/*.json`).
- Update `README.md` + `CHANGELOG.md`. Show the diff and wait for "push it" before pushing.

## Review Focus
- A lender whose key Groq rejects (revoked key): the search must continue on other keys, never fail.
- Usage writes failing (service key missing locally): Scout must still work with the own key only.
- Two searches at once (two people): usage increments must not overwrite each other (atomic `+=` in SQL).
- A member with NO own key but lenders exist: Scout must work for them (no more "no-key" error).
- Day change: yesterday's limits must not block today (usage keyed by UTC day).

---

### Task 1: Database — lend switch, usage table, lenders list

**Files:**
- Create: `supabase/migrations/0032_scout_key_pool.sql`
- Modify: `supabase/tests/permissions_test.sql` (append)

- [ ] **Step 1: Write the failing DB tests** (append at end of permissions_test.sql)

```sql
-- ── Scout key pool: lend your Groq key to Scout ─────────────
set role authenticated;
select t.login(3);
select t.check('Member saves a key', $$insert into ai_keys (key_iv, key_data, last4) values ('iv', 'enc', 'abcd')$$, 'ok');
select t.check('...and lends it to Scout', $$update ai_keys set lend_scout = true$$, 'ok');
select t.login(6);
select t.assert('Lending does not show the key to anyone', t.num('select count(*) from ai_keys') = 0);
select t.check('Browser cannot write key usage', $$select ai_usage_event(my_profile_id(), 'x', 5, null, false)$$, 'denied');
select t.assert('Members see who lends a key (names only)', (select count(*) from scout_lenders()) = 1);
select t.login(1);
select t.assert('Admins cannot see a lent key either', t.num($$select count(*) from ai_keys where last4 = 'abcd'$$) = 0);
reset role;
select ai_usage_event((select id from profiles where full_name = 'Rocco'), 'openai/gpt-oss-120b', 1000, null, false);
select ai_usage_event((select id from profiles where full_name = 'Rocco'), 'openai/gpt-oss-120b', 500, now() + interval '1 minute', false);
set role authenticated;
select t.login(3);
select t.assert('Owner sees Scout usage of their key, added up', t.num($$select tokens from ai_key_usage where model = 'openai/gpt-oss-120b'$$) = 1500);
select t.login(6);
select t.assert('Nobody else sees it', t.num('select count(*) from ai_key_usage') = 0);
reset role;
```

- [ ] **Step 2: Run DB tests** — Expected: FAIL (column `lend_scout` / function `ai_usage_event` does not exist).

- [ ] **Step 3: Write the migration**

```sql
-- Scout key pool (2026-10-21): members can lend their free Groq key to Scout (opt-in, off by default).
-- Scout uses a lent key for at most 60% of each model's daily allowance, so its owner keeps the rest.
-- Keys stay readable only by their owner and the server (service role) — admins included can't see them.
alter table public.ai_keys add column if not exists lend_scout boolean not null default false;
grant select on public.ai_keys to service_role;

create table if not exists public.ai_key_usage (
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  day           date not null default ((now() at time zone 'utc')::date),
  model         text not null,
  tokens        integer not null default 0,
  limited_until timestamptz,
  bad           boolean not null default false,
  primary key (owner_id, day, model)
);
grant select on public.ai_key_usage to authenticated;
grant select, insert, update, delete on public.ai_key_usage to service_role;
alter table public.ai_key_usage enable row level security;
create policy ai_key_usage_owner on public.ai_key_usage for select to authenticated
  using (owner_id = (select public.my_profile_id()));

-- Server only: add tokens / a wait / a rejected key atomically (two searches at once never overwrite each other)
create or replace function public.ai_usage_event(p_owner uuid, p_model text, p_tokens integer, p_until timestamptz, p_bad boolean)
returns void language sql security definer set search_path = public as $$
  insert into public.ai_key_usage (owner_id, model, tokens, limited_until, bad)
  values (p_owner, p_model, greatest(coalesce(p_tokens, 0), 0), p_until, coalesce(p_bad, false))
  on conflict (owner_id, day, model) do update
    set tokens = ai_key_usage.tokens + excluded.tokens,
        limited_until = coalesce(excluded.limited_until, ai_key_usage.limited_until),
        bad = ai_key_usage.bad or excluded.bad
$$;
revoke execute on function public.ai_usage_event(uuid, text, integer, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.ai_usage_event(uuid, text, integer, timestamptz, boolean) to service_role;

-- Who lends a key to Scout — names only, members only
create or replace function public.scout_lenders() returns table (full_name text)
language sql stable security definer set search_path = public as $$
  select p.full_name from public.ai_keys k join public.profiles p on p.id = k.owner_id
  where k.lend_scout and p.active and public.is_member() order by p.full_name
$$;
revoke execute on function public.scout_lenders() from public, anon;
grant execute on function public.scout_lenders() to authenticated;

-- Tokens a search used (shown in its log)
alter table public.scout_searches add column if not exists tokens integer not null default 0;
```

- [ ] **Step 4: Run DB tests** — Expected: all pass, including the 7 new lines.

- [ ] **Step 5: Commit** — `git add supabase && git commit -m "feat(scout): key pool tables (lend switch, usage, lenders)"`

### Task 2: KeyRing (pure logic)

**Files:**
- Create: `src/lib/ai/pool.ts`, `src/lib/ai/pool.test.ts`

**Interfaces — Produces:**
```ts
export const DAILY_TOKENS = 200_000; export const LEND_SHARE = 0.6;
export type PoolKey = { owner: string; key: string; own: boolean };
export type UsageRow = { owner_id: string; model: string; tokens: number; limited_until: string | null; bad: boolean };
export type PoolEvent = { owner: string; model: string; tokens?: number; until?: string; bad?: boolean };
export function canUse(k: PoolKey, model: string, usage: UsageRow[], now?: number): boolean;
export function waitSeconds(keys: PoolKey[], models: string[], usage: UsageRow[], now?: number): number;
export class KeyRing { keys: PoolKey[]; usage: UsageRow[]; tokens: number; usedLent: boolean;
  constructor(keys: PoolKey[], usage?: UsageRow[], persist?: (e: PoolEvent) => unknown);
  used(k: PoolKey, model: string, tokens: number): Promise<void>;
  limited(k: PoolKey, model: string, seconds: number, now?: number): Promise<void>;
  bad(k: PoolKey): Promise<void>;
  allBad(): boolean; }
```

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { KeyRing, canUse, waitSeconds, type PoolKey, type UsageRow } from "./pool.ts";

const own: PoolKey = { owner: "me", key: "k0", own: true };
const ana: PoolKey = { owner: "ana", key: "k1", own: false };
const ben: PoolKey = { owner: "ben", key: "k2", own: false };
const M = "openai/gpt-oss-120b";
const row = (owner_id: string, tokens: number, extra: Partial<UsageRow> = {}): UsageRow => ({ owner_id, model: M, tokens, limited_until: null, bad: false, ...extra });
const NOW = Date.parse("2026-10-21T12:00:00Z");

test("own key first, then lent keys with the fewest tokens used today", () => {
  const ring = new KeyRing([ana, ben, own], [row("ana", 90_000), row("ben", 10_000)]);
  assert.deepEqual(ring.keys.map((k) => k.owner), ["me", "ben", "ana"]);
});

test("a lent key stops at 60% of the daily allowance; the own key has no cap", () => {
  assert.equal(canUse(ana, M, [row("ana", 119_999)], NOW), true);
  assert.equal(canUse(ana, M, [row("ana", 120_000)], NOW), false);
  assert.equal(canUse(own, M, [row("me", 190_000)], NOW), true);
});

test("a key waiting on a model is skipped for that model only, until the wait is over", () => {
  const u = [row("ana", 0, { limited_until: new Date(NOW + 30_000).toISOString() })];
  assert.equal(canUse(ana, M, u, NOW), false);
  assert.equal(canUse(ana, "openai/gpt-oss-20b", u, NOW), true);
  assert.equal(canUse(ana, M, u, NOW + 31_000), true);
});

test("a rejected key is skipped for every model", () => {
  assert.equal(canUse(ana, "openai/gpt-oss-20b", [{ owner_id: "ana", model: "*", tokens: 0, limited_until: null, bad: true }], NOW), false);
});

test("wait = the soonest key/model to free up; a capped lent key frees up at UTC midnight", () => {
  const u = [row("me", 0, { limited_until: new Date(NOW + 40_000).toISOString() }), row("ana", 120_000)];
  assert.equal(waitSeconds([own, ana], [M], u, NOW), 40);
  assert.equal(waitSeconds([ana], [M], [row("ana", 120_000)], NOW), 12 * 3600);
});

test("the ring remembers tokens, waits and rejected keys, and reports them for saving", async () => {
  const saved: unknown[] = [];
  const ring = new KeyRing([own, ana], [], (e) => saved.push(e));
  await ring.used(ana, M, 700);
  await ring.limited(own, M, 60, NOW);
  await ring.bad(ana);
  assert.equal(ring.tokens, 700);
  assert.equal(ring.usedLent, true);
  assert.equal(canUse(own, M, ring.usage, NOW + 1000), false);
  assert.equal(ring.allBad(), false);
  assert.deepEqual(saved, [{ owner: "ana", model: M, tokens: 700 }, { owner: "me", model: M, until: new Date(NOW + 60_000).toISOString() }, { owner: "ana", model: "*", bad: true }]);
});

test("a failing save never breaks the search", async () => {
  const ring = new KeyRing([own], [], () => { throw new Error("db down"); });
  await ring.used(own, M, 10);
  assert.equal(ring.tokens, 10);
});
```

- [ ] **Step 2: Run** `npm test` — Expected: FAIL, cannot find module `./pool.ts`.

- [ ] **Step 3: Implement `src/lib/ai/pool.ts`**

```ts
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

export function canUse(k: PoolKey, model: string, usage: UsageRow[], now = Date.now()): boolean {
  const rows = rowsOf(usage, k.owner);
  if (rows.some((r) => r.bad)) return false;
  const r = rows.find((x) => x.model === model);
  if (r?.limited_until && Date.parse(r.limited_until) > now) return false;
  return k.own || (r?.tokens ?? 0) < DAILY_TOKENS * LEND_SHARE;
}

/** Seconds until the first key/model can be tried again (a capped lent key: at the next UTC midnight). */
export function waitSeconds(keys: PoolKey[], models: string[], usage: UsageRow[], now = Date.now()): number {
  const d = new Date(now);
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  let best = Infinity;
  for (const k of keys) {
    const rows = rowsOf(usage, k.owner);
    if (rows.some((r) => r.bad)) continue;
    for (const m of models) {
      const r = rows.find((x) => x.model === m);
      const until = r?.limited_until ? Date.parse(r.limited_until) : 0;
      const capped = !k.own && (r?.tokens ?? 0) >= DAILY_TOKENS * LEND_SHARE;
      best = Math.min(best, capped ? midnight - now : Math.max(until - now, 0));
    }
  }
  return best === Infinity ? 60 : Math.max(1, Math.ceil(best / 1000));
}

export class KeyRing {
  keys: PoolKey[];
  tokens = 0;
  usedLent = false;
  constructor(keys: PoolKey[], public usage: UsageRow[] = [], private persist: (e: PoolEvent) => unknown = () => {}) {
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
    this.row(k.owner, model).tokens += tokens; this.tokens += tokens;
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
```

- [ ] **Step 4: Run** `npm test` — Expected: all pass. (Add `src/lib/ai/*.test.ts` is already in the test script.)

- [ ] **Step 5: Commit** — `git commit -m "feat(ai): key ring for Scout's shared keys"`

### Task 3: `call()` over a ring + Mistral fallback

**Files:**
- Create: `src/lib/ai/call.ts`, `src/lib/ai/call.test.ts`
- Modify: `src/lib/lab/ai.ts` (remove its `call`/`Fail`/`API`, re-export from `@/lib/ai/call`)

**Interfaces — Consumes:** Task 2's `KeyRing`, `canUse`, `waitSeconds`. **Produces:**
```ts
export type Fail = { error: "limit" | "bad-key" | "failed"; retryAfter?: number };
export async function call(key: string | KeyRing, body: Record<string, unknown>, models?: string[]): Promise<{ ok: true; message: Record<string, unknown> } | Fail>;
```
Models starting with `mistral/` go to `https://api.mistral.ai/v1/chat/completions` with `MISTRAL_API_KEY`, after every Groq key, and only when `body.tools` is unset.

- [ ] **Step 1: Write the failing tests** (`src/lib/ai/call.test.ts`; stub `globalThis.fetch`)

```ts
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { call } from "./call.ts";
import { KeyRing, type PoolKey } from "./pool.ts";

type Rule = (auth: string, model: string, url: string) => Response | undefined;
let rules: Rule[] = []; let calls: string[] = [];
const ok = (tokens = 100) => new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }], usage: { total_tokens: tokens } }), { status: 200 });
const busy = (s = 30) => new Response("{}", { status: 429, headers: { "retry-after": String(s) } });
beforeEach(() => {
  rules = []; calls = []; delete process.env.MISTRAL_API_KEY;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    const auth = String((init.headers as Record<string, string>).Authorization).slice(7);
    const model = JSON.parse(String(init.body)).model as string;
    calls.push(`${auth}:${model}`);
    for (const r of rules) { const res = r(auth, model, url); if (res) return res; }
    return ok();
  }) as typeof fetch;
});
const own: PoolKey = { owner: "me", key: "k0", own: true };
const ana: PoolKey = { owner: "ana", key: "k1", own: false };
const BIG = "openai/gpt-oss-120b";

test("when my key is out, the next person's key steps in on the same model", async () => {
  rules.push((a) => (a === "k0" ? busy() : undefined));
  const ring = new KeyRing([own, ana]);
  const r = await call(ring, { messages: [] }, [BIG]);
  assert.equal("ok" in r, true);
  assert.deepEqual(calls, ["k0:openai/gpt-oss-120b", "k1:openai/gpt-oss-120b"]);
  assert.equal(ring.usedLent, true);
});

test("a key that ran out is not tried again in the next call", async () => {
  rules.push((a) => (a === "k0" ? busy() : undefined));
  const ring = new KeyRing([own, ana]);
  await call(ring, { messages: [] }, [BIG]); calls = [];
  await call(ring, { messages: [] }, [BIG]);
  assert.deepEqual(calls, ["k1:openai/gpt-oss-120b"]);
});

test("a rejected lent key is skipped, the search continues", async () => {
  rules.push((a) => (a === "k1" ? new Response("{}", { status: 401 }) : undefined), (a) => (a === "k0" ? busy() : undefined));
  const r = await call(new KeyRing([own, ana]), { messages: [] }, [BIG]);
  assert.deepEqual(r, { error: "limit", retryAfter: 30 });
});

test("Mistral only after every Groq key, and only without web search", async () => {
  process.env.MISTRAL_API_KEY = "mk";
  rules.push((a) => (a !== "mk" ? busy() : undefined));
  const r = await call(new KeyRing([own, ana]), { messages: [] }, [BIG, "mistral/mistral-medium-latest"]);
  assert.equal("ok" in r, true);
  assert.deepEqual(calls.at(-1), "mk:mistral-medium-latest");
  calls = [];
  const w = await call(new KeyRing([own]), { messages: [], tools: [{ type: "browser_search" }] }, ["openai/gpt-oss-20b", "mistral/mistral-small-latest"]);
  assert.equal("error" in w && w.error, "limit");
  assert.equal(calls.some((c) => c.startsWith("mk:")), false);
});

test("no Mistral key: Mistral models are ignored", async () => {
  rules.push(() => busy(12));
  const r = await call(new KeyRing([own]), { messages: [] }, [BIG, "mistral/mistral-medium-latest"]);
  assert.deepEqual(r, { error: "limit", retryAfter: 12 });
  assert.equal(calls.length, 1);
});

test("a plain key still works as before (Ask, Idea Lab, notes)", async () => {
  rules.push(() => new Response("{}", { status: 401 }));
  assert.deepEqual(await call("k0", { messages: [] }, [BIG]), { error: "bad-key" });
});

test("tokens are counted on the ring", async () => {
  const ring = new KeyRing([own]);
  rules.push(() => ok(321));
  await call(ring, { messages: [] }, [BIG]);
  assert.equal(ring.tokens, 321);
});
```

- [ ] **Step 2: Run** `npm test` — Expected: FAIL, cannot find module `./call.ts`.

- [ ] **Step 3: Implement `src/lib/ai/call.ts`**

```ts
import { KeyRing, canUse, waitSeconds } from "./pool.ts";

/**
 * One AI call on the free plans. With a plain key: that member's own Groq account (Ask, Idea Lab, notes).
 * With a KeyRing (Scout): each key in turn — own first, then keys members lend — and per key each model, skipping
 * keys that are out today; then the free Mistral backup (`mistral/<id>` models, only without web search).
 */
const GROQ = "https://api.groq.com/openai/v1/chat/completions";
const MISTRAL = "https://api.mistral.ai/v1/chat/completions";
export type Fail = { error: "limit" | "bad-key" | "failed"; retryAfter?: number };
type Ok = { ok: true; message: Record<string, unknown> };
type Reply = { choices?: { message?: Record<string, unknown> }[]; usage?: { total_tokens?: number } };

export async function call(key: string | KeyRing, body: Record<string, unknown>, models = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]): Promise<Ok | Fail> {
  const ring = typeof key === "string" ? new KeyRing([{ owner: "me", key, own: true }]) : key;
  // Qwen has its own free daily allowance but no web search and other reasoning settings
  const groq = models.filter((m) => !m.startsWith("mistral/") && !(m.startsWith("qwen/") && body.tools));
  let mistralWait: number | null = null, failed = false;
  for (const k of ring.keys) {
    for (const model of groq) {
      if (!canUse(k, model, ring.usage)) continue;
      const { reasoning_effort, ...rest } = body;
      const payload = model.startsWith("qwen/") ? { model, ...rest, reasoning_format: "hidden" } : { model, ...rest, ...(reasoning_effort ? { reasoning_effort } : {}) };
      const res = await fetch(GROQ, { method: "POST", headers: { Authorization: `Bearer ${k.key}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) {
        const data = (await res.json()) as Reply;
        await ring.used(k, model, data.usage?.total_tokens ?? 0);
        return { ok: true, message: data.choices?.[0]?.message ?? {} };
      }
      if (res.status === 401 || res.status === 403) { await ring.bad(k); break; }
      // This key's free allowance for this model is used up: remember it and try the next model / key
      if (res.status === 429 || res.status === 413) { await ring.limited(k, model, Math.ceil(Number(res.headers.get("retry-after")) || 60)); continue; }
      if (res.status !== 404 && res.status !== 400) failed = true;
    }
  }
  const backup = process.env.MISTRAL_API_KEY;
  if (backup && !body.tools) {
    for (const m of models.filter((x) => x.startsWith("mistral/"))) {
      const { reasoning_effort: _r, ...rest } = body;
      const res = await fetch(MISTRAL, { method: "POST", headers: { Authorization: `Bearer ${backup}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...rest, model: m.slice(8) }) });
      if (res.ok) {
        const data = (await res.json()) as Reply;
        ring.tokens += data.usage?.total_tokens ?? 0;
        return { ok: true, message: data.choices?.[0]?.message ?? {} };
      }
      if (res.status === 429) mistralWait = Math.min(mistralWait ?? Infinity, Math.ceil(Number(res.headers.get("retry-after")) || 60));
    }
  }
  if (ring.allBad() && mistralWait === null) return { error: "bad-key" };
  const groqWait = ring.allBad() ? Infinity : waitSeconds(ring.keys, groq, ring.usage);
  const wait = Math.min(groqWait, mistralWait ?? Infinity);
  if (failed && !Number.isFinite(wait)) return { error: "failed" };
  return { error: "limit", retryAfter: Number.isFinite(wait) ? wait : 60 };
}
```

Note on `failed`: previously one 5xx returned "failed" at once; now another key/model gets a chance first (same "failed" result if nothing else works). Keep the eslint-disable comment for `_r` if lint complains.

- [ ] **Step 4: In `src/lib/lab/ai.ts`** delete `API`, `MODELS`, `Fail` and `call` and add at the top:

```ts
import { call, type Fail } from "@/lib/ai/call";
export { call, type Fail };
const MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];
```
(keep `MODELS` only if still referenced in the file).

- [ ] **Step 5: Run** `npm test && npx tsc --noEmit` — Expected: all pass, no type errors.

- [ ] **Step 6: Commit** — `git commit -m "feat(ai): call() rotates through a key ring, Mistral as last resort"`

### Task 4: Scout uses the pool (models, server ring, token log)

**Files:**
- Create: `src/lib/scout/models.ts`, `src/lib/ai/ring-server.ts`
- Modify: `src/lib/scout/ai.ts`, `src/lib/scout/run.ts`, `src/app/api/scout/step/route.ts`, `src/app/api/scout/check/route.ts`, `src/lib/scout/core.test.ts`

**Interfaces — Produces:**
```ts
// models.ts
export const PLAN_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "mistral/mistral-medium-latest"];
export const WEB_MODELS = ["openai/gpt-oss-20b", "openai/gpt-oss-120b"];
export const RELEVANCE_MODELS = ["openai/gpt-oss-20b", "qwen/qwen3.8-27b", "openai/gpt-oss-120b", "mistral/mistral-small-latest"];
export const JUDGE_MODELS = ["openai/gpt-oss-120b", "mistral/mistral-medium-latest"];
// ring-server.ts
export async function scoutRing(meId: string, ownRow: { key_iv: string; key_data: string } | null): Promise<KeyRing | null>;
```

- [ ] **Step 1: Failing test** (append to `src/lib/scout/core.test.ts`)

```ts
import { JUDGE_MODELS, RELEVANCE_MODELS } from "./models.ts";
test("the final score only ever comes from the strongest models", () => {
  assert.deepEqual(JUDGE_MODELS, ["openai/gpt-oss-120b", "mistral/mistral-medium-latest"]);
  assert.equal(RELEVANCE_MODELS.at(-1), "mistral/mistral-small-latest");
});
```
Run `npm test` — Expected: FAIL (module not found). Create `models.ts` with the block above (plus a one-line comment) → PASS.

- [ ] **Step 2: `src/lib/ai/ring-server.ts`**

```ts
import { createClient } from "@supabase/supabase-js";
import { decryptKey } from "./keys";
import { KeyRing, type PoolKey, type UsageRow } from "./pool";

/**
 * Scout's keys for this request: my own key first, then the keys other active members lend to Scout, with today's
 * usage. Server only (service role) — lent keys are never sent to the browser. Without the service key (local dev)
 * it falls back to my own key.
 */
export async function scoutRing(meId: string, ownRow: { key_iv: string; key_data: string } | null): Promise<KeyRing | null> {
  const keys: PoolKey[] = ownRow ? [{ owner: meId, key: decryptKey(ownRow), own: true }] : [];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return keys.length ? new KeyRing(keys) : null;
  const sb = createClient(url, service, { auth: { persistSession: false } });
  const day = new Date().toISOString().slice(0, 10);
  const [{ data: lent }, { data: usage }] = await Promise.all([
    sb.from("ai_keys").select("owner_id, key_iv, key_data, profiles!inner(active)").eq("lend_scout", true).eq("profiles.active", true).neq("owner_id", meId),
    sb.from("ai_key_usage").select("owner_id, model, tokens, limited_until, bad").eq("day", day),
  ]);
  for (const r of lent ?? []) { try { keys.push({ owner: r.owner_id, key: decryptKey(r), own: false }); } catch { /* unreadable key: skip */ } }
  if (!keys.length) return null;
  return new KeyRing(keys, (usage ?? []) as UsageRow[], (e) =>
    sb.rpc("ai_usage_event", { p_owner: e.owner, p_model: e.model, p_tokens: e.tokens ?? 0, p_until: e.until ?? null, p_bad: e.bad ?? false }));
}
```
(If `profiles!inner` needs the FK name, use `profiles!ai_keys_owner_id_fkey!inner(active)`; check with `npx tsc` + the live run.)

- [ ] **Step 3: Scout functions take `KeyRing`.** In `src/lib/scout/ai.ts` change each `key: string` parameter of `planProject`, `webFind`, `relevance`, `webCheck`, `judge` to `key: string | KeyRing` (import type from `@/lib/ai/pool`) and replace their model arrays with `PLAN_MODELS` (planProject; it had none = default), `WEB_MODELS` (webFind, webCheck), `RELEVANCE_MODELS` (relevance), `JUDGE_MODELS` (judge). In `src/lib/scout/run.ts` change `researchAndJudge(sb, key: string, …)` to `key: string | KeyRing`.

- [ ] **Step 4: Routes.** In `src/app/api/scout/step/route.ts` and `src/app/api/scout/check/route.ts` replace

```ts
  if (!keyRow) return NextResponse.json({ error: "no-key" }, { status: 400 });
  const key = decryptKey(keyRow);
```
with (after the `can_scout` check, so only Scout members ever touch lent keys)
```ts
  const { data: meId } = await sb.rpc("my_profile_id");
  const key = await scoutRing(meId as string, keyRow);
  if (!key) return NextResponse.json({ error: "no-key" }, { status: 400 });
```
In step/route.ts, inside `save()` add the ring's tokens: `tokens: (s.tokens ?? 0) + key.tokens` (select `tokens` with the search), and before saving once per search log the pool: `if (key.usedLent && !s.log.some((l) => l.k === "pool")) log.push(line("pool", { n: key.keys.filter((k) => !k.own).length }));`. On `done` the existing done line gets `tokens: Math.round(total / 1000)` → message `"done"` gains " · ~{tokens}K AI tokens".

- [ ] **Step 5: Run** `npm test && npx tsc --noEmit && npm run lint` — Expected: pass.

- [ ] **Step 6: Commit** — `git commit -m "feat(scout): searches use the team key pool; judge only on the strongest models"`

### Task 5: Lend switch + lenders on the Scout page (7 languages)

**Files:**
- Modify: `src/app/api/ai-key/route.ts` (GET adds `lend`, `usedToday`; new PATCH `{ lend: boolean }`)
- Create: `src/components/scout/lend-key.tsx`
- Modify: `src/app/(app)/scout/page.tsx` (load `scout_lenders()`, `ai_keys.lend_scout`, today's own usage), `src/components/scout/scout.tsx` (render `<LendKey …/>` above the search form), `messages/{en,es,de,fr,fi,pt-BR,ru}.json`

- [ ] **Step 1: API.** GET: `select("last4, created_at, lend_scout")` and today's `ai_key_usage` sum → `{ connected, last4, lend, usedToday }`. PATCH:

```ts
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { lend } = (await request.json().catch(() => ({}))) as { lend?: boolean };
  if (typeof lend !== "boolean") return NextResponse.json({ error: "bad-request" }, { status: 400 });
  const { data, error } = await supabase.from("ai_keys").update({ lend_scout: lend }).select("lend_scout").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "no-key" }, { status: 400 });
  return NextResponse.json({ lend: data.lend_scout });
}
```
(RLS limits the update to the caller's own row.)

- [ ] **Step 2: Component `lend-key.tsx`** — client component, props `{ hasKey: boolean; lend: boolean; usedToday: number; lenders: string[] }`. Shows: switch "Lend my AI key to Scout" (disabled without a key, with hint), help text, "Scout used ~{n}K tokens of your key today" when lend is on, and "{count} people lend their key: {names}". Toggle → `fetch("/api/ai-key", { method: "PATCH", … })`, optimistic, toast on error, `router.refresh()`.

- [ ] **Step 3: Strings** in `scout` namespace, all 7 files: `lendTitle`, `lendHelp` ("Only Scout uses it — never Ask, Idea Lab or notes. Nobody can see your key. Scout stops at 60% of your daily allowance so you always keep the rest."), `lendNeedKey`, `lendUsed` ("Scout used ~{n}K tokens of your key today"), `lenders` ("{count, plural, one {# person lends} other {# people lend}} their key to Scout: {names}"), `lendersNone`; `log.pool` ("Using the team's shared keys ({n} available)"), and `log.done` gains `· ~{tokens}K AI tokens`. Check all 7 files parse: `for f in messages/*.json; do node -e "JSON.parse(require('fs').readFileSync('$f'))"; done`.

- [ ] **Step 4: Check in the browser (local dev)**: switch on/off saves; lenders line shows names; a search runs; no console errors.

- [ ] **Step 5: Commit** — `git commit -m "feat(scout): lend-your-key switch and lenders list"`

### Task 6: Docs, migration live, deploy

- [ ] README.md (Scout section: key pool, 60% cap, Mistral backup, `MISTRAL_API_KEY` env) + CHANGELOG.md line.
- [ ] Final review of the branch (code-reviewer), fix Critical/Important with a failing test first.
- [ ] Show `git diff --staged` summary, wait for "push it". Then: apply 0032 in the Supabase SQL editor, push, deploy to Vercel.
- [ ] Alvaro creates a free Mistral account (Experiment plan, no card) → key in Vercel env `MISTRAL_API_KEY` → `curl -s https://api.mistral.ai/v1/models -H "Authorization: Bearer …"` confirms `mistral-medium-latest` / `mistral-small-latest` exist (adjust `models.ts` if not).
- [ ] Live check: one Scout search; log shows the pool line and tokens; `ai_key_usage` rows appear.
