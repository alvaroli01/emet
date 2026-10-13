import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { trelloConfigured, parseBoardId, registerWebhook, pullBoard } from "@/lib/trello";

/** Admin turns Trello sync on/off for a board and links it to a Trello board. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { boardId, enabled, trelloBoard } = await request.json();

  if (!enabled) {
    const { error } = await supabase.from("boards").update({ trello_sync_enabled: false }).eq("id", boardId);
    return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true });
  }
  if (!trelloConfigured()) return NextResponse.json({ error: "not-configured" }, { status: 400 });
  if (!trelloBoard) return NextResponse.json({ error: "missing board" }, { status: 400 });

  try {
    // Store Trello's full board id (webhooks report the full id, links contain the short one)
    const short = parseBoardId(String(trelloBoard));
    const res = await fetch(`https://api.trello.com/1/boards/${short}?fields=id&key=${process.env.TRELLO_KEY}&token=${process.env.TRELLO_TOKEN}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Trello board not found");
    const { id } = await res.json();
    const { error } = await supabase.from("boards").update({ trello_sync_enabled: true, trello_board_id: id }).eq("id", boardId);
    if (error) throw new Error(error.message);
    await registerWebhook(id, `${request.nextUrl.origin}/api/trello/webhook`);
    const count = await pullBoard(boardId);
    return NextResponse.json({ ok: true, count });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
