/** Groq (free tier) calls for the note-taker. Each member's own key is used, so each has their own allowance. */
const API = "https://api.groq.com/openai/v1";
export const STT_MODEL = "whisper-large-v3";
/** Tried in order: Groq retires models over time, so the next one takes over instead of the notes breaking. */
export const NOTES_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"];

// What Whisper tends to "hear" in silence or noise; never worth keeping as a whole chunk
const PHANTOMS = /^(you|thank you\.?|thanks for watching!?|bye\.?|gracias\.?|¡?gracias por ver!?|subt[ií]tulos.*|amara\.org.*|\.+)$/i;
// Only dots, ellipses, commas etc. (". . . . ." with spaces too) — Whisper's way of saying it heard nothing it understood
const ONLY_PUNCT = /^[\s.…,;:!?¡¿\-–—'"]*$/;
export const isPhantom = (text: string) => ONLY_PUNCT.test(text) || PHANTOMS.test(text.trim());

/**
 * The hint sent with the next chunk (the end of the last one). A hint that is mostly dots makes Whisper answer the
 * next chunk with dots too — and the one after — so the transcript dies while the audio is fine. Junk hints are dropped.
 */
export function usablePrompt(prev?: string): string | undefined {
  const text = (prev ?? "").replace(/(\s*[.…]\s*){2,}/g, ". ").replace(/\s+/g, " ").trim().replace(/^\.\s*/, "");
  const words = text.match(/\p{L}{2,}/gu) ?? [];
  if (words.length < 3) return undefined;
  return text.slice(-300).replace(/^\S*\s/, (m) => (text.length > 300 ? "" : m)).trim();
}

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
  const hint = usablePrompt(prompt);
  if (hint) form.append("prompt", hint);
  const res = await fetch(`${API}/audio/transcriptions`, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
  if (!res.ok) return fail(res);
  const data = (await res.json()) as { text?: string };
  const text = (data.text ?? "").replace(/(\s*\.\s*){4,}/g, ". ").trim();
  // Nothing understood although a hint was given: the hint may have misled Whisper, so try once more without it
  if (isPhantom(text) && hint) return transcribe(key, audio, name, language, undefined);
  return { text: isPhantom(text) ? "" : text.replace(/([.!?])\s+(you|thank you\.?)$/i, "$1") };
}

/** Drops empty bullets and headings with nothing under them (the model sometimes leaves a lone "*"). */
export function cleanNotes(md: string): string {
  const lines = md.split("\n").filter((l) => !/^\s*([-*]|- \[ \]|\d+\.)\s*$/.test(l));
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,3}\s/.test(lines[i])) {
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      if (j >= lines.length || /^#{1,3}\s/.test(lines[j])) continue;
    }
    out.push(lines[i]);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
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

const HEADINGS = {
  es: ["Resumen", "Puntos clave", "Decisiones", "Tareas", "Preguntas pendientes"],
  en: ["Summary", "Key points", "Decisions", "Action items", "Open questions"],
};

/** Spanish or English, from the most common short words (good enough for picking headings). */
export function mainLanguage(text: string): "es" | "en" {
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  const es = words.filter((w) => ["de", "la", "que", "el", "en", "y", "los", "para", "con", "las", "por", "una", "es"].includes(w)).length;
  const en = words.filter((w) => ["the", "and", "to", "of", "a", "in", "is", "for", "that", "we", "on", "with", "this"].includes(w)).length;
  return es >= en ? "es" : "en";
}

function system(lang: "es" | "en") {
  const [summary, points, decisions, actions, questions] = HEADINGS[lang];
  return `You turn a class or meeting transcript into clear notes for a university student team.
Write in ${lang === "es" ? "Spanish" : "English"}. Use Markdown with exactly these headings, in this order, skipping any section that would be empty:
## ${summary} — what was talked about, start to finish: one short paragraph per main topic, in the order they came up.
## ${points} — bullets: every important idea, fact, number, name, date and definition. Be complete rather than short.
## ${decisions} — bullets: only decisions actually stated.
## ${actions} — "- [ ] who: what (when)" for tasks actually assigned or agreed.
## ${questions} — bullets: only questions that were actually asked and left open. Never write your own questions.
Be strictly faithful to the transcript: never invent facts, names, numbers, dates or questions. If a word looks mis-transcribed, keep it as heard.`;
}

/** One notes request (a whole short transcript, one part of a long one, or the merge). Each model has its own free
 *  allowance, so a model that is retired, unavailable or at its limit hands over to the next; only when all are limited
 *  does the caller wait (for the soonest). A bad key stops at once. */
export async function notesRequest(key: string, content: string, lang: "es" | "en", onUsage?: (model: string, tokens?: number) => unknown): Promise<{ markdown: string } | GroqError> {
  let last: GroqError = { kind: "failed", status: 404 };
  let soonest: number | null = null;
  for (const model of NOTES_MODELS) {
    const res = await fetch(`${API}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model, temperature: 0.2,
        ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
        messages: [{ role: "system", content: system(lang) }, { role: "user", content }],
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: { total_tokens?: number } };
      await onUsage?.(model, data.usage?.total_tokens);
      const markdown = cleanNotes(data.choices?.[0]?.message?.content ?? "");
      if (markdown.trim()) return { markdown };
      last = { kind: "failed", status: 204 }; continue; // empty answer → next model
    }
    const err = await fail(res);
    if (err.kind === "bad-key") return err;
    if (err.kind === "limit") { soonest = Math.min(soonest ?? err.retryAfter, err.retryAfter); continue; }
    last = err; // 404 retired, 400/413 too big for this model, 5xx → next model
  }
  return soonest !== null ? { kind: "limit", retryAfter: soonest } : last;
}

/** What each notes step sends to the model. */
export function notesPrompt(mode: "whole" | "part" | "merge", text: string, index = 1, total = 1): string {
  if (mode === "part") return `Part ${index} of ${total} of a longer transcript. Write notes for this part only:\n\n${text}`;
  if (mode === "merge") return `These are notes from consecutive parts of one session. Merge them into one complete set of notes: keep every key point, decision and action item, remove only repetition, and write the summary for the whole session:\n\n${text}`;
  return `Transcript:\n\n${text}`;
}
