import { test } from "node:test";
import assert from "node:assert/strict";
import { missingNotes, withNotes } from "./doc-notes.ts";

const doc = "_Key points couldn't be written this time — the full transcript is below._\n\n## Transcript\n\nHola equipo. Hoy hablamos del stand.\n\n_Uploaded file: memo.m4a · 31 min_";

test("a recording saved without notes is spotted, and its transcript read back", () => {
  assert.equal(missingNotes(doc), "Hola equipo. Hoy hablamos del stand.");
});

test("docs that already have notes, or nothing heard, are left alone", () => {
  assert.equal(missingNotes("## Summary\nStuff\n\n## Transcript\n\nHola."), null);
  assert.equal(missingNotes("_Nothing was heard._\n\n_Recorded · 2 min_"), null);
  assert.equal(missingNotes("My own note"), null);
});

test("the new notes replace only the 'couldn't be written' line", () => {
  assert.equal(withNotes(doc, "## Resumen\nEl stand."),
    "## Resumen\nEl stand.\n\n## Transcript\n\nHola equipo. Hoy hablamos del stand.\n\n_Uploaded file: memo.m4a · 31 min_");
});
