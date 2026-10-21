import { KeyRing, canUse, waitSeconds } from "./pool.ts";

/**
 * One AI call on the free plans. With a plain key: that member's own Groq account (Ask, Idea Lab, notes).
 * With a KeyRing (Scout): each key in turn — own first, then keys members lend — and per key each model, skipping
 * keys that are out today; then the free Mistral backup (`mistral/<id>` models, only without web search).
 */
const GROQ = "https://api.groq.com/openai/v1/chat/completions";
const MISTRAL = "https://api.mistral.ai/v1/chat/completions";
export type Fail = { error: "limit" | "bad-key" | "failed"; retryAfter?: number };
type Ok = { ok: true; message: Record<string, unknown> };
type Reply = { choices?: { message?: Record<string, unknown> }[]; usage?: { total_tokens?: number } };
const retryAfter = (res: Response) => Math.ceil(Number(res.headers.get("retry-after")) || 60);

export async function call(key: string | KeyRing, body: Record<string, unknown>, models = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]): Promise<Ok | Fail> {
  const ring = typeof key === "string" ? new KeyRing([{ owner: "me", key, own: true }]) : key;
  // Qwen has its own free daily allowance but no web search and other reasoning settings
  const groq = models.filter((m) => !m.startsWith("mistral/") && !(m.startsWith("qwen/") && body.tools));
  const { reasoning_effort, ...rest } = body;
  for (const k of ring.keys) {
    for (const model of groq) {
      if (!canUse(k, model, ring.usage)) continue;
      const payload = model.startsWith("qwen/") ? { model, ...rest, reasoning_format: "hidden" } : { model, ...rest, ...(reasoning_effort ? { reasoning_effort } : {}) };
      const res = await fetch(GROQ, { method: "POST", headers: { Authorization: `Bearer ${k.key}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) {
        const data = (await res.json()) as Reply;
        await ring.used(k, model, data.usage?.total_tokens ?? 0);
        return { ok: true, message: data.choices?.[0]?.message ?? {} };
      }
      if (res.status === 401 || res.status === 403) { await ring.bad(k); break; }
      // This key's free allowance for this model is used up: remember it and try the next model, then the next key
      if (res.status === 429 || res.status === 413) { await ring.limited(k, model, retryAfter(res)); continue; }
      // 400/404 (model gone or not allowed) and server errors: try the next model or key
    }
  }
  // Last resort: the team's free Mistral key (no web search there)
  let mistralWait = Infinity, triedMistral = false;
  const backup = process.env.MISTRAL_API_KEY;
  if (backup && !body.tools) {
    for (const m of models.filter((x) => x.startsWith("mistral/"))) {
      triedMistral = true;
      const res = await fetch(MISTRAL, { method: "POST", headers: { Authorization: `Bearer ${backup}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...rest, model: m.slice("mistral/".length) }) });
      if (res.ok) {
        const data = (await res.json()) as Reply;
        ring.tokens += data.usage?.total_tokens ?? 0;
        return { ok: true, message: data.choices?.[0]?.message ?? {} };
      }
      if (res.status === 429) mistralWait = Math.min(mistralWait, retryAfter(res));
    }
  }
  const allBad = ring.allBad();
  if (allBad && !triedMistral) return { error: "bad-key" };
  // Only a real limit means "wait"; anything else (server errors, unknown model) is a failure
  const wait = Math.min((allBad ? null : waitSeconds(ring.keys, groq, ring.usage)) ?? Infinity, mistralWait);
  return Number.isFinite(wait) ? { error: "limit", retryAfter: wait } : { error: "failed" };
}
