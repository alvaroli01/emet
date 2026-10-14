import { test } from "node:test";
import assert from "node:assert/strict";
import { splitTranscript, isPhantom, mainLanguage } from "./groq.ts";

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

test("Whisper's phantom words on silence are dropped, real speech is kept", () => {
  for (const p of ["you", " Thank you.", "Gracias.", "Subtítulos realizados por la comunidad de Amara.org"]) assert.ok(isPhantom(p), p);
  for (const r of ["You need to log every sale.", "Gracias a todos por venir, empezamos con precios."]) assert.ok(!isPhantom(r), r);
});

test("main language picks the right headings", () => {
  assert.equal(mainLanguage("Hoy en la clase hablamos de precios y de las ventas. And now in English for a minute."), "es");
  assert.equal(mainLanguage("Our goal is to log every sale within a day, and we review it on Friday."), "en");
});
