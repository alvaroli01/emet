import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cached, call, myConnections, type Conn } from "@/lib/notion/server";
import { titleOf } from "@/lib/notion/props";
import { toRender } from "@/lib/notion/blocks";
import type { SupabaseClient } from "@supabase/supabase-js";

type B = { id: string; type: string; has_children?: boolean; children?: B[] };
const NEST = new Set(["toggle", "bulleted_list_item", "numbered_list_item", "to_do", "table", "column_list", "column", "callout", "quote"]);

/** One page's blocks, children attached (depth ≤ 3, ≤ 300 blocks), so the page reads like it does in Notion. */
async function children(sb: SupabaseClient, c: Conn, id: string, depth: number, budget: { n: number }): Promise<B[]> {
  const out: B[] = [];
  let cursor: string | undefined;
  do {
    const r = await call<{ results: B[]; has_more: boolean; next_cursor: string | null }>(sb, c, `/blocks/${id}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`);
    out.push(...r.results);
    budget.n -= r.results.length;
    cursor = r.has_more && r.next_cursor && budget.n > 0 ? r.next_cursor : undefined;
  } while (cursor);
  if (depth < 3) {
    for (const b of out) {
      if (b.has_children && NEST.has(b.type) && budget.n > 0) b.children = await children(sb, c, b.id, depth + 1, budget);
    }
  }
  return out;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{32,36}$/i.test(id)) return NextResponse.json({ error: "bad-request" }, { status: 400 });
  const want = request.nextUrl.searchParams.get("c");
  const sb = await createClient();
  const conns = await myConnections(sb);
  for (const c of want ? conns.filter((x) => x.id === want).concat(conns.filter((x) => x.id !== want)) : conns) {
    try {
      const data = await cached(`page:${c.id}:${id}`, 60_000, async () => {
        const page = await call<{ id: string; url: string; last_edited_time: string; icon?: { type?: string; emoji?: string } | null; properties: unknown }>(sb, c, `/pages/${id}`);
        const blocks = await children(sb, c, id, 0, { n: 300 });
        return { id: page.id, c: c.id, title: titleOf(page), url: page.url, edited: page.last_edited_time, icon: page.icon?.type === "emoji" ? page.icon.emoji : null, nodes: toRender(blocks) };
      });
      return NextResponse.json(data);
    } catch { /* try my next workspace */ }
  }
  return NextResponse.json({ error: "not-found" }, { status: 404 });
}
