import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ownRing } from "@/lib/ai/ring-server";
import { research, analyze, type Research } from "@/lib/lab/ai";

export const maxDuration = 60;

/** One step of the Idea lab AI ("research" or "analyze"), run with the caller's own Groq key. Author or admin only. */
export async function POST(request: NextRequest) {
  const { id, step } = (await request.json().catch(() => ({}))) as { id?: string; step?: "research" | "analyze" };
  if (!id || (step !== "research" && step !== "analyze")) return NextResponse.json({ error: "bad-request" }, { status: 400 });
  const supabase = await createClient();
  const [{ data: idea }, { data: me }, { data: isAdmin }, { data: keyRow }] = await Promise.all([
    supabase.from("lab_ideas").select("id, title, pitch, kind, research, created_by").eq("id", id).maybeSingle(),
    supabase.rpc("my_profile_id"),
    supabase.rpc("is_admin"),
    supabase.from("ai_keys").select("key_iv, key_data").maybeSingle(),
  ]);
  if (!idea) return NextResponse.json({ error: "not-found" }, { status: 404 });
  if (idea.created_by !== me && !isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!keyRow) return NextResponse.json({ error: "no-key" }, { status: 400 });
  const key = ownRing(me as string, keyRow); // counts my use, so lending my key to Scout leaves me my share
  const locale = await getLocale();

  if (step === "research") {
    await supabase.from("lab_ideas").update({ status: "researching" }).eq("id", id);
    const r = await research(key, idea, locale);
    if ("error" in r) return NextResponse.json(r, { status: r.error === "limit" ? 429 : 502 });
    await supabase.from("lab_ideas").update({ research: r }).eq("id", id);
    return NextResponse.json({ ok: true, sources: r.sources.length });
  }

  const a = await analyze(key, idea, (idea.research as Research | null) ?? null, locale);
  if ("error" in a) {
    if (a.error !== "limit") await supabase.from("lab_ideas").update({ status: "failed" }).eq("id", id);
    return NextResponse.json(a, { status: a.error === "limit" ? 429 : 502 });
  }
  const { error } = await supabase.from("lab_ideas").update({ analysis: a, score: a.score, status: "analyzed" }).eq("id", id);
  if (error) return NextResponse.json({ error: "save" }, { status: 500 });
  return NextResponse.json({ ok: true, score: a.score, verdict: a.verdict });
}
