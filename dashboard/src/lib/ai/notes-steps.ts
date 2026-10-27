/** Writing notes from a transcript, step by step (pure, tested). A long transcript becomes one request per part plus a
 *  merge, each its own short server call — so the free Groq per-minute limit and the 60 s server limit never sink the
 *  whole job. A limit waits and retries only that step; nothing already written is redone. */
import { splitTranscript, mainLanguage } from "./groq.ts";

export type NotesStep = { mode: "whole" | "part" | "merge"; lang: "es" | "en"; text?: string; notes?: string[]; index?: number; total?: number };
export type NotesReply = { markdown: string } | { error: string; retryAfter?: number };

/** Up to this many waits per step (≈ 10+ minutes of Groq limits) before giving up. */
const MAX_WAITS = 10;

export async function writeNotes(transcript: string, post: (step: NotesStep) => Promise<NotesReply>, wait: (ms: number) => Promise<void>): Promise<string | null> {
  const lang = mainLanguage(transcript);
  const run = async (step: NotesStep): Promise<string | null> => {
    for (let waits = 0; ; waits++) {
      const r = await post(step);
      if ("markdown" in r && r.markdown.trim()) return r.markdown;
      if (!("error" in r) || r.error !== "limit" || waits >= MAX_WAITS) return null;
      await wait((r.retryAfter ?? 60) * 1000);
    }
  };
  const parts = splitTranscript(transcript);
  if (parts.length === 1) return run({ mode: "whole", lang, text: parts[0] });
  const notes: string[] = [];
  for (const [i, text] of parts.entries()) {
    const md = await run({ mode: "part", lang, text, index: i + 1, total: parts.length });
    if (md === null) return null;
    notes.push(md);
  }
  return run({ mode: "merge", lang, notes });
}
