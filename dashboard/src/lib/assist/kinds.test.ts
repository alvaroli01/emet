import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanValues, cleanActions, kindsFor } from "./kinds.ts";

test("sections only get their own kinds", () => {
  assert.deepEqual(kindsFor("finance").sort(), ["blocker", "expense", "sale", "task"]);
  assert.ok(!kindsFor("marketing").includes("sale"));
});

test("values are typed and required fields enforced", () => {
  assert.deepEqual(cleanValues("sale", { description: "Tote bag", amount: "25,50 €", payment_method: "Bizum", heard_about: "billboard", extra: "x" }),
    { description: "Tote bag", amount: 25.5, payment_method: "bizum" });
  assert.equal(cleanValues("sale", { description: "No amount" }), null);
  assert.equal(cleanValues("sale", { description: "Neg", amount: -5 }), null);
  assert.deepEqual(cleanValues("task", { title: "Call printer", due: "2026-10-20T10:00" }), { title: "Call printer", due: "2026-10-20" });
});

test("actions: unknown kinds, foreign kinds and unknown tools are dropped", () => {
  const a = cleanActions("marketing", [
    { type: "create", kind: "sale", values: { description: "x", amount: 3 } },
    { type: "create", kind: "content", values: { title: "Reel: tote" } },
    { type: "open_tool", tab: "pulse" }, { type: "open_tool", tab: "../admin" }, { type: "delete", table: "sales" },
  ], ["board", "pulse"]);
  assert.deepEqual(a, [{ type: "create", kind: "content", values: { title: "Reel: tote" } }, { type: "open_tool", tab: "pulse" }]);
});
