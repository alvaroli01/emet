/**
 * Uploaded audio files → small pieces the transcriber can take one at a time.
 * The browser decodes the file at 16 kHz mono; each 2-minute piece becomes a 16-bit WAV of ~3.7 MB,
 * under Vercel's 4.5 MB request limit (free plan). Pure helpers, shared with the tests.
 */
export const SAMPLE_RATE = 16000;
export const PIECE_SECONDS = 120;
export const MAX_SECONDS = 90 * 60;
const MIN_TAIL_SECONDS = 10; // a shorter last bit joins the previous piece

export function planPieces(totalSamples: number): { start: number; end: number }[] {
  const size = SAMPLE_RATE * PIECE_SECONDS, out: { start: number; end: number }[] = [];
  for (let start = 0; start < totalSamples; start += size) out.push({ start, end: Math.min(totalSamples, start + size) });
  if (out.length > 1 && out[out.length - 1].end - out[out.length - 1].start < SAMPLE_RATE * MIN_TAIL_SECONDS) {
    const tail = out.pop()!;
    out[out.length - 1].end = tail.end;
  }
  return out;
}

export function toWav(samples: Float32Array): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2), v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, SAMPLE_RATE, true); v.setUint32(28, SAMPLE_RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const x = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, x < 0 ? x * 32768 : x * 32767, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}

/** True when a piece has nothing worth sending (a break, a pause) — saves free minutes. */
export function isSilent(samples: Float32Array): boolean {
  let peak = 0;
  for (let i = 0; i < samples.length; i += 8) peak = Math.max(peak, Math.abs(samples[i]));
  return peak < 0.01;
}

/** Browser only: decode any audio file the browser understands into 16 kHz mono samples. */
export async function decodeFile(file: File): Promise<Float32Array> {
  const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
  try {
    const audio = await ctx.decodeAudioData(await file.arrayBuffer());
    if (audio.numberOfChannels === 1) return audio.getChannelData(0);
    const out = new Float32Array(audio.length);
    for (let c = 0; c < audio.numberOfChannels; c++) {
      const ch = audio.getChannelData(c);
      for (let i = 0; i < out.length; i++) out[i] += ch[i] / audio.numberOfChannels;
    }
    return out;
  } finally {
    ctx.close().catch(() => {});
  }
}
