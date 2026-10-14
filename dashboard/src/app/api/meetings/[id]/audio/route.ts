import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteFiles } from "@/lib/drive";

/** All audio parts of a meeting, in order: recent ones from Supabase Storage, archived ones through the Drive proxy. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: meeting } = await supabase.from("meetings").select("id").eq("id", id).maybeSingle(); // RLS: may this person see it?
  if (!meeting) return NextResponse.json({ error: "not-found" }, { status: 404 });

  const [{ data: files }, { data: archived }] = await Promise.all([
    supabase.storage.from("meetings").list(id, { sortBy: { column: "name", order: "asc" } }),
    supabase.from("meeting_audio").select("part").eq("meeting_id", id),
  ]);
  const local = (files ?? []).map((f) => f.name);
  const { data: signed } = local.length
    ? await supabase.storage.from("meetings").createSignedUrls(local.map((n) => `${id}/${n}`), 6 * 3600)
    : { data: [] as { signedUrl: string | null }[] };
  const parts = [
    ...local.map((part, i) => ({ part, url: signed?.[i]?.signedUrl ?? null, archived: false })),
    ...(archived ?? []).map((a) => ({ part: a.part, url: `/api/meetings/${id}/audio/${encodeURIComponent(a.part)}`, archived: true })),
  ].filter((p) => p.url).sort((a, b) => a.part.localeCompare(b.part));
  return NextResponse.json({ parts });
}

/** Before a meeting is deleted: remove its archived audio from Drive too (author or admin only). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: m }, { data: me }, { data: isAdmin }] = await Promise.all([
    supabase.from("meetings").select("created_by").eq("id", id).maybeSingle(),
    supabase.rpc("my_profile_id"),
    supabase.rpc("is_admin"),
  ]);
  if (!m || (m.created_by !== me && !isAdmin)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { data: archived } = await supabase.from("meeting_audio").select("drive_file_id").eq("meeting_id", id);
  await deleteFiles((archived ?? []).map((a) => a.drive_file_id));
  return NextResponse.json({ ok: true });
}
