import { getTranslations } from "next-intl/server";
import { Lightbulb } from "lucide-react";
import { getSession } from "@/lib/session";
import { PageHero } from "@/components/shell/page-hero";
import { IdeaOrbit } from "@/components/shell/hero-visuals";
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
  const th = await getTranslations("hero");
  const tn = await getTranslations("nav");
  const tl = await getTranslations("lab");
  const all = ideas.data ?? [];
  const best = [...all].filter((x) => x.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  const toVote = all.filter((x) => x.status === "analyzed" && !(votes.data ?? []).some((v) => v.idea_id === x.id && v.user_id === me.id)).length;

  return (
    <div className="space-y-6">
      <LiveRefresh tables={["lab_ideas", "lab_votes", "lab_comments"]} />
      <PageHero
        art={["sparkle", "cloud", "globe", "ring"]}
        section={{ label: tn("lab"), icon: <Lightbulb size={16} /> }}
        title={th("lab.title", { name: me.full_name.split(" ")[0] })}
        subtitle={tl("subtitle")}
        lines={[
          ...(best ? [{ text: th("lab.best", { title: best.title, score: best.score ?? 0 }), tone: "ok" as const, href: `/lab?i=${best.id}` }] : []),
          ...(toVote ? [{ text: th("lab.toVote", { count: toVote }), tone: "info" as const }] : []),
          ...(!all.length ? [{ text: th("lab.empty"), tone: "info" as const, href: "#pitch" }] : []),
        ]}
        stats={[
          { label: th("lab.ideas"), value: all.length, kind: "num" },
          { label: th("lab.strong"), value: all.filter((x) => (x.score ?? 0) >= 75).length, kind: "num" },
          { label: th("lab.votes"), value: (votes.data ?? []).length, kind: "num" },
        ]}
        actions={[{ label: th("lab.pitch"), href: "#pitch", primary: true }, { label: th("lab.scout"), href: "/scout" }]}
        visual={<IdeaOrbit ideas={[...all].sort((a, b) => (b.score ?? -1) - (a.score ?? -1)).slice(0, 11).map((x) => ({ id: x.id, title: x.title, score: x.score }))} />}
      />
      <IdeaLab ideas={ideas.data ?? []} votes={votes.data ?? []} comments={comments.data ?? []}
               names={Object.fromEntries(members.map((m) => [m.id, m.full_name]))}
               meId={me.id} isAdmin={isAdmin} hasKey={!!aiKey.data} initialOpen={i} />
    </div>
  );
}
