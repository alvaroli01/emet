import { test } from "node:test";
import assert from "node:assert/strict";
import { median, hits, hitRate, shareSaveRate, tagWinners, revenueByChannel, disagreement, revenuePerStallHour, type Content, type Metric } from "./marketing.ts";

const post = (id: string, day: number, tags = {}): Content => ({ id, title: id, platform: "instagram", status: "posted", tags, posted_at: new Date(Date.UTC(2026, 9, day)).toISOString(), planned_for: null, decision: null, owner_id: null });
const m = (id: string, views: number, reach = 100, saves = 0, shares = 0): Metric => ({ content_id: id, age_hours: 168, views, reach, saves, shares });

test("median", () => { assert.equal(median([3, 1, 2]), 2); assert.equal(median([4, 1, 3, 2]), 2.5); assert.equal(median([]), null); });

test("hits are judged against our own median, not internet benchmarks", () => {
  const items = [post("a", 1), post("b", 2), post("c", 3), post("d", 10)];
  const ms = [m("a", 100), m("b", 120), m("c", 80), m("d", 260)];
  const h = hits(items, ms);
  assert.equal(h.find((x) => x.id === "d")!.hit, true);    // 260 ≥ 2 × median(100,120,80)=200
  assert.equal(h.find((x) => x.id === "a")!.hit, false);
  assert.equal(hitRate(items, ms), 0.25);
});

test("share+save rate per reach", () => {
  assert.equal(shareSaveRate(m("x", 0, 200, 6, 4)), 0.05);
  assert.equal(shareSaveRate(m("x", 0, 0)), null);
});

test("tag winners: question hooks beat claims", () => {
  const items = [post("1", 1, { hook_message: "question" }), post("2", 2, { hook_message: "question" }), post("3", 3, { hook_message: "claim" }), post("4", 4, { hook_message: "claim" })];
  const ms = [m("1", 0, 100, 8, 4), m("2", 0, 100, 6, 4), m("3", 0, 100, 1, 0), m("4", 0, 100, 2, 0)];
  const w = tagWinners(items, ms);
  assert.equal(w.doMore[0].value, "question");
  assert.equal(w.stop[0].value, "claim");
});

test("attribution: survey decides offline, code decides online; disagreement rate", () => {
  const codes = { IG10: "instagram" };
  const sales = [
    { amount: 10, heard_about: "stall", code: "IG10", utm_source: null },
    { amount: 20, heard_about: "instagram", code: "IG10", utm_source: null },
    { amount: 5, heard_about: "tiktok", code: null, utm_source: "instagram" },
  ];
  assert.deepEqual(revenueByChannel(sales, codes), [{ channel: "instagram", revenue: 25 }, { channel: "stall", revenue: 10 }]);
  assert.equal(disagreement(sales, codes), 2 / 3);
});

test("revenue per stall-hour", () => {
  assert.equal(revenuePerStallHour([{ id: "s", opened_at: "10:00", closed_at: "14:00" }], [{ stall_id: "s", amount: 120 }, { stall_id: null, amount: 50 }]), 30);
});
