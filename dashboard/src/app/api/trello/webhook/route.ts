import { NextResponse, type NextRequest } from "next/server";
import { adminDb, pullBoard, validWebhook } from "@/lib/trello";

// Trello checks the URL with a HEAD request when the webhook is created
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

/** Something changed on a linked Trello board → resync that board (realtime then updates everyone). */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const callbackURL = `${request.nextUrl.origin}/api/trello/webhook`;
  if (!validWebhook(body, callbackURL, request.headers.get("x-trello-webhook"))) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }
  const modelId = JSON.parse(body)?.model?.id as string | undefined;
  if (!modelId) return NextResponse.json({ ok: true });
  const { data: boards } = await adminDb().from("boards").select("id").eq("trello_board_id", modelId).eq("trello_sync_enabled", true);
  for (const b of boards ?? []) await pullBoard(b.id).catch(() => {});
  return NextResponse.json({ ok: true });
}
