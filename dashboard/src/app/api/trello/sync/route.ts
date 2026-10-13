import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminDb, pullBoard, trelloConfigured } from "@/lib/trello";

/** "Resync now" button (admins). */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!trelloConfigured()) return NextResponse.json({ error: "not-configured" }, { status: 400 });
  const { boardId } = await request.json();
  try {
    return NextResponse.json({ ok: true, count: await pullBoard(boardId) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

/** Nightly backup sync (Vercel Cron, free on Hobby). Vercel sends "Authorization: Bearer $CRON_SECRET". */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!trelloConfigured()) return NextResponse.json({ ok: true, skipped: "not-configured" });
  const { data: boards } = await adminDb().from("boards").select("id").eq("trello_sync_enabled", true);
  const results: Record<string, number | string> = {};
  for (const b of boards ?? []) {
    try { results[b.id] = await pullBoard(b.id); } catch (e) { results[b.id] = (e as Error).message; }
  }
  return NextResponse.json({ ok: true, results });
}
