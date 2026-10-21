import "server-only";
import { createClient } from "@supabase/supabase-js";
import { decryptKey } from "./keys";
import { KeyRing, type PoolKey, type UsageRow } from "./pool";

function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

/**
 * Count a member's own AI use (Ask, Idea Lab, notes…) so Scout's 60% cap on a lent key also leaves room for what
 * its owner already used today. Never throws.
 */
export async function recordUse(owner: string, model: string, tokens: number | undefined) {
  const sb = service();
  if (!sb || !tokens) return;
  try { await sb.rpc("ai_usage_event", { p_owner: owner, p_model: model, p_tokens: tokens, p_until: null, p_bad: false }); } catch { /* counting must never break a feature */ }
}

/** My own key as a ring that counts my use (for call() in Ask-like features). */
export function ownRing(meId: string, row: { key_iv: string; key_data: string }): KeyRing {
  return new KeyRing([{ owner: meId, key: decryptKey(row), own: true }], [], (e) => (e.tokens ? recordUse(e.owner, e.model, e.tokens) : undefined));
}

/**
 * Scout's keys for this request: my own key first, then the keys other active members lend to Scout, plus today's
 * usage. Server only (service role) — lent keys never reach the browser. Call it only after can_scout().
 * Without the service key (local dev) it falls back to my own key.
 */
export async function scoutRing(meId: string, ownRow: { key_iv: string; key_data: string } | null): Promise<KeyRing | null> {
  const keys: PoolKey[] = ownRow ? [{ owner: meId, key: decryptKey(ownRow), own: true }] : [];
  const sb = service();
  if (!sb) return keys.length ? new KeyRing(keys) : null;
  const day = new Date().toISOString().slice(0, 10);
  const [{ data: lent }, { data: active }, { data: usage }, { data: backups }] = await Promise.all([
    sb.from("ai_keys").select("owner_id, key_iv, key_data").eq("lend_scout", true).neq("owner_id", meId),
    sb.from("profiles").select("id").eq("active", true),
    sb.from("ai_key_usage").select("owner_id, model, tokens, limited_until, bad").eq("day", day),
    sb.from("backup_keys").select("owner_id, key_iv, key_data"),
  ]);
  const ok = new Set((active ?? []).map((p) => p.id as string));
  const lenders = new Set<string>();
  for (const r of lent ?? []) {
    if (!ok.has(r.owner_id)) continue; // deactivated members' keys are never used
    try { keys.push({ owner: r.owner_id, key: decryptKey(r), own: false }); lenders.add(r.owner_id); } catch { /* unreadable key: skip */ }
  }
  if (!keys.length) return null;
  const ring = new KeyRing(keys, (usage ?? []) as UsageRow[], async (e) => {
    await sb.rpc("ai_usage_event", { p_owner: e.owner, p_model: e.model, p_tokens: e.tokens ?? 0, p_until: e.until ?? null, p_bad: e.bad ?? false });
  });
  // Mistral backup keys: mine first, then those of people who lend their key to Scout
  const mine = (backups ?? []).filter((b) => b.owner_id === meId), theirs = (backups ?? []).filter((b) => lenders.has(b.owner_id));
  for (const b of [...mine, ...theirs]) { try { ring.mistral.push(decryptKey(b)); } catch { /* unreadable key: skip */ } }
  return ring;
}
