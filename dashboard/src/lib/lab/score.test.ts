import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreOf, verdictOf, normalize, finalVerdict } from "./score.ts";

const all = (n: number) => ["demand", "margin", "startup_cost", "time_to_cash", "scale_to_goal", "team_fit", "low_risk"].map((key) => ({ key, score: n }));

test("score is the weighted 1–10 average scaled to 100", () => {
  assert.equal(scoreOf(all(10)), 100);
  assert.equal(scoreOf(all(5)), 50);
  // demand and margin weigh most: a great-demand, terrible-margin idea is not 'strong'
  const lopsided = all(9).map((c) => (c.key === "margin" ? { ...c, score: 1 } : c));
  assert.ok(scoreOf(lopsided) < 75);
});

test("verdict thresholds", () => {
  assert.equal(verdictOf(80), "strong");
  assert.equal(verdictOf(65), "promising");
  assert.equal(verdictOf(50), "weak");
  assert.equal(verdictOf(30), "not_recommended");
});

test("normalize ignores the model's own score and cleans bad input", () => {
  const a = normalize({ score: 99, verdict: "strong", criteria: [...all(4), { key: "made_up", score: 10 }], strengths: ["x", 3, ""], variations: [{ title: "Better", pitch: "p" }, {}] });
  assert.ok(a);
  assert.equal(a!.score, 40);
  assert.equal(a!.verdict, "not_recommended");
  assert.deepEqual(a!.strengths, ["x"]);
  assert.equal(a!.variations.length, 1);
  assert.equal(normalize({ criteria: all(5).slice(0, 2) }), null);
});

// ── Accuracy rules (2026-10-21): fatal flaws can't be averaged away; the council's chairman can only make it harsher ──
const withScore = (over: Record<string, number>) => all(9).map((c) => ({ ...c, score: over[c.key] ?? c.score }));

test("no customers = not recommended, however cheap and easy (selling lemons to investors)", () => {
  const s = scoreOf(withScore({ demand: 2 }));
  assert.ok(s <= 44, `score ${s}`);
});

test("a margin or a path to €30K of 3 or less also caps the idea", () => {
  assert.ok(scoreOf(withScore({ margin: 3 })) <= 44);
  assert.ok(scoreOf(withScore({ scale_to_goal: 2 })) <= 44);
  assert.ok(scoreOf(withScore({ demand: 4 })) > 44); // 4 is weak, not fatal
});

test("an idea that doesn't make sense as written is capped too", () => {
  const raw = { summary: "x", criteria: all(8).map((c) => ({ ...c, why: "y" })), idea_as_written: { customer: "investors", offer: "lemons", why_they_buy: "none", makes_sense: false, problem: "investors don't buy lemons" } };
  const a = normalize(raw)!;
  assert.equal(a.verdict, "not_recommended");
  assert.ok(a.score <= 44);
  assert.equal(a.as_written?.makes_sense, false);
});

test("the chairman can only make the verdict harsher", () => {
  assert.equal(finalVerdict("strong", "drop"), "not_recommended");
  assert.equal(finalVerdict("strong", "test"), "promising");
  assert.equal(finalVerdict("promising", "go"), "promising");
  assert.equal(finalVerdict("weak", "go"), "weak");
  assert.equal(finalVerdict("not_recommended", "go"), "not_recommended");
  assert.equal(finalVerdict("strong", null), "strong");
});
