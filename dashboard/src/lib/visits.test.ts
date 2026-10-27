import { test } from "node:test";
import assert from "node:assert/strict";
import { byVisit, VISIT_RESULTS } from "./visits.ts";

const items = [{ id: "a", visited_on: null }, { id: "b", visited_on: "2026-10-20" }, { id: "c", visited_on: null }];

test("filter places: not visited yet, already visited, or all", () => {
  assert.deepEqual(byVisit(items, "todo").map((x) => x.id), ["a", "c"]);
  assert.deepEqual(byVisit(items, "visited").map((x) => x.id), ["b"]);
  assert.deepEqual(byVisit(items, "all").map((x) => x.id), ["a", "b", "c"]);
});

test("a visit went well, maybe, or not", () => {
  assert.deepEqual(VISIT_RESULTS, ["yes", "maybe", "no"]);
});
