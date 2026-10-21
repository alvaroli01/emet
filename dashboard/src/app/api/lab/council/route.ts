import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { decryptKey } from "@/lib/ai/keys";
import { advisor, review, chairman, ADVISORS, type AdvisorTake, type Reviews } from "@/lib/lab/council";
import type { Research } from "@/lib/lab/ai";
import { finalVerdict, FATAL_CAP, type Analysis } from "@/lib/lab/score";

export const maxDuration = 60;

/**
 * One step of the council (fits Vercel's time limit): no council id → create one; then 5 advisors one by one,
 * the anonymous review, the chairman. The page calls again until status is "done". Uses the caller's own Groq key.
 */
export async function POST(request: NextRequest) {
  const { idea_id, council_id } = (await request.json().catch(() => ({}))) as { idea_id?: string; council_id?: string };
  if (!idea_id) return NextResponse.json({ error: "bad-request" }, { status: 400 });
  const sb = await createClient();
  const [{ data: idea }, { data: keyRow }] = await Promise.all([
    sb.from("lab_ideas").select("id, title, pitch, kind, research, analysis").eq("id", idea_id).maybeSingle(),
    sb.from("ai_keys").select("key_iv, key_data").maybeSingle(),
  ]);
  if (!idea) return NextResponse.json({ error: "not-found" }, { status: 404 });
  if (!keyRow) return NextResponse.json({ error: "no-key" }, { status: 400 });

  if (!council_id) {
    const { data, error } = await sb.from("lab_councils").insert({ idea_id }).select("id").single();
    if (error || !data) return NextResponse.json({ error: "save" }, { status: 500 });
    return NextResponse.json({ council_id: data.id, status: "running", step: 0 });
  }
  const { data: c } = await sb.from("lab_councils").select("*").eq("id", council_id).eq("idea_id", idea_id).maybeSingle();
  if (!c) return NextResponse.json({ error: "not-found" }, { status: 404 });
  if (c.status !== "running") return NextResponse.json({ council_id, status: c.status });

  const key = decryptKey(keyRow);
  const locale = await getLocale();
  const input = { title: idea.title, pitch: idea.pitch ?? "", kind: idea.kind, research: idea.research as Research | null, analysis: idea.analysis as Analysis | null };
  const takes = (c.advisors ?? []) as AdvisorTake[];
  const fail = (r: { error: string; retryAfter?: number }) => NextResponse.json(r, { status: r.error === "limit" ? 429 : 502 });

  let patch: Record<string, unknown>;
  if (takes.length < ADVISORS.length) {
    const r = await advisor(key, input, takes.length, locale);
    if ("error" in r) { if (r.error !== "limit") await sb.from("lab_councils").update({ status: "failed" }).eq("id", council_id); return fail(r); }
    patch = { advisors: [...takes, r] };
  } else if (!c.reviews) {
    // Shuffle so the review can't favour an advisor by position
    const order = takes.map((_, i) => i).sort(() => Math.random() - 0.5);
    const r = await review(key, input, takes, order, locale);
    patch = { reviews: "error" in r ? { strongest: "", weakest: "", missed: "", notes: [] } : r };
    if ("error" in r && r.error === "limit") return fail(r);
  } else {
    const r = await chairman(key, input, takes, c.reviews as Reviews, locale);
    if ("error" in r) { if (r.error !== "limit") await sb.from("lab_councils").update({ status: "failed" }).eq("id", council_id); return fail(r); }
    patch = { chairman: r, status: "done" };
    // The chairman can only make the official verdict harsher (score capped to match), never kinder
    const an = idea.analysis as Analysis | null;
    if (an) {
      const verdict = finalVerdict(an.verdict, r.verdict);
      const score = verdict === "not_recommended" ? Math.min(an.score, FATAL_CAP) : verdict === "promising" ? Math.min(an.score, 74) : an.score;
      if (verdict !== an.verdict || score !== an.score)
        await sb.from("lab_ideas").update({ analysis: { ...an, verdict, score, council_verdict: r.verdict }, score }).eq("id", idea_id);
    }
  }
  const { error } = await sb.from("lab_councils").update(patch).eq("id", council_id);
  if (error) return NextResponse.json({ error: "save" }, { status: 500 });
  const step = (patch.advisors as unknown[] | undefined)?.length ?? (patch.reviews ? 6 : 7);
  return NextResponse.json({ council_id, status: patch.status ?? "running", step });
}
