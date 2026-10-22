import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { call, myConnections, oauthConfigured } from "@/lib/notion/server";
import { titleOf } from "@/lib/notion/props";
import { detectMap, type DeadlineMap } from "@/lib/notion/deadlines";

type Hit = { id: string; object: string; title?: { plain_text?: string }[]; properties?: unknown; url?: string };
const dsTitle = (x: Hit) => (x.title ?? []).map((t) => t.plain_text ?? "").join("").trim() || "Untitled";

/** My Notion connections (never the tokens) + what can be picked: databases for deadlines, pages for "Save to". */
export async function GET() {
  const sb = await createClient();
  const conns = await myConnections(sb, true);
  const out = await Promise.all(conns.map(async (c) => {
    const base = { id: c.id, workspace: c.workspace_name, icon: c.workspace_icon, reconnect: c.needs_reconnect, deadlines_ds: c.deadlines_ds, deadlines_map: c.deadlines_map, save_parent: c.save_parent };
    if (c.needs_reconnect) return { ...base, databases: [], pages: [], columns: null };
    try {
      const [ds, pages] = await Promise.all([
        call<{ results: Hit[] }>(sb, c, "/search", { method: "POST", body: { filter: { property: "object", value: "data_source" }, page_size: 50 } }),
        call<{ results: Hit[] }>(sb, c, "/search", { method: "POST", body: { filter: { property: "object", value: "page" }, page_size: 50 } }),
      ]);
      let columns: Record<string, string> | null = null;
      if (c.deadlines_ds) {
        const schema = await call<{ properties: Record<string, { type: string }> }>(sb, c, `/data_sources/${c.deadlines_ds}`).catch(() => null);
        columns = schema ? Object.fromEntries(Object.entries(schema.properties).map(([k, v]) => [k, v.type])) : null;
      }
      return { ...base, databases: ds.results.map((x) => ({ id: x.id, title: dsTitle(x) })), pages: pages.results.map((x) => ({ id: x.id, title: titleOf(x) })), columns };
    } catch {
      return { ...base, databases: [], pages: [], columns: null, error: true };
    }
  }));
  return NextResponse.json({ configured: oauthConfigured(), connections: out });
}

/** Save one connection's picks. A new deadlines database gets its columns detected unless the member chose them. */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { id?: string; deadlines_ds?: string | null; deadlines_map?: DeadlineMap | null; save_parent?: string | null };
  const ID = /^[0-9a-f-]{32,36}$/i;
  const okId = (v: unknown) => v === undefined || v === null || v === "" || (typeof v === "string" && ID.test(v));
  const okMap = (m: unknown) => m === undefined || m === null || (typeof m === "object" && typeof (m as DeadlineMap).title === "string" && typeof (m as DeadlineMap).date === "string");
  if (!body.id || !okId(body.deadlines_ds) || !okId(body.save_parent) || !okMap(body.deadlines_map)) return NextResponse.json({ error: "bad-request" }, { status: 400 });
  const sb = await createClient();
  const c = (await myConnections(sb)).find((x) => x.id === body.id);
  if (!c) return NextResponse.json({ error: "not-found" }, { status: 404 });
  const patch: Record<string, unknown> = {};
  if ("save_parent" in body) patch.save_parent = body.save_parent || null;
  if ("deadlines_ds" in body) {
    patch.deadlines_ds = body.deadlines_ds || null;
    if (!body.deadlines_ds) patch.deadlines_map = null;
    else if (body.deadlines_map) patch.deadlines_map = body.deadlines_map;
    else {
      const schema = await call<{ properties: Record<string, { type: string }> }>(sb, c, `/data_sources/${body.deadlines_ds}`).catch(() => null);
      const map = schema ? detectMap(schema.properties) : null;
      if (!map) return NextResponse.json({ error: "no-date-column" }, { status: 400 });
      patch.deadlines_map = map;
    }
  } else if (body.deadlines_map) patch.deadlines_map = body.deadlines_map;
  const { error } = await sb.from("notion_connections").update(patch).eq("id", c.id);
  return error ? NextResponse.json({ error: "failed" }, { status: 500 }) : NextResponse.json({ ok: true, deadlines_map: patch.deadlines_map ?? c.deadlines_map });
}
