import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptKey } from "@/lib/ai/keys";
import { transcribe } from "@/lib/ai/groq";

export const maxDuration = 60;

/** One recorded chunk (≈1 minute) → text, using the caller's own Groq key. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: row } = await supabase.from("ai_keys").select("key_iv, key_data").maybeSingle();
  if (!row) return NextResponse.json({ error: "no-key" }, { status: 400 });

  const form = await request.formData();
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return NextResponse.json({ error: "no-audio" }, { status: 400 });
  if (audio.size > 20 * 1024 * 1024) return NextResponse.json({ error: "too-big" }, { status: 413 });
  const lang = String(form.get("language") ?? "");
  const r = await transcribe(decryptKey(row), audio, String(form.get("name") ?? "chunk.webm"),
    lang === "es" || lang === "en" ? lang : undefined, String(form.get("prompt") ?? "") || undefined);

  if ("text" in r) return NextResponse.json(r);
  if (r.kind === "limit") return NextResponse.json({ error: "limit", retryAfter: r.retryAfter }, { status: 429 });
  if (r.kind === "bad-key") return NextResponse.json({ error: "bad-key" }, { status: 400 });
  return NextResponse.json({ error: "failed" }, { status: 502 });
}
