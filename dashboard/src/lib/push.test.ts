import { test } from "node:test";
import assert from "node:assert/strict";
import { pushPayload } from "./push.ts";

const tr = (key: string, v?: Record<string, unknown>) => `${key}${v ? JSON.stringify(v) : ""}`;

test("a task notification becomes a phone alert that opens the task", () => {
  const p = pushPayload({ id: "n1", kind: "assigned", data: { title: "Print flyers", due: "2026-10-30" }, link: "/g/marketing?card=c1" }, tr);
  assert.equal(p.title, "push.titles.assigned");
  assert.match(p.body, /^notifications\.kinds\.assigned/);
  assert.match(p.body, /"title":"Print flyers"/);
  assert.match(p.body, /"due":"2026-10-30"/);
  assert.equal(p.url, "/g/marketing?card=c1");
  assert.equal(p.tag, "n1");
});

test("links stay inside emet", () => {
  assert.equal(pushPayload({ id: "n", kind: "due_soon", data: {}, link: "https://evil.example" }, tr).url, "/");
  assert.equal(pushPayload({ id: "n", kind: "due_soon", data: {}, link: null }, tr).url, "/");
});

test("missing values never break the text", () => {
  const p = pushPayload({ id: "n", kind: "project_post", data: { project: "Stall" }, link: "/projects/1" }, tr);
  assert.match(p.body, /"title":""/);
});

test("the bell gets every value too (project / name were missing before 27 Oct)", async () => {
  const { noteValues } = await import("./push.ts");
  const v = noteValues({ project: "Sunset Sessions", n: 3 });
  assert.equal(v.project, "Sunset Sessions");
  assert.equal(v.name, "");
  assert.equal(v.n, "3");
});
