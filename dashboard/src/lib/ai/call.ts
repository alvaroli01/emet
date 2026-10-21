import { KeyRing, canUse, waitSeconds } from "./pool.ts";

/**
 * One AI call on the free plans. With a plain key: that member's own Groq account (Ask, Idea Lab, notes).
 * With a KeyRing (Scout): each key in turn — own first, then keys members lend — and per key each model, skipping
 * keys that are out today; then the Mistral backup keys (`mistral/<id>` models, only without web search).
 */
const GROQ = "https://api.groq.com/openai/v1/chat/completions";
const MISTRAL = "https://api.mistral.ai/v1/chat/completions";
const SHORT_WAIT = 10; // a Groq pause this short is waited out rather than switching to the backup model
export type Fail = { error: "limit" | "bad-key" | "failed"; retryAfter?: number };
type Ok = { ok: true; message: Record<string, unknown> };
type Reply = { choices?: { message?: Record<string, unknown> }[]; usage?: { total_tokens?: number } };
const retryAfter = (res: Response) => Math.ceil(Number(res.headers.get("retry-after")) || 60);

export async function call(key: string | KeyRing, body: Record<string, unknown>, models = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]): Promise<Ok | Fail> {
  const ring = typeof key === "string" ? new KeyRing([{ owner: "me", key, own: true }]) : key;
  // Qwen has its own free daily allowance but no web search and other reasoning settings
  const groq = models.filter((m) => !m.startsWith("mistral/") && !(m.startsWith("qwen/") && body.tools));
  const { reasoning_effort, ...rest } = body;
  const broken = new Set<string>(); // models that errored for reasons other than limits: don't retry them on every key
  for (const k of ring.keys) {
    for (const model of groq) {
      if (broken.has(model) || !canUse(k, model, ring.usage)) continue;
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
      broken.add(model); // 400/404 (model gone, request not accepted) or a server error
    }
  }
  const groqWait = waitSeconds(ring.keys, groq, ring.usage);
  // Last resort: Mistral backup keys (own, lent, then the team's), one after another — no web search there
  let mistralWait: number | null = null;
  const backups = [...new Set([...ring.mistral, process.env.MISTRAL_API_KEY ?? ""].filter(Boolean))];
  if (!body.tools && !(groqWait !== null && groqWait <= SHORT_WAIT)) {
    for (const m of models.filter((x) => x.startsWith("mistral/"))) {
      for (const bk of backups) {
        const res = await fetch(MISTRAL, { method: "POST", headers: { Authorization: `Bearer ${bk}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...rest, model: m.slice("mistral/".length) }) });
        if (res.ok) {
          const data = (await res.json()) as Reply;
          ring.tokens += data.usage?.total_tokens ?? 0;
          return { ok: true, message: data.choices?.[0]?.message ?? {} };
        }
        if (res.status === 429) mistralWait = Math.min(mistralWait ?? Infinity, retryAfter(res));
      }
    }
  }
  const wait = Math.min(groqWait ?? Infinity, mistralWait ?? Infinity);
  if (Number.isFinite(wait)) return { error: "limit", retryAfter: wait };
  // Nothing to wait for: my own key was rejected → reconnect it; otherwise a plain failure
  return ring.keys.some((k) => k.own && ring.isBad(k)) ? { error: "bad-key" } : { error: "failed" };
}
