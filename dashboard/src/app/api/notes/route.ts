import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptKey } from "@/lib/ai/keys";
import { notesRequest, notesPrompt, mainLanguage } from "@/lib/ai/groq";
import type { NotesStep } from "@/lib/ai/notes-steps";
import { recordUse } from "@/lib/ai/ring-server";

export const maxDuration = 60;

/** One notes step with the caller's key: a whole short transcript, one part of a long one, or the merge of the parts'
 *  notes (the browser runs the steps, see lib/ai/notes-steps.ts). Old clients may still send { transcript }. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: row } = await supabase.from("ai_keys").select("key_iv, key_data").maybeSingle();
  if (!row) return NextResponse.json({ error: "no-key" }, { status: 400 });
  const body = (await request.json().catch(() => ({}))) as Partial<NotesStep> & { transcript?: string };
  const mode = body.mode ?? "whole";
  const text = mode === "merge" ? (body.notes ?? []).join("\n\n---\n\n") : (body.text ?? body.transcript ?? "");
  if (!text.trim()) return NextResponse.json({ error: "empty" }, { status: 400 });
  if (text.length > 60_000) return NextResponse.json({ error: "too-long" }, { status: 413 });
  const lang = body.lang === "es" || body.lang === "en" ? body.lang : mainLanguage(text);

  const { data: me } = await supabase.rpc("my_profile_id");
  // My use is counted so lending my key to Scout always leaves me my share
  const r = await notesRequest(decryptKey(row), notesPrompt(mode, text, body.index, body.total), lang, (model, tokens) => (me ? recordUse(me as string, model, tokens) : undefined));
  if ("markdown" in r) return NextResponse.json(r);
  if (r.kind === "limit") return NextResponse.json({ error: "limit", retryAfter: r.retryAfter }, { status: 429 });
  return NextResponse.json({ error: r.kind }, { status: 502 });
}
