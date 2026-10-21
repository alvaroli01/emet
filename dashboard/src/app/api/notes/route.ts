import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptKey } from "@/lib/ai/keys";
import { makeNotes } from "@/lib/ai/groq";
import { recordUse } from "@/lib/ai/ring-server";

export const maxDuration = 60;

/** The full transcript → organised notes (summary, key points, decisions, action items), with the caller's key. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: row } = await supabase.from("ai_keys").select("key_iv, key_data").maybeSingle();
  if (!row) return NextResponse.json({ error: "no-key" }, { status: 400 });
  const { transcript } = (await request.json().catch(() => ({}))) as { transcript?: string };
  if (!transcript?.trim()) return NextResponse.json({ error: "empty" }, { status: 400 });
  if (transcript.length > 200_000) return NextResponse.json({ error: "too-long" }, { status: 413 });

  const { data: me } = await supabase.rpc("my_profile_id");
  // My use is counted so lending my key to Scout always leaves me my share
  const r = await makeNotes(decryptKey(row), transcript, (model, tokens) => (me ? recordUse(me as string, model, tokens) : undefined));
  if ("markdown" in r) return NextResponse.json(r);
  if (r.kind === "limit") return NextResponse.json({ error: "limit", retryAfter: r.retryAfter }, { status: 429 });
  return NextResponse.json({ error: r.kind }, { status: 502 });
}
