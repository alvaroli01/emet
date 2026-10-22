import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Remove one of my Notion connections (RLS: only my own rows). Notion-side access can also be removed in Notion. */
export async function POST(request: NextRequest) {
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "bad-request" }, { status: 400 });
  const sb = await createClient();
  const { error } = await sb.from("notion_connections").delete().eq("id", id);
  return error ? NextResponse.json({ error: "failed" }, { status: 500 }) : NextResponse.json({ ok: true });
}
