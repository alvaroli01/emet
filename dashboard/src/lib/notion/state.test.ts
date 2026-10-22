import { test } from "node:test";
import assert from "node:assert/strict";

process.env.AI_KEY_SECRET = Buffer.alloc(32, 7).toString("base64");
const { signState, verifyState } = await import("./state.ts");

const NOW = Date.parse("2026-10-22T10:00:00Z");

test("a state made for me is accepted when it comes back", () => {
  assert.equal(verifyState(signState("me", NOW), "me", NOW + 60_000), true);
});

test("someone else's state is refused", () => {
  assert.equal(verifyState(signState("someone-else", NOW), "me", NOW), false);
});

test("a state older than 10 minutes is refused", () => {
  assert.equal(verifyState(signState("me", NOW), "me", NOW + 10 * 60_000 + 1), false);
});

test("a tampered or garbage state is refused", () => {
  const s = signState("me", NOW);
  assert.equal(verifyState(s.slice(0, -2) + (s.endsWith("A") ? "BB" : "AA"), "me", NOW), false);
  assert.equal(verifyState("nonsense", "me", NOW), false);
  assert.equal(verifyState("", "me", NOW), false);
});
