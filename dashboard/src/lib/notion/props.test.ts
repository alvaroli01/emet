import { test } from "node:test";
import assert from "node:assert/strict";
import { readProp, titleOf } from "./props.ts";
import { detectMap, toDeadlines } from "./deadlines.ts";

const rt = (t: string) => [{ plain_text: t }];

test("every common Notion column type reads as text", () => {
  assert.equal(readProp({ type: "title", title: rt("Essay") }).text, "Essay");
  assert.equal(readProp({ type: "rich_text", rich_text: rt("notes") }).text, "notes");
  assert.equal(readProp({ type: "number", number: 4.5 }).text, "4.5");
  assert.equal(readProp({ type: "select", select: { name: "Uni" } }).text, "Uni");
  assert.equal(readProp({ type: "multi_select", multi_select: [{ name: "a" }, { name: "b" }] }).text, "a, b");
  assert.equal(readProp({ type: "status", status: { name: "Done" } }).text, "Done");
  assert.deepEqual(readProp({ type: "date", date: { start: "2026-10-24", end: null } }).date, { start: "2026-10-24", end: null });
  assert.equal(readProp({ type: "checkbox", checkbox: true }).checked, true);
  assert.equal(readProp({ type: "people", people: [{ name: "Ana" }] }).text, "Ana");
  assert.equal(readProp({ type: "url", url: "https://x.io" }).url, "https://x.io");
  assert.equal(readProp({ type: "url", url: "javascript:x" }).url, undefined);
  assert.equal(readProp({ type: "formula", formula: { type: "number", number: 3 } }).text, "3");
  assert.equal(readProp({ type: "select", select: null }).text, "");
  assert.equal(titleOf({ properties: { Name: { type: "title", title: rt("Page A") } } }), "Page A");
  assert.equal(titleOf({ properties: {} }), "Untitled");
});

const schema = {
  Name: { type: "title" },
  Created: { type: "created_time" },
  Due: { type: "date" },
  Status: { type: "status", status: { options: [{ id: "1", name: "To do" }, { id: "2", name: "Done" }], groups: [{ name: "To-do", option_ids: ["1"] }, { name: "Complete", option_ids: ["2"] }] } },
};

test("finds the title, date and 'done' columns by itself", () => {
  assert.deepEqual(detectMap(schema), { title: "Name", date: "Due", done: "Status", doneValue: "Done" });
  assert.deepEqual(detectMap({ Task: { type: "title" }, When: { type: "date" }, Finished: { type: "checkbox" } }), { title: "Task", date: "When", done: "Finished" });
  assert.equal(detectMap({ Name: { type: "title" } }), null);
});

const row = (id: string, name: string, date: { start: string; end?: string | null } | null, status = "To do") => ({
  id, url: `https://notion.so/${id}`,
  properties: { Name: { type: "title", title: rt(name) }, Due: { type: "date", date }, Status: { type: "status", status: { name: status } } },
});

test("rows become deadlines in Madrid time; rows without a date are skipped", () => {
  const out = toDeadlines([
    row("a", "Essay", { start: "2026-10-24" }),
    row("b", "Exam", { start: "2026-10-27T08:00:00.000+00:00", end: "2026-10-27T10:00:00.000+00:00" }, "Done"),
    row("c", "No date", null),
  ], { title: "Name", date: "Due", done: "Status", doneValue: "Done" });
  assert.deepEqual(out, [
    { id: "a", title: "Essay", day: "2026-10-24", start: null, end: null, done: false, url: "https://notion.so/a" },
    { id: "b", title: "Exam", day: "2026-10-27", start: "09:00", end: "11:00", done: true, url: "https://notion.so/b" },
  ]);
});
