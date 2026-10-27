import { test } from "node:test";
import assert from "node:assert/strict";
import { writeNotes, type NotesStep } from "./notes-steps.ts";

const long = Array.from({ length: 300 }, (_, i) => `Sentence number ${i} about the stall budget.`).join(" "); // ~13k chars per 300
const longer = `${long} ${long} ${long}`; // 3 parts

test("a short transcript is one request", async () => {
  const calls: NotesStep[] = [];
  const md = await writeNotes("We agreed to print 200 flyers.", async (s) => { calls.push(s); return { markdown: "## Summary\nFlyers." }; }, async () => {});
  assert.equal(md, "## Summary\nFlyers.");
  assert.deepEqual(calls.map((c) => c.mode), ["whole"]);
});

test("a long transcript: one request per part, then one merge", async () => {
  const calls: NotesStep[] = [];
  const md = await writeNotes(longer, async (s) => { calls.push(s); return { markdown: s.mode === "merge" ? "merged" : `part ${s.index}` }; }, async () => {});
  assert.equal(md, "merged");
  assert.deepEqual(calls.map((c) => c.mode), ["part", "part", "part", "merge"]);
  assert.deepEqual(calls.at(-1)!.notes, ["part 1", "part 2", "part 3"]);
  assert.equal(calls[0].lang, "en");
});

test("a rate limit waits and retries that part only — nothing is redone", async () => {
  const calls: NotesStep[] = [];
  const waits: number[] = [];
  let limited = false;
  const md = await writeNotes(longer, async (s) => {
    calls.push(s);
    if (s.mode === "part" && s.index === 2 && !limited) { limited = true; return { error: "limit", retryAfter: 20 }; }
    return { markdown: s.mode === "merge" ? "merged" : `part ${s.index}` };
  }, async (ms) => { waits.push(ms); });
  assert.equal(md, "merged");
  assert.deepEqual(waits, [20_000]);
  assert.deepEqual(calls.map((c) => `${c.mode}${c.index ?? ""}`), ["part1", "part2", "part2", "part3", "merge"]);
});

test("a hard failure gives up (no notes) instead of looping", async () => {
  let n = 0;
  const md = await writeNotes("Short talk.", async () => { n++; return { error: "bad-key" }; }, async () => {});
  assert.equal(md, null);
  assert.equal(n, 1);
});

test("endless limits stop after a fair number of waits", async () => {
  let n = 0;
  const md = await writeNotes("Short talk.", async () => { n++; return { error: "limit", retryAfter: 1 }; }, async () => {});
  assert.equal(md, null);
  assert.ok(n > 3 && n <= 12, `tried ${n} times`);
});
