import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptKey, encryptKey } from "@/lib/ai/keys";
import { API, notion, NotionError, type Session, type Tokens } from "./client";
import { toDeadlines, type DeadlineMap, type NotionDeadline } from "./deadlines";

/**
 * The member's own Notion connections (RLS: only their rows), decrypted on the server only. Each comes with a ready
 * Session that renews its token and saves the new pair; a connection whose renewal fails is marked "reconnect".
 */
export type Conn = {
  id: string; workspace_id: string; workspace_name: string | null; workspace_icon: string | null; needs_reconnect: boolean;
  deadlines_ds: string | null; deadlines_map: DeadlineMap | null; save_parent: string | null; session: Session;
};
type TokenResponse = { access_token: string; refresh_token?: string; workspace_id: string; workspace_name?: string; workspace_icon?: string; bot_id?: string };

export const oauthConfigured = () => !!(process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET);
export const redirectUri = (origin: string) => `${origin}/api/notion/callback`;

async function tokenCall(body: Record<string, string>): Promise<TokenResponse> {
  const basic = Buffer.from(`${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${API}/oauth/token`, { method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new NotionError(res.status, "Notion sign-in failed");
  return res.json();
}
export const exchangeCode = (code: string, redirect: string) => tokenCall({ grant_type: "authorization_code", code, redirect_uri: redirect });
const refreshTokens = async (refresh: string): Promise<Tokens> => {
  const t = await tokenCall({ grant_type: "refresh_token", refresh_token: refresh });
  return { access: t.access_token, refresh: t.refresh_token ?? refresh };
};
export const sealTokens = (t: Tokens) => { const e = encryptKey(JSON.stringify(t)); return { token_iv: e.key_iv, token_data: e.key_data }; };

export async function myConnections(sb: SupabaseClient, all = false): Promise<Conn[]> {
  const { data } = await sb.from("notion_connections")
    .select("id, workspace_id, workspace_name, workspace_icon, needs_reconnect, deadlines_ds, deadlines_map, save_parent, token_iv, token_data")
    .order("created_at");
  const out: Conn[] = [];
  for (const r of data ?? []) {
    if (r.needs_reconnect && !all) continue;
    let tokens: Tokens;
    try { tokens = JSON.parse(decryptKey({ key_iv: r.token_iv, key_data: r.token_data })) as Tokens; } catch { continue; }
    const id = r.id as string;
    out.push({
      id, workspace_id: r.workspace_id, workspace_name: r.workspace_name, workspace_icon: r.workspace_icon, needs_reconnect: r.needs_reconnect,
      deadlines_ds: r.deadlines_ds, deadlines_map: r.deadlines_map as DeadlineMap | null, save_parent: r.save_parent,
      session: {
        tokens,
        refresh: async (rt) => {
          try { return await refreshTokens(rt); }
          catch (e) { await sb.from("notion_connections").update({ needs_reconnect: true }).eq("id", id); throw e; }
        },
        onTokens: (t) => sb.from("notion_connections").update({ ...sealTokens(t), needs_reconnect: false }).eq("id", id),
      },
    });
  }
  return out;
}

/** Run one call on a connection; a final 401 marks it "reconnect" instead of breaking the page. */
export async function call<T = any>(sb: SupabaseClient, c: Conn, path: string, init?: { method?: string; body?: unknown }): Promise<T> { // eslint-disable-line @typescript-eslint/no-explicit-any
  try { return await notion(c.session, path, init); }
  catch (e) {
    if (e instanceof NotionError && e.status === 401) await sb.from("notion_connections").update({ needs_reconnect: true }).eq("id", c.id);
    throw e;
  }
}

/** All rows of a data source query (paginated, capped). */
export async function queryAll(sb: SupabaseClient, c: Conn, dataSourceId: string, body: Record<string, unknown>, cap = 200): Promise<unknown[]> {
  const rows: unknown[] = [];
  let cursor: string | undefined;
  do {
    const r = await call<{ results: unknown[]; has_more: boolean; next_cursor: string | null }>(sb, c, `/data_sources/${dataSourceId}/query`,
      { method: "POST", body: { ...body, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) } });
    rows.push(...r.results);
    cursor = r.has_more && r.next_cursor ? r.next_cursor : undefined;
  } while (cursor && rows.length < cap);
  return rows;
}

// Short in-memory cache (per server instance) so the week doesn't hit Notion on every page view
const cache = new Map<string, { at: number; value: unknown }>();
export async function cached<T>(key: string, ms: number, make: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ms) return hit.value as T;
  const value = await make();
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  return value;
}

/** Notion deadlines for the week / My Tasks / Ask emet, from every connection that picked a deadlines database. */
export async function loadMyNotionDeadlines(sb: SupabaseClient, from: string, to: string): Promise<{ status: "not_connected" | "connected" | "unreachable"; items: NotionDeadline[] }> {
  const conns = (await myConnections(sb)).filter((c) => c.deadlines_ds && c.deadlines_map);
  if (!conns.length) return { status: "not_connected", items: [] };
  let failed = 0;
  const lists = await Promise.all(conns.map((c) => cached(`dl:${c.id}:${from}:${to}`, 5 * 60_000, async () => {
    const map = c.deadlines_map!;
    const rows = await queryAll(sb, c, c.deadlines_ds!, { filter: { and: [
      { property: map.date, date: { on_or_after: from } }, { property: map.date, date: { on_or_before: to } },
    ] } });
    return toDeadlines(rows, map);
  }).catch(() => { failed++; return [] as NotionDeadline[]; })));
  return { status: failed === conns.length ? "unreachable" : "connected", items: lists.flat() };
}

/** Ask emet: short excerpts from my Notion pages that match the question (top 5 pages, ~1,500 characters each, ≤ 8K total). */
export async function notionContext(sb: SupabaseClient, question: string): Promise<{ page: string; url: string; text: string }[]> {
  const conns = await myConnections(sb);
  if (!conns.length) return [];
  const words = question.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 3).slice(0, 6).join(" ");
  const hits = (await Promise.all(conns.map(async (c) => {
    try {
      const r = await call<{ results: { id: string; url: string; object: string; properties?: unknown }[] }>(sb, c, "/search",
        { method: "POST", body: { query: words, filter: { property: "object", value: "page" }, page_size: 5 } });
      return r.results.map((p) => ({ c, p }));
    } catch { return []; }
  }))).flat().slice(0, 5);
  const { titleOf } = await import("./props");
  const out: { page: string; url: string; text: string }[] = [];
  let total = 0;
  for (const { c, p } of hits) {
    try {
      const kids = await call<{ results: { type: string; [k: string]: unknown }[] }>(sb, c, `/blocks/${p.id}/children?page_size=60`);
      const text = kids.results.map((b) => ((b[b.type] as { rich_text?: { plain_text?: string }[] })?.rich_text ?? []).map((r) => r.plain_text ?? "").join("")).filter(Boolean).join("\n").slice(0, 1500);
      if (!text) continue;
      total += text.length;
      out.push({ page: titleOf(p), url: p.url, text });
      if (total > 8000) break;
    } catch { /* skip this page */ }
  }
  return out;
}
