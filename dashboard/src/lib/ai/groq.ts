/** Groq (free tier) calls for the note-taker. Each member's own key is used, so each has their own allowance. */
const API = "https://api.groq.com/openai/v1";
export const STT_MODEL = "whisper-large-v3";
export const NOTES_MODEL = "llama-3.3-70b-versatile";

export type GroqError = { kind: "limit"; retryAfter: number } | { kind: "bad-key" } | { kind: "failed"; status: number };

async function fail(res: Response): Promise<GroqError> {
  if (res.status === 401 || res.status === 403) return { kind: "bad-key" };
  if (res.status === 429) return { kind: "limit", retryAfter: Math.ceil(Number(res.headers.get("retry-after")) || 60) };
  return { kind: "failed", status: res.status };
}

export async function checkKey(key: string): Promise<boolean> {
  const res = await fetch(`${API}/models`, { headers: { Authorization: `Bearer ${key}` } });
  return res.ok;
}

/** One audio chunk → text. `language` = "es" | "en" or omitted to auto-detect (handles mixed classes). */
export async function transcribe(key: string, audio: Blob, name: string, language?: string, prompt?: string)
  : Promise<{ text: string } | GroqError> {
  const form = new FormData();
  form.append("file", audio, name);
  form.append("model", STT_MODEL);
  form.append("response_format", "json");
  form.append("temperature", "0");
  if (language) form.append("language", language);
  // The end of the previous chunk keeps names and wording consistent across chunk boundaries
  if (prompt) form.append("prompt", prompt.slice(-400));
  const res = await fetch(`${API}/audio/transcriptions`, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
  if (!res.ok) return fail(res);
  const data = (await res.json()) as { text?: string };
  return { text: (data.text ?? "").trim() };
}

/** Splits a long transcript at sentence ends so each part fits the free tier's per-minute token budget. */
export function splitTranscript(text: string, maxChars = 14000): string[] {
  const parts: string[] = [];
  let rest = text.trim();
  while (rest.length > maxChars) {
    const window = rest.slice(0, maxChars);
    const cut = Math.max(window.lastIndexOf(". "), window.lastIndexOf("? "), window.lastIndexOf("! "), window.lastIndexOf("\n"));
    const at = cut > maxChars * 0.5 ? cut + 1 : maxChars;
    parts.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

const SYSTEM = `You turn a class or meeting transcript into clear notes for a university student team.
Write in the same language as the transcript (Spanish or English; if mixed, use the main one).
Use Markdown with exactly these sections, skipping any that would be empty:
## Summary — 2-4 sentences.
## Key points — bullet list of the important ideas, facts, numbers and definitions.
## Decisions — bullet list.
## Action items — "- [ ] who: what (when)" when known.
## Questions to follow up — bullet list.
Be faithful to the transcript: never invent facts, names, numbers or dates.`;

export async function makeNotes(key: string, transcript: string): Promise<{ markdown: string } | GroqError> {
  const ask = async (content: string) => {
    const res = await fetch(`${API}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: NOTES_MODEL, temperature: 0.2, messages: [{ role: "system", content: SYSTEM }, { role: "user", content }] }),
    });
    if (!res.ok) return fail(res);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return { markdown: (data.choices?.[0]?.message?.content ?? "").trim() };
  };
  const parts = splitTranscript(transcript);
  if (parts.length === 1) return ask(`Transcript:\n\n${parts[0]}`);
  // Long sessions: notes per part, then one merged set of notes
  const partial: string[] = [];
  for (const [i, p] of parts.entries()) {
    const r = await ask(`Part ${i + 1} of ${parts.length} of a longer transcript:\n\n${p}`);
    if (!("markdown" in r)) return r;
    partial.push(r.markdown);
  }
  return ask(`These are notes from consecutive parts of one session. Merge them into one set of notes, removing repetition:\n\n${partial.join("\n\n---\n\n")}`);
}
