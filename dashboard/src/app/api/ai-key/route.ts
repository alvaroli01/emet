import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptKey } from "@/lib/ai/keys";
import { checkKey } from "@/lib/ai/groq";

/** A member connects / disconnects their own Groq account. The key is checked, encrypted, and only used for them —
 *  and, only if they switch on "Lend my AI key to Scout", by Scout on the server (see lib/ai/ring-server.ts). */
/** My AI connections at a glance (the "AI connections" button): Groq, lending to Scout, Mistral backup. */
export async function GET() {
  const supabase = await createClient();
  const day = new Date().toISOString().slice(0, 10);
  const [{ data }, { data: mistral }, { data: usage }, { data: lenders }] = await Promise.all([
    supabase.from("ai_keys").select("last4, lend_scout").maybeSingle(),
    supabase.from("backup_keys").select("last4").maybeSingle(),
    supabase.from("ai_key_usage").select("tokens").eq("day", day),
    supabase.rpc("scout_lenders"),
  ]);
  return NextResponse.json({
    connected: !!data, last4: data?.last4 ?? null, lend: !!data?.lend_scout,
    usedToday: (usage ?? []).reduce((n, r) => n + (r.tokens as number), 0),
    mistral: mistral?.last4 ?? null, lenders: ((lenders ?? []) as { full_name: string }[]).map((l) => l.full_name),
  });
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

/** Lend my key to Scout (on/off). RLS: only my own row can change. */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { lend } = (await request.json().catch(() => ({}))) as { lend?: unknown };
  if (typeof lend !== "boolean") return NextResponse.json({ error: "bad-request" }, { status: 400 });
  const { data, error } = await supabase.from("ai_keys").update({ lend_scout: lend }).select("lend_scout").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "no-key" }, { status: 400 });
  return NextResponse.json({ lend: data.lend_scout });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("my_profile_id");
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await supabase.from("ai_keys").delete().eq("owner_id", me);
  return NextResponse.json({ connected: false });
}
