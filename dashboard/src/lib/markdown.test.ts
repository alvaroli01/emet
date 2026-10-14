import { test } from "node:test";
import assert from "node:assert/strict";
import { mdToHtml, mdBlocks } from "./markdown.ts";

test("escapes HTML so shared docs can never run code", () => {
  const html = mdToHtml('<img src=x onerror="alert(1)"> **hi**');
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;img"));
  assert.ok(html.includes("<strong>hi</strong>"));
});

test("headings, lists, checkboxes and paragraphs", () => {
  const html = mdToHtml("# Title\n## Sub\n- one\n- two\n- [x] done\n- [ ] todo\n1. first\n\nPlain _text_");
  assert.ok(html.includes("<h1>Title</h1>"));
  assert.ok(html.includes("<h2>Sub</h2>"));
  assert.ok(html.includes("<ul><li>one</li><li>two</li>"));
  assert.ok(html.includes('data-done="true"'));
  assert.ok(html.includes("<ol><li>first</li></ol>"));
  assert.ok(html.includes("<p>Plain <em>text</em></p>"));
});

test("only http(s) links become links", () => {
  assert.ok(mdToHtml("[site](https://emet.app)").includes('<a href="https://emet.app"'));
  assert.ok(!mdToHtml("[x](javascript:alert(1))").includes("<a "));
});

test("blocks keep structure for Word export", () => {
  const b = mdBlocks("# T\n- a\n- [x] b\ntext **bold**");
  assert.deepEqual(b.map((x) => x.type), ["h1", "bullet", "check", "p"]);
  assert.equal(b[2].done, true);
  assert.deepEqual(b[3].runs, [{ text: "text " }, { text: "bold", bold: true }]);
});
