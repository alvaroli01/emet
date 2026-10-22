import { test } from "node:test";
import assert from "node:assert/strict";
import { spans, toRender, markdownToBlocks, chunk } from "./blocks.ts";

const rt = (content: string, extra: Record<string, unknown> = {}, href: string | null = null) =>
  ({ type: "text", text: { content, link: href ? { url: href } : null }, plain_text: content, href, annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: "default", ...extra } });
const block = (type: string, data: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({ id: `b-${type}`, type, has_children: false, [type]: data, ...extra });

test("rich text keeps formatting and safe links only", () => {
  assert.deepEqual(spans([rt("Hi", { bold: true }), rt(" there", { italic: true, color: "red" })]),
    [{ text: "Hi", bold: true }, { text: " there", italic: true, color: "red" }]);
  assert.equal(spans([rt("site", {}, "https://example.com")])[0].href, "https://example.com");
  assert.equal(spans([rt("mail", {}, "mailto:a@b.co")])[0].href, "mailto:a@b.co");
  assert.equal(spans([rt("evil", {}, "javascript:alert(1)")])[0].href, undefined);
});

test("every supported block type becomes a render node", () => {
  const out = toRender([
    block("heading_1", { rich_text: [rt("Title")] }),
    block("heading_3", { rich_text: [rt("Small")] }),
    block("paragraph", { rich_text: [rt("Text")] }),
    block("quote", { rich_text: [rt("Q")] }),
    block("callout", { rich_text: [rt("Note")], icon: { type: "emoji", emoji: "💡" } }),
    block("bulleted_list_item", { rich_text: [rt("a")] }),
    block("numbered_list_item", { rich_text: [rt("1")] }),
    block("to_do", { rich_text: [rt("buy")], checked: true }),
    block("toggle", { rich_text: [rt("more")] }, { children: [block("paragraph", { rich_text: [rt("inside")] })] }),
    block("code", { rich_text: [rt("x = 1")], language: "python" }),
    block("divider", {}),
    block("image", { type: "external", external: { url: "https://img/x.png" }, caption: [] }),
    block("file", { type: "file", file: { url: "https://files/x.pdf" }, caption: [rt("doc")] }),
    block("bookmark", { url: "https://example.com", caption: [] }),
    block("child_page", { title: "Sub page" }),
    block("child_database", { title: "Tasks" }),
  ]);
  assert.deepEqual(out.map((n) => n.kind), ["heading", "heading", "paragraph", "quote", "callout", "bullet", "number", "todo", "toggle", "code", "divider", "image", "file", "bookmark", "child", "child"]);
  assert.equal((out[1] as { level: number }).level, 3);
  assert.equal((out[4] as { icon?: string }).icon, "💡");
  assert.equal((out[7] as { checked?: boolean }).checked, true);
  assert.equal((out[8] as { children: { kind: string }[] }).children[0].kind, "paragraph");
  assert.equal((out[9] as { language: string }).language, "python");
  assert.equal((out[11] as { url: string }).url, "https://img/x.png");
  assert.deepEqual([(out[14] as { db: boolean }).db, (out[15] as { db: boolean }).db], [false, true]);
});

test("tables and columns", () => {
  const [table, cols] = toRender([
    block("table", { table_width: 2, has_column_header: true }, { children: [
      block("table_row", { cells: [[rt("A")], [rt("B")]] }), block("table_row", { cells: [[rt("1")], [rt("2")]] }),
    ] }),
    block("column_list", {}, { children: [
      block("column", {}, { children: [block("paragraph", { rich_text: [rt("left")] })] }),
      block("column", {}, { children: [block("paragraph", { rich_text: [rt("right")] })] }),
    ] }),
  ]) as [{ rows: { text: string }[][][]; header: boolean }, { columns: { kind: string }[][] }];
  assert.equal(table.header, true);
  assert.equal(table.rows[1][1][0].text, "2");
  assert.equal(cols.columns.length, 2);
});

test("a block type we don't know is kept as 'open in Notion'", () => {
  assert.deepEqual(toRender([block("synced_block", {})]), [{ kind: "unsupported", type: "synced_block", id: "b-synced_block" }]);
});

test("markdown becomes Notion blocks", () => {
  const b = markdownToBlocks("# Meeting\n\nSome **bold** and [a link](https://x.io).\n\n- one\n- [ ] todo\n- [x] done\n1. first\n> quote\n---\n```js\nlet a\n```\n| A | B |\n| --- | --- |\n| 1 | 2 |") as { type: string; [k: string]: unknown }[];
  assert.deepEqual(b.map((x) => x.type), ["heading_1", "paragraph", "bulleted_list_item", "to_do", "to_do", "numbered_list_item", "quote", "divider", "code", "table"]);
  const para = (b[1].paragraph as { rich_text: { text: { content: string; link: { url: string } | null }; annotations?: { bold?: boolean } }[] }).rich_text;
  assert.equal(para.find((r) => r.text.content === "bold")?.annotations?.bold, true);
  assert.equal(para.find((r) => r.text.content === "a link")?.text.link?.url, "https://x.io");
  assert.equal((b[3].to_do as { checked: boolean }).checked, false);
  assert.equal((b[4].to_do as { checked: boolean }).checked, true);
  assert.equal((b[8].code as { language: string }).language, "javascript");
  const table = b[9].table as { table_width: number; has_column_header: boolean; children: unknown[] };
  assert.deepEqual([table.table_width, table.has_column_header, table.children.length], [2, true, 2]);
});

test("long text is split into Notion's 2000-character pieces", () => {
  const [p] = markdownToBlocks("x".repeat(4500)) as { paragraph: { rich_text: { text: { content: string } }[] } }[];
  assert.deepEqual(p.paragraph.rich_text.map((r) => r.text.content.length), [2000, 2000, 500]);
});

test("blocks are sent 100 at a time", () => {
  assert.deepEqual(chunk(Array.from({ length: 250 }, (_, i) => i)).map((c) => c.length), [100, 100, 50]);
});
