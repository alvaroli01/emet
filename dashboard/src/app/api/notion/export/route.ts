import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { call, myConnections } from "@/lib/notion/server";
import { chunk, markdownToBlocks } from "@/lib/notion/blocks";
import { exportMarkdown, type ExportKind } from "@/lib/notion/export";

const KINDS: ExportKind[] = ["meeting", "doc", "idea", "project_update"];
const UUID = /^[0-9a-f-]{36}$/i;

/** Already saved? → its Notion link (the button then opens it instead of making a copy). */
export async function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("kind") as ExportKind, id = request.nextUrl.searchParams.get("id") ?? "";
  if (!KINDS.includes(kind) || !UUID.test(id)) return NextResponse.json({ error: "bad-request" }, { status: 400 });
  const sb = await createClient();
  const [{ data }, conns] = await Promise.all([
    sb.from("notion_exports").select("url").eq("kind", kind).eq("source_id", id).maybeSingle(),
    myConnections(sb),
  ]);
  return NextResponse.json({ url: data?.url ?? null, connected: conns.length > 0, canSave: conns.some((c) => c.save_parent) });
}

/** Save one item to my Notion, under the "Save to" page I picked. The source is read as me (RLS), so I can only export what I can see. */
export async function POST(request: NextRequest) {
  const { kind, id } = (await request.json().catch(() => ({}))) as { kind?: ExportKind; id?: string };
  if (!kind || !KINDS.includes(kind) || !id || !UUID.test(id)) return NextResponse.json({ error: "bad-request" }, { status: 400 });
  const sb = await createClient();
  const { data: done } = await sb.from("notion_exports").select("url").eq("kind", kind).eq("source_id", id).maybeSingle();
  if (done) return NextResponse.json({ url: done.url });
  const conn = (await myConnections(sb)).find((c) => c.save_parent);
  if (!conn) return NextResponse.json({ error: "no-save-page" }, { status: 400 });

  let src: Record<string, unknown> | null = null;
  if (kind === "meeting") src = (await sb.from("meetings").select("title, meeting_date, notes, transcript").eq("id", id).maybeSingle()).data;
  else if (kind === "doc") src = (await sb.from("docs").select("title, body, doc_date").eq("id", id).maybeSingle()).data;
  else if (kind === "project_update") {
    const r = (await sb.from("project_updates").select("body, created_at, projects(name)").eq("id", id).maybeSingle()).data as { body: string; created_at: string; projects: { name: string } | null } | null;
    src = r ? { body: r.body, created_at: r.created_at, project: r.projects?.name } : null;
  } else {
    const [idea, council] = await Promise.all([
      sb.from("lab_ideas").select("title, pitch, score, analysis").eq("id", id).maybeSingle(),
      sb.from("lab_councils").select("chairman").eq("idea_id", id).eq("status", "done").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    src = idea.data ? { ...idea.data, chairman: council.data?.chairman ?? null } : null;
  }
  if (!src) return NextResponse.json({ error: "not-found" }, { status: 404 });

  const md = exportMarkdown(kind, src);
  const [first, ...rest] = chunk(markdownToBlocks(md.body));
  try {
    const page = await call<{ id: string; url: string }>(sb, conn, "/pages", { method: "POST", body: {
      parent: { type: "page_id", page_id: conn.save_parent },
      properties: { title: { title: [{ type: "text", text: { content: md.title.slice(0, 2000) } }] } },
      children: first ?? [],
    } });
    // Remember it at once, so a retry or a double click opens this page instead of making a second one
    await sb.from("notion_exports").insert({ kind, source_id: id, notion_page_id: page.id, url: page.url });
    try {
      for (const part of rest) await call(sb, conn, `/blocks/${page.id}/children`, { method: "PATCH", body: { children: part } });
    } catch {
      return NextResponse.json({ url: page.url, partial: true });
    }
    return NextResponse.json({ url: page.url });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 502 });
  }
}
