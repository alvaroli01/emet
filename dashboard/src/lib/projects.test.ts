import { test } from "node:test";
import assert from "node:assert/strict";
import { linkKind, cleanUrl, progress, daysLeft, cardHref } from "./projects.ts";

test("link kinds", () => {
  assert.equal(linkKind("https://docs.google.com/document/d/abc/edit"), "doc");
  assert.equal(linkKind("https://docs.google.com/spreadsheets/d/abc"), "sheet");
  assert.equal(linkKind("https://docs.google.com/presentation/d/abc"), "slides");
  assert.equal(linkKind("https://docs.google.com/forms/d/abc"), "form");
  assert.equal(linkKind("https://drive.google.com/drive/folders/abc"), "drive");
  assert.equal(linkKind("https://www.canva.com/design/abc"), "canva");
  assert.equal(linkKind("https://www.notion.so/x"), "notion");
  assert.equal(linkKind("https://www.figma.com/file/x"), "figma");
  assert.equal(linkKind("https://example.com"), "other");
  assert.equal(linkKind("https://1drv.ms/x.pptx"), "slides");
  assert.equal(linkKind("https://x.sharepoint.com/:x:/r/book.xlsx"), "sheet");
});

test("links are cleaned to https or refused", () => {
  assert.equal(cleanUrl("  docs.google.com/document/d/a "), "https://docs.google.com/document/d/a");
  assert.equal(cleanUrl("http://example.com/a"), "https://example.com/a");
  assert.equal(cleanUrl("https://example.com/a b"), null);
  assert.equal(cleanUrl("javascript:alert(1)"), null);
  assert.equal(cleanUrl("mailto:a@b.c"), null);
  assert.equal(cleanUrl(""), null);
});

test("goal progress and days left", () => {
  assert.equal(progress(640, 2000), 0.32);
  assert.equal(progress(3000, 2000), 1);
  assert.equal(progress(100, null), null);
  assert.equal(daysLeft("2026-10-31", "2026-10-21"), 10);
  assert.equal(daysLeft("2026-10-20", "2026-10-21"), -1);
  assert.equal(daysLeft(null, "2026-10-21"), null);
});

test("task links open the right place", () => {
  const slug = (g: string) => (g === "g1" ? "finance" : undefined);
  assert.equal(cardHref({ id: "c", boards: { group_id: null, project_id: "p" } }, slug), "/projects/p?tab=tasks&card=c");
  assert.equal(cardHref({ id: "c", boards: { group_id: "g1" } }, slug), "/g/finance?card=c");
  assert.equal(cardHref({ id: "c", boards: { group_id: null } }, slug), "/board?card=c");
});
