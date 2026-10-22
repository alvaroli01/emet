import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { myConnections, revokeToken } from "@/lib/notion/server";

/** Remove one of my Notion connections (RLS: only my own rows) and revoke emet's token at Notion. */
export async function POST(request: NextRequest) {
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "bad-request" }, { status: 400 });
  const sb = await createClient();
  const conn = (await myConnections(sb, true)).find((c) => c.id === id);
  if (conn) await revokeToken(conn.session.tokens.access).catch(() => {}); // also cut emet's access on Notion's side
  const { error } = await sb.from("notion_connections").delete().eq("id", id);
  return error ? NextResponse.json({ error: "failed" }, { status: 500 }) : NextResponse.json({ ok: true });
}
