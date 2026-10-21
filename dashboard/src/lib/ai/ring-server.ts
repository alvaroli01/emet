import "server-only";
import { createClient } from "@supabase/supabase-js";
import { decryptKey } from "./keys";
import { KeyRing, type PoolKey, type UsageRow } from "./pool";

/**
 * Scout's keys for this request: my own key first, then the keys other active members lend to Scout, plus today's
 * usage. Server only (service role) — lent keys never reach the browser. Call it only after can_scout().
 * Without the service key (local dev) it falls back to my own key.
 */
export async function scoutRing(meId: string, ownRow: { key_iv: string; key_data: string } | null): Promise<KeyRing | null> {
  const keys: PoolKey[] = ownRow ? [{ owner: meId, key: decryptKey(ownRow), own: true }] : [];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return keys.length ? new KeyRing(keys) : null;
  const sb = createClient(url, service, { auth: { persistSession: false } });
  const day = new Date().toISOString().slice(0, 10);
  const [{ data: lent }, { data: active }, { data: usage }] = await Promise.all([
    sb.from("ai_keys").select("owner_id, key_iv, key_data").eq("lend_scout", true).neq("owner_id", meId),
    sb.from("profiles").select("id").eq("active", true),
    sb.from("ai_key_usage").select("owner_id, model, tokens, limited_until, bad").eq("day", day),
  ]);
  const ok = new Set((active ?? []).map((p) => p.id as string));
  for (const r of lent ?? []) {
    if (!ok.has(r.owner_id)) continue; // deactivated members' keys are never used
    try { keys.push({ owner: r.owner_id, key: decryptKey(r), own: false }); } catch { /* unreadable key: skip */ }
  }
  if (!keys.length) return null;
  return new KeyRing(keys, (usage ?? []) as UsageRow[], async (e) => {
    await sb.rpc("ai_usage_event", { p_owner: e.owner, p_model: e.model, p_tokens: e.tokens ?? 0, p_until: e.until ?? null, p_bad: e.bad ?? false });
  });
}
