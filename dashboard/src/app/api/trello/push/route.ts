import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminDb, deleteTrelloCard, pushCard, trelloConfigured } from "@/lib/trello";

/** The dashboard changed a card on a synced board → send it to Trello. */
export async function POST(request: NextRequest) {
  if (!trelloConfigured()) return NextResponse.json({ ok: true, skipped: true });
  const supabase = await createClient();
  const { data: member } = await supabase.rpc("is_member");
  if (!member) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { cardId, trelloCardId, op } = await request.json();

  try {
    if (op === "delete") {
      // Only for cards that are really gone from the dashboard
      const { count } = await adminDb().from("cards").select("id", { count: "exact", head: true }).eq("trello_card_id", trelloCardId);
      if (!trelloCardId || count) return NextResponse.json({ error: "not deleted" }, { status: 400 });
      await deleteTrelloCard(trelloCardId);
    } else {
      const { data: canEdit } = await supabase.rpc("can_edit_card", { p_card_id: cardId });
      if (!canEdit) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      await pushCard(cardId);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
