import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptKey } from "@/lib/ai/keys";

/**
 * A member connects / disconnects their own free Mistral key (Experiment plan, no card) — Scout's backup AI when every
 * Groq key is used up. Checked with Mistral, encrypted, readable only by its owner (and Scout on the server).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("my_profile_id");
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { key } = (await request.json().catch(() => ({}))) as { key?: string };
  const clean = (key ?? "").trim();
  if (!/^[A-Za-z0-9]{20,64}$/.test(clean)) return NextResponse.json({ error: "format" }, { status: 400 });
  const check = await fetch("https://api.mistral.ai/v1/models", { headers: { Authorization: `Bearer ${clean}` } }).catch(() => null);
  if (!check?.ok) return NextResponse.json({ error: "rejected" }, { status: 400 });
  const { error } = await supabase.from("backup_keys").upsert({ owner_id: me, provider: "mistral", ...encryptKey(clean) });
  if (error) return NextResponse.json({ error: "save" }, { status: 500 });
  return NextResponse.json({ connected: true, last4: clean.slice(-4) });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("my_profile_id");
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await supabase.from("backup_keys").delete().eq("owner_id", me);
  return NextResponse.json({ connected: false });
}
