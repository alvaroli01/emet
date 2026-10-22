import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cached, call, myConnections } from "@/lib/notion/server";
import { readProp } from "@/lib/notion/props";

type Schema = { id: string; title?: { plain_text?: string }[]; properties: Record<string, { type: string }>; parent?: { database_id?: string } };

/** A database as a table: its columns (title first, up to 8) and its first 50 rows. Accepts a data source or database id. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{32,36}$/i.test(id)) return NextResponse.json({ error: "bad-request" }, { status: 400 });
  const want = request.nextUrl.searchParams.get("c");
  const sb = await createClient();
  const conns = await myConnections(sb);
  for (const c of want ? conns.filter((x) => x.id === want).concat(conns.filter((x) => x.id !== want)) : conns) {
    try {
      const data = await cached(`db:${c.id}:${id}`, 60_000, async () => {
        let schema = await call<Schema>(sb, c, `/data_sources/${id}`).catch(() => null);
        if (!schema) { // a child_database block gives the database id: open its first data source
          const db = await call<{ data_sources?: { id: string }[] }>(sb, c, `/databases/${id}`);
          schema = await call<Schema>(sb, c, `/data_sources/${db.data_sources?.[0]?.id}`);
        }
        const cols = Object.entries(schema.properties).sort(([, a], [, b]) => Number(b.type === "title") - Number(a.type === "title")).slice(0, 8).map(([name, p]) => ({ name, type: p.type }));
        const q = await call<{ results: { id: string; url: string; properties: Record<string, unknown> }[] }>(sb, c, `/data_sources/${schema.id}/query`, { method: "POST", body: { page_size: 50 } });
        return {
          id: schema.id, c: c.id, title: (schema.title ?? []).map((t) => t.plain_text ?? "").join("").trim() || "Untitled", columns: cols,
          rows: q.results.map((r) => ({ id: r.id, url: r.url, cells: Object.fromEntries(cols.map((col) => [col.name, readProp(r.properties[col.name])])) })),
        };
      });
      return NextResponse.json(data);
    } catch { /* try my next workspace */ }
  }
  return NextResponse.json({ error: "not-found" }, { status: 404 });
}
