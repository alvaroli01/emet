import "server-only";
import { createHmac } from "node:crypto";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";

// Trello REST API (free). Keys live only in server environment variables:
//   TRELLO_KEY, TRELLO_TOKEN  — from https://trello.com/power-ups/admin (see TRELLO_SETUP.md)
//   TRELLO_SECRET             — used to check that webhook calls really come from Trello
const API = "https://api.trello.com/1";

export const trelloConfigured = () => !!(process.env.TRELLO_KEY && process.env.TRELLO_TOKEN);

async function trello<T>(path: string, init: RequestInit & { query?: Record<string, string> } = {}): Promise<T> {
  const url = new URL(API + path);
  url.searchParams.set("key", process.env.TRELLO_KEY!);
  url.searchParams.set("token", process.env.TRELLO_TOKEN!);
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);
  const res = await fetch(url, { ...init, cache: "no-store" });
  if (!res.ok) throw new Error(`Trello ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.status === 204 ? (undefined as T) : res.json();
}

type TList = { id: string; name: string; pos: number; closed: boolean };
type TCard = { id: string; name: string; desc: string; due: string | null; idList: string; pos: number; closed: boolean; idMembers: string[]; labels: { name: string; color: string }[] };

/** Accepts a board id or a full trello.com/b/<id>/... link */
export function parseBoardId(input: string) {
  const m = input.match(/trello\.com\/b\/([A-Za-z0-9]+)/);
  return (m ? m[1] : input).trim();
}

export function adminDb(): SupabaseClient {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

/** Trello → dashboard: make the dashboard board match the Trello board. Returns number of cards synced. */
export async function pullBoard(boardId: string): Promise<number> {
  const db = adminDb();
  const { data: board } = await db.from("boards").select("*").eq("id", boardId).single();
  if (!board?.trello_board_id) throw new Error("No Trello board linked");
  const tid = board.trello_board_id as string;

  const [lists, cards, map] = await Promise.all([
    trello<TList[]>(`/boards/${tid}/lists`, { query: { filter: "open" } }),
    trello<TCard[]>(`/boards/${tid}/cards`, { query: { filter: "open" } }),
    db.from("trello_member_map").select("*"),
  ]);
  const memberToProfile = new Map((map.data ?? []).map((m) => [m.trello_member_id, m.profile_id as string]));

  // Lists: match by Trello id, then by name (so the default To do / Doing / Review / Done get linked)
  const { data: ours } = await db.from("board_lists").select("*").eq("board_id", boardId);
  const listMap = new Map<string, string>();
  for (const l of lists) {
    const match = ours?.find((o) => o.trello_list_id === l.id) ?? ours?.find((o) => !o.trello_list_id && o.name.toLowerCase() === l.name.toLowerCase());
    if (match) {
      await db.from("board_lists").update({ name: l.name, position: l.pos, trello_list_id: l.id }).eq("id", match.id);
      listMap.set(l.id, match.id);
    } else {
      const { data } = await db.from("board_lists").insert({ board_id: boardId, name: l.name, position: l.pos, trello_list_id: l.id }).select("id").single();
      if (data) listMap.set(l.id, data.id);
    }
  }

  // Cards
  for (const c of cards) {
    const list_id = listMap.get(c.idList);
    if (!list_id) continue;
    const row = {
      board_id: boardId, list_id, title: c.name, description: c.desc || null, due_at: c.due, position: c.pos,
      labels: c.labels.map((l) => l.name || l.color).filter(Boolean), trello_card_id: c.id,
    };
    const { data: saved } = await db.from("cards").upsert(row, { onConflict: "trello_card_id" }).select("id").single();
    if (!saved) continue;
    const assignees = c.idMembers.map((m) => memberToProfile.get(m)).filter(Boolean) as string[];
    await db.from("card_assignees").delete().eq("card_id", saved.id);
    if (assignees.length) await db.from("card_assignees").insert(assignees.map((user_id) => ({ card_id: saved.id, user_id })));
  }

  // Cards removed/archived in Trello → remove here
  const live = new Set(cards.map((c) => c.id));
  const { data: linked } = await db.from("cards").select("id, trello_card_id").eq("board_id", boardId).not("trello_card_id", "is", null);
  const gone = (linked ?? []).filter((c) => !live.has(c.trello_card_id)).map((c) => c.id);
  if (gone.length) await db.from("cards").delete().in("id", gone);

  // Cards made here while Trello was unreachable → push them now
  const { data: unlinked } = await db.from("cards").select("id").eq("board_id", boardId).is("trello_card_id", null);
  for (const c of unlinked ?? []) await pushCard(c.id).catch(() => {});

  return cards.length;
}

/** Dashboard → Trello for one card (create or update). */
export async function pushCard(cardId: string) {
  const db = adminDb();
  const { data: card } = await db.from("cards")
    .select("*, boards(trello_sync_enabled, trello_board_id), board_lists(trello_list_id), card_assignees(user_id)")
    .eq("id", cardId).single();
  if (!card?.boards?.trello_sync_enabled || !card.board_lists?.trello_list_id) return;

  const { data: map } = await db.from("trello_member_map").select("*");
  const idMembers = (card.card_assignees as { user_id: string }[])
    .map((a) => map?.find((m) => m.profile_id === a.user_id)?.trello_member_id).filter(Boolean).join(",");
  const query: Record<string, string> = {
    name: card.title, desc: card.description ?? "", idList: card.board_lists.trello_list_id,
    due: card.due_at ?? "", idMembers, pos: String(Math.max(1, card.position)),
  };

  if (card.trello_card_id) {
    await trello(`/cards/${card.trello_card_id}`, { method: "PUT", query });
  } else {
    const created = await trello<{ id: string }>("/cards", { method: "POST", query });
    await db.from("cards").update({ trello_card_id: created.id }).eq("id", cardId);
  }
}

export async function deleteTrelloCard(trelloCardId: string) {
  await trello(`/cards/${trelloCardId}`, { method: "DELETE" });
}

/** Ask Trello to call us whenever the board changes. */
export async function registerWebhook(trelloBoardId: string, callbackURL: string) {
  const board = await trello<{ id: string }>(`/boards/${trelloBoardId}`, { query: { fields: "id" } });
  const existing = await trello<{ id: string; idModel: string; callbackURL: string }[]>(`/tokens/${process.env.TRELLO_TOKEN}/webhooks`);
  if (existing.some((w) => w.idModel === board.id && w.callbackURL === callbackURL)) return;
  await trello("/webhooks", { method: "POST", query: { idModel: board.id, callbackURL, description: "emet HQ" } });
}

export async function boardMembers(trelloBoardId: string) {
  return trello<{ id: string; username: string; fullName: string }[]>(`/boards/${trelloBoardId}/members`);
}

/** Trello signs webhook calls: base64(HMAC-SHA1(body + callbackURL, secret)) */
export function validWebhook(body: string, callbackURL: string, signature: string | null) {
  const secret = process.env.TRELLO_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha1", secret).update(body + callbackURL).digest("base64");
  return expected === signature;
}
