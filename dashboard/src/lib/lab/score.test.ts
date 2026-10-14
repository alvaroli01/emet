import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreOf, verdictOf, normalize } from "./score.ts";

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
