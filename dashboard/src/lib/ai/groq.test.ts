import { test } from "node:test";
import assert from "node:assert/strict";
import { splitTranscript } from "./groq.ts";

test("short transcripts stay in one piece", () => {
  assert.deepEqual(splitTranscript("Hola. Esto es corto."), ["Hola. Esto es corto."]);
});

test("long transcripts split at sentence ends and lose nothing", () => {
  const text = Array.from({ length: 400 }, (_, i) => `Sentence number ${i} about pricing.`).join(" ");
  const parts = splitTranscript(text, 2000);
  assert.ok(parts.length > 1);
  assert.ok(parts.every((p) => p.length <= 2000));
  assert.ok(parts.slice(0, -1).every((p) => p.endsWith(".")));
  assert.equal(parts.join(" ").replace(/\s+/g, " "), text);
});
