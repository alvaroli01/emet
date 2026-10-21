import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cardHref } from "@/lib/projects";

export type SearchHit = { type: "card" | "doc" | "meeting" | "decision" | "idea" | "person"; id: string; title: string; snippet?: string; href: string };

/** Search across the workspace. Runs as the user, so the database only returns what they may see. */
export async function GET(request: NextRequest) {
  const raw = (request.nextUrl.searchParams.get("q") ?? "").trim();
  // Keep the query safe for PostgREST filters
  const q = raw.replace(/[%_,()*\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ hits: [] });
  const like = `%${q}%`;
  const supabase = await createClient();
  const [cards, docs, meetings, decisions, ideas, people, groups] = await Promise.all([
    supabase.from("cards").select("id, title, description, boards(group_id, project_id)").or(`title.ilike.${like},description.ilike.${like}`).limit(6),
    supabase.from("docs").select("id, title, body").or(`title.ilike.${like},body.ilike.${like}`).limit(5),
    supabase.from("meetings").select("id, title, notes, transcript").or(`title.ilike.${like},notes.ilike.${like},transcript.ilike.${like}`).limit(5),
    supabase.from("decisions").select("id, decision, date").ilike("decision", like).limit(4),
    supabase.from("lab_ideas").select("id, title, pitch").or(`title.ilike.${like},pitch.ilike.${like}`).limit(4),
    supabase.from("profiles").select("id, full_name, role_title").eq("active", true).ilike("full_name", like).limit(4),
    supabase.from("groups").select("id, slug"),
  ]);
  const slug = new Map((groups.data ?? []).map((g) => [g.id, g.slug]));
  const plain = (t: string) => t.replace(/[*_#>`]+/g, "").replace(/- \[[ x]\] /gi, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  const snip = (raw: string | null | undefined) => {
    if (!raw) return undefined;
    const text = plain(raw);
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return text.slice(0, 110);
    const start = Math.max(0, i - 40);
    return (start ? "…" : "") + text.slice(start, i + q.length + 70).replace(/\s+/g, " ") + "…";
  };
  const hits: SearchHit[] = [
    ...(cards.data ?? []).map((c) => {
      const b = c.boards as unknown as { group_id: string | null; project_id: string | null } | null;
      return { type: "card" as const, id: c.id, title: c.title, snippet: snip(c.description), href: cardHref({ id: c.id, boards: b }, (gid) => slug.get(gid)) };
    }),
    ...(docs.data ?? []).map((d) => ({ type: "doc" as const, id: d.id, title: d.title, snippet: snip(d.body), href: `/camp?tab=docs&doc=${d.id}` })),
    ...(meetings.data ?? []).map((m) => ({ type: "meeting" as const, id: m.id, title: m.title, snippet: snip(m.notes) ?? snip(m.transcript), href: `/meetings?m=${m.id}` })),
    ...(decisions.data ?? []).map((d) => ({ type: "decision" as const, id: d.id, title: d.decision.slice(0, 120), snippet: d.date, href: "/g/communications?tab=decisions" })),
    ...(ideas.data ?? []).map((i) => ({ type: "idea" as const, id: i.id, title: i.title, snippet: snip(i.pitch), href: `/lab?i=${i.id}` })),
    ...(people.data ?? []).map((p) => ({ type: "person" as const, id: p.id, title: p.full_name, snippet: p.role_title ?? undefined, href: "/team" })),
  ];
  return NextResponse.json({ hits });
}
