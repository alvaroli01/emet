import { test } from "node:test";
import assert from "node:assert/strict";
import { exportMarkdown } from "./export.ts";

test("a meeting becomes notes + transcript", () => {
  const md = exportMarkdown("meeting", { title: "Weekly", meeting_date: "2026-10-21", notes: "## Summary\n\n- shipped", transcript: "Hello all" });
  assert.equal(md.title, "Weekly — 2026-10-21");
  assert.match(md.body, /## Summary[\s\S]*## Transcript\n\nHello all/);
});

test("an Idea Lab analysis becomes a readable report with the council's verdict", () => {
  const md = exportMarkdown("idea", { title: "Lemonade stall", pitch: "Sell lemonade on campus", score: 62,
    analysis: { summary: "Cheap to test", verdict: "promising", criteria: [{ key: "demand", score: 7, why: "Students buy drinks" }], strengths: ["low cost"], weaknesses: ["seasonal"], risks: [], test_in_7_days: ["One stall day"] },
    chairman: { verdict: "test", summary: "Try one day", first_step: "Book a table" } });
  assert.equal(md.title, "Lemonade stall — 62/100");
  for (const part of ["Sell lemonade on campus", "Cheap to test", "**demand** 7/10 — Students buy drinks", "- low cost", "## Council", "Book a table"]) assert.ok(md.body.includes(part), part);
});

test("very long transcripts are cut so the page stays usable", () => {
  const md = exportMarkdown("meeting", { title: "Long", meeting_date: null, notes: "", transcript: "x".repeat(60_000) });
  assert.ok(md.body.length < 42_000);
});

test("a doc and a project update", () => {
  assert.deepEqual(exportMarkdown("doc", { title: "Plan", body: "Text", doc_date: "2026-10-20" }), { title: "Plan — 2026-10-20", body: "Text" });
  assert.deepEqual(exportMarkdown("project_update", { body: "We met the client", created_at: "2026-10-22T09:00:00Z", project: "Website" }), { title: "Website update — 2026-10-22", body: "We met the client" });
});
