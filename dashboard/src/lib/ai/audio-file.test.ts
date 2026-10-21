import { test } from "node:test";
import assert from "node:assert/strict";
import { planPieces, toWav, isSilent, MAX_SECONDS, PIECE_SECONDS, SAMPLE_RATE } from "./audio-file.ts";

test("pieces are 2 minutes, the last one shorter", () => {
  const p = planPieces(SAMPLE_RATE * 300); // 5 minutes
  assert.deepEqual(p.map((x) => [x.start, x.end]), [[0, SAMPLE_RATE * 120], [SAMPLE_RATE * 120, SAMPLE_RATE * 240], [SAMPLE_RATE * 240, SAMPLE_RATE * 300]]);
});

test("a tiny tail is merged into the previous piece instead of sent alone", () => {
  const p = planPieces(SAMPLE_RATE * (240 + 3));
  assert.equal(p.length, 2);
  assert.equal(p[1].end, SAMPLE_RATE * 243);
});

test("each 2-minute piece fits under Vercel's 4.5 MB request limit", () => {
  const wav = toWav(new Float32Array(SAMPLE_RATE * PIECE_SECONDS));
  assert.ok(wav.size < 4.5 * 1024 * 1024, `${wav.size}`);
});

test("WAV header: 16 kHz, mono, 16-bit, right lengths", async () => {
  const wav = toWav(new Float32Array([0, 1, -1, 0.5]));
  const b = new DataView(await wav.arrayBuffer());
  const s = (o: number, n: number) => String.fromCharCode(...new Uint8Array(b.buffer, o, n));
  assert.equal(s(0, 4), "RIFF"); assert.equal(s(8, 4), "WAVE"); assert.equal(s(36, 4), "data");
  assert.equal(b.getUint16(22, true), 1);            // mono
  assert.equal(b.getUint32(24, true), 16000);        // sample rate
  assert.equal(b.getUint16(34, true), 16);           // bits
  assert.equal(b.getUint32(40, true), 8);            // 4 samples × 2 bytes
  assert.equal(b.getUint32(4, true), 36 + 8);
  assert.equal(b.getInt16(46, true), 32767);         // 1 → max
  assert.equal(b.getInt16(48, true), -32768);        // -1 → min
  assert.equal(wav.type, "audio/wav");
});

test("silence is detected, quiet speech is not", () => {
  assert.equal(isSilent(new Float32Array(16000)), true);
  const speech = new Float32Array(16000).map((_, i) => 0.05 * Math.sin(i / 5));
  assert.equal(isSilent(speech), false);
});

test("limit is 90 minutes", () => {
  assert.equal(MAX_SECONDS, 90 * 60);
});
