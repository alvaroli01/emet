import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptKey } from "@/lib/ai/keys";
import { checkKey } from "@/lib/ai/groq";

/** A member connects / disconnects their own Groq account. The key is checked, encrypted, and only ever used for them. */
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.from("ai_keys").select("last4, created_at").maybeSingle();
  return NextResponse.json({ connected: !!data, last4: data?.last4 ?? null });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("my_profile_id");
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { key } = (await request.json().catch(() => ({}))) as { key?: string };
  const clean = (key ?? "").trim();
  if (!/^gsk_[A-Za-z0-9]{20,}$/.test(clean)) return NextResponse.json({ error: "format" }, { status: 400 });
  if (!(await checkKey(clean))) return NextResponse.json({ error: "rejected" }, { status: 400 });
  const { error } = await supabase.from("ai_keys").upsert({ owner_id: me, provider: "groq", ...encryptKey(clean) });
  if (error) return NextResponse.json({ error: "save" }, { status: 500 });
  return NextResponse.json({ connected: true, last4: clean.slice(-4) });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("my_profile_id");
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await supabase.from("ai_keys").delete().eq("owner_id", me);
  return NextResponse.json({ connected: false });
}
