import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { loadMembers } from "@/lib/boards";
import { LiveRefresh } from "@/components/live-refresh";
import { Scout, type ScoutProject, type ScoutSearch, type ScoutLead } from "@/components/scout/scout";

/** Scout: find, judge and work the first clients for a project in any city. */
export default async function ScoutPage({ searchParams }: { searchParams: Promise<{ p?: string; idea?: string }> }) {
  const { p, idea } = await searchParams;
  const { me } = await getSession();
  const supabase = await createClient();
  const [projects, searches, leads, members, aiKey, canScout, ideas] = await Promise.all([
    supabase.from("scout_projects").select("*").order("created_at", { ascending: false }).returns<ScoutProject[]>(),
    supabase.from("scout_searches").select("id, project_id, city, country_code, lat, lng, radius_km, status, found, known, researched, max_places, log, queue, created_by, created_at").order("created_at", { ascending: false }).limit(40).returns<ScoutSearch[]>(),
    supabase.from("scout_leads").select("*, place:scout_places(*)").order("score", { ascending: false }).limit(500).returns<ScoutLead[]>(),
    loadMembers(),
    supabase.from("ai_keys").select("last4").maybeSingle(),
    supabase.rpc("can_scout"),
    supabase.from("lab_ideas").select("id, title, pitch, analysis").order("score", { ascending: false, nullsFirst: false }).limit(50),
  ]);
  const fromIdea = idea ? (ideas.data ?? []).find((i) => i.id === idea) ?? null : null;
  return (
    <div className="space-y-6">
      <LiveRefresh tables={["scout_projects", "scout_searches", "scout_leads"]} />
      <Scout projects={projects.data ?? []} searches={searches.data ?? []} leads={(leads.data ?? []).filter((l) => l.place && !l.place.forgotten)}
             members={members.map((m) => ({ id: m.id, full_name: m.full_name }))} meId={me.id} canScout={!!canScout.data} hasKey={!!aiKey.data}
             ideas={(ideas.data ?? []).map((i) => ({ id: i.id, title: i.title, pitch: i.pitch }))}
             initialProject={p ?? null} fromIdea={fromIdea ? { id: fromIdea.id, title: fromIdea.title, pitch: fromIdea.pitch } : null} />
    </div>
  );
}
