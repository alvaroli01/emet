import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { call, myConnections } from "@/lib/notion/server";
import { titleOf } from "@/lib/notion/props";

type Hit = { id: string; object: string; url?: string; last_edited_time?: string; icon?: { type?: string; emoji?: string } | null; title?: { plain_text?: string }[]; properties?: unknown };

/** Search (or, with no words, the recently edited) pages and databases across all my Notion workspaces. */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 200);
  const sb = await createClient();
  const conns = await myConnections(sb);
  if (!conns.length) return NextResponse.json({ connected: false, results: [] });
  const lists = await Promise.all(conns.map(async (c) => {
    try {
      const r = await call<{ results: Hit[] }>(sb, c, "/search", { method: "POST", body: {
        ...(q ? { query: q } : {}), page_size: 25, sort: { direction: "descending", timestamp: "last_edited_time" } } });
      return r.results.map((x) => ({
        id: x.id, c: c.id, workspace: c.workspace_name, url: x.url ?? null, edited: x.last_edited_time ?? null,
        kind: x.object === "page" ? "page" : "database",
        icon: x.icon?.type === "emoji" ? x.icon.emoji : null,
        title: x.object === "page" ? titleOf(x) : (x.title ?? []).map((t) => t.plain_text ?? "").join("").trim() || "Untitled",
      }));
    } catch { return []; }
  }));
  const results = lists.flat().sort((a, b) => (b.edited ?? "").localeCompare(a.edited ?? "")).slice(0, 40);
  return NextResponse.json({ connected: true, results });
}
