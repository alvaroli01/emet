import { test } from "node:test";
import assert from "node:assert/strict";
import { KeyRing, canUse, waitSeconds, badTag, type PoolKey, type UsageRow } from "./pool.ts";

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
  assert.equal(canUse(ana, "openai/gpt-oss-20b", [{ owner_id: "ana", model: badTag("k1"), tokens: 0, limited_until: null, bad: true }], NOW), false);
});

test("a key the owner replaced is not blocked by the old key's rejection", () => {
  const fresh: PoolKey = { owner: "ana", key: "new-key", own: false };
  assert.equal(canUse(fresh, M, [{ owner_id: "ana", model: badTag("k1"), tokens: 0, limited_until: null, bad: true }], NOW), true);
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
  assert.equal(ring.isBad(own), false);
  assert.equal(ring.isBad(ana), true);
  assert.deepEqual(saved, [{ owner: "ana", model: M, tokens: 700 }, { owner: "me", model: M, until: new Date(NOW + 60_000).toISOString() }, { owner: "ana", model: badTag("k1"), bad: true }]);
});

test("a failing save never breaks the search", async () => {
  const ring = new KeyRing([own], [], () => { throw new Error("db down"); });
  await ring.used(own, M, 10);
  assert.equal(ring.tokens, 10);
});

test("no wait when nothing is waiting or capped", () => {
  assert.equal(waitSeconds([own, ana], [M], [row("ana", 5)], NOW), null);
});

test("the rejection mark never contains the key itself", () => {
  assert.match(badTag("gsk_secret123456"), /^bad:[0-9a-f]{12}$/);
  assert.equal(badTag("gsk_secret123456").includes("secret"), false);
});
