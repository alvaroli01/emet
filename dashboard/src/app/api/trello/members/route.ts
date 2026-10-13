import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { boardMembers, trelloConfigured } from "@/lib/trello";

/** Members of the linked Trello board, for the admin's mapping screen. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!trelloConfigured()) return NextResponse.json({ error: "not-configured" }, { status: 400 });
  const trelloBoardId = request.nextUrl.searchParams.get("trelloBoardId");
  if (!trelloBoardId) return NextResponse.json({ members: [] });
  try {
    return NextResponse.json({ members: await boardMembers(trelloBoardId) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
