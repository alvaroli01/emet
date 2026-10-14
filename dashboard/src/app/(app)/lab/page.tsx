import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { loadMembers } from "@/lib/boards";
import { LiveRefresh } from "@/components/live-refresh";
import { IdeaLab, type LabIdea, type LabComment } from "@/components/lab/idea-lab";

/** Idea lab: the team's shared place to pitch, research and judge business ideas. */
export default async function LabPage({ searchParams }: { searchParams: Promise<{ i?: string }> }) {
  const { i } = await searchParams;
  const { me, isAdmin } = await getSession();
  const supabase = await createClient();
  const [ideas, votes, comments, members, aiKey] = await Promise.all([
    supabase.from("lab_ideas").select("*").order("created_at", { ascending: false }).returns<LabIdea[]>(),
    supabase.from("lab_votes").select("idea_id, user_id").returns<{ idea_id: string; user_id: string }[]>(),
    supabase.from("lab_comments").select("*").order("created_at").returns<LabComment[]>(),
    loadMembers(),
    supabase.from("ai_keys").select("last4").maybeSingle(),
  ]);
  return (
    <div className="space-y-6">
      <LiveRefresh tables={["lab_ideas", "lab_votes", "lab_comments"]} />
      <IdeaLab ideas={ideas.data ?? []} votes={votes.data ?? []} comments={comments.data ?? []}
               names={Object.fromEntries(members.map((m) => [m.id, m.full_name]))}
               meId={me.id} isAdmin={isAdmin} hasKey={!!aiKey.data} initialOpen={i} />
    </div>
  );
}
