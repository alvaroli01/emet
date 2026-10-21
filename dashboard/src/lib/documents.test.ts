import { test } from "node:test";
import assert from "node:assert/strict";
import { isTooBig, safeName, storagePath, breadcrumb, childrenOf, descendants, fileKind, formatSize, isNew } from "./documents.ts";

test("25 MB limit", () => {
  assert.equal(isTooBig(26214400), false);
  assert.equal(isTooBig(26214401), true);
});

test("safe storage names keep the file recognisable", () => {
  assert.equal(safeName("Team Contract.pdf"), "Team Contract.pdf");
  assert.equal(safeName("../../etc/passwd"), "etc_passwd");
  assert.equal(safeName("a/b\\c?d#e%f.pdf"), "a_b_c_d_e_f.pdf");
  assert.equal(safeName("Presupuesto ñandú 🎉.xlsx"), "Presupuesto ñandú _.xlsx");
  assert.equal(safeName("   "), "file");
  const long = safeName("x".repeat(300) + ".pdf");
  assert.ok(long.length <= 120 && long.endsWith(".pdf"));
});

test("storage paths: company vs personal, unique by file id", () => {
  assert.equal(storagePath("company", null, "f1", "a.pdf"), "company/f1/a.pdf");
  assert.equal(storagePath("personal", "p9", "f2", "a.pdf"), "personal/p9/f2/a.pdf");
  assert.notEqual(storagePath("company", null, "f1", "a.pdf"), storagePath("company", null, "f3", "a.pdf"));
});

const F = (id: string, name: string, parent_id: string | null) => ({ id, name, parent_id, created_at: "2026-10-01T00:00:00Z" });
const D = (id: string, name: string, folder_id: string | null) => ({ id, name, folder_id, size: 1, mime: "application/pdf", path: `company/${id}/${name}`, uploaded_by: null, created_at: "2026-10-01T00:00:00Z" });
const folders = [F("a", "Contracts", null), F("b", "2026", "a"), F("c", "Guides", null), F("d", "Old", "b")];
const files = [D("1", "z.pdf", null), D("2", "B.pdf", "a"), D("3", "a.pdf", "a"), D("4", "deep.pdf", "d")];

test("breadcrumb from the top", () => {
  assert.deepEqual(breadcrumb(folders, "d").map((f) => f.name), ["Contracts", "2026", "Old"]);
  assert.deepEqual(breadcrumb(folders, null), []);
});

test("folders first, then files, alphabetical", () => {
  const top = childrenOf(folders, files, null);
  assert.deepEqual(top.folders.map((f) => f.name), ["Contracts", "Guides"]);
  assert.deepEqual(top.files.map((f) => f.name), ["z.pdf"]);
  assert.deepEqual(childrenOf(folders, files, "a").files.map((f) => f.name), ["a.pdf", "B.pdf"]);
});

test("deleting a folder finds every file inside, however deep", () => {
  const d = descendants(folders, files, "a");
  assert.deepEqual(d.folderIds.sort(), ["a", "b", "d"]);
  assert.deepEqual(d.paths.sort(), ["company/2/B.pdf", "company/3/a.pdf", "company/4/deep.pdf"]);
});

test("pdf and images open, the rest downloads", () => {
  assert.equal(fileKind("application/pdf", "x"), "pdf");
  assert.equal(fileKind("", "Report.PDF"), "pdf");
  assert.equal(fileKind("image/png", "x.png"), "image");
  assert.equal(fileKind("application/vnd.ms-excel", "x.xls"), "other");
});

test("sizes and the New badge", () => {
  assert.equal(formatSize(900, "en"), "900 B");
  assert.equal(formatSize(1536, "en"), "1.5 KB");
  assert.equal(formatSize(26214400, "en"), "25 MB");
  const now = Date.parse("2026-10-21T12:00:00Z");
  assert.equal(isNew("2026-10-15T12:00:01Z", now), true);
  assert.equal(isNew("2026-10-14T12:00:00Z", now), false);
});
