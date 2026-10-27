import { createClient } from "@/lib/supabase/server";

export type BoardRow = { id: string; slug: string; name: string; group_id: string | null; project_id?: string | null; owner_id?: string | null; trello_sync_enabled: boolean; trello_board_id: string | null };
export type ListRow = { id: string; board_id: string; name: string; position: number };
export type CardRow = {
  id: string; board_id: string; list_id: string; title: string; description: string | null;
  due_at: string | null; completed_at: string | null; position: number; labels: string[];
  created_by: string | null; created_at: string; trello_card_id?: string | null;
};
export type BoardCard = CardRow & { assignees: string[]; checklist: { done: number; total: number }; comments: number };
export type Member = { id: string; full_name: string; avatar_url: string | null; group_id: string | null; role_title: string | null };

export type BoardData = { board: BoardRow; lists: ListRow[]; cards: BoardCard[]; members: Member[] };

type RawCard = CardRow & {
  card_assignees: { user_id: string }[];
  card_checklist_items: { done: boolean }[];
  card_comments: { count: number }[];
};

export function shapeCard(c: RawCard): BoardCard {
  const { card_assignees, card_checklist_items, card_comments, ...rest } = c;
  return {
    ...rest,
    labels: rest.labels ?? [],
    assignees: card_assignees.map((a) => a.user_id),
    checklist: { done: card_checklist_items.filter((i) => i.done).length, total: card_checklist_items.length },
    comments: card_comments[0]?.count ?? 0,
  };
}

export const CARD_SELECT = "*, card_assignees(user_id), card_checklist_items(done), card_comments(count)";

export async function loadMembers(): Promise<Member[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name, avatar_url, group_id, role_title")
    .eq("active", true).order("full_name").returns<Member[]>();
  return data ?? [];
}

/** Everything one board needs. Returns null if the board doesn't exist. */
export async function loadBoard(slug: string): Promise<BoardData | null> {
  const supabase = await createClient();
  const { data: board } = await supabase.from("boards").select("*").eq("slug", slug).maybeSingle<BoardRow>();
  if (!board) return null;
  const [lists, cards, members] = await Promise.all([
    supabase.from("board_lists").select("*").eq("board_id", board.id).order("position").returns<ListRow[]>(),
    supabase.from("cards").select(CARD_SELECT).eq("board_id", board.id).order("position").returns<RawCard[]>(),
    loadMembers(),
  ]);
  return { board, lists: lists.data ?? [], cards: (cards.data ?? []).map(shapeCard), members };
}

/** A project's task board; assignees limited to the project's people. */
export async function loadBoardById(id: string, memberIds?: string[]): Promise<BoardData | null> {
  const supabase = await createClient();
  const { data: board } = await supabase.from("boards").select("*").eq("id", id).maybeSingle<BoardRow>();
  if (!board) return null;
  const [lists, cards, members] = await Promise.all([
    supabase.from("board_lists").select("*").eq("board_id", board.id).order("position").returns<ListRow[]>(),
    supabase.from("cards").select(CARD_SELECT).eq("board_id", board.id).order("position").returns<RawCard[]>(),
    loadMembers(),
  ]);
  return { board, lists: lists.data ?? [], cards: (cards.data ?? []).map(shapeCard),
           members: memberIds ? members.filter((m) => memberIds.includes(m.id)) : members };
}

export const BOARD_TABLES = ["cards", "board_lists", "card_assignees", "card_checklist_items", "card_comments", "boards"];
