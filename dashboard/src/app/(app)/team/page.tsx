import { getTranslations } from "next-intl/server";
import { getSession, type Profile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { TeamManager } from "@/components/team-manager";
import { LiveRefresh } from "@/components/live-refresh";
import { PageHero } from "@/components/shell/page-hero";
import { TeamSphere } from "@/components/shell/hero-visuals";
import { Users } from "lucide-react";

export default async function TeamPage() {
  const t = await getTranslations("team");
  const th = await getTranslations("hero");
  const tg = await getTranslations("group.names");
  const { groups, isAdmin, me } = await getSession();
  const supabase = await createClient();
  const { data: people } = await supabase.from("profiles").select("*").order("full_name").returns<Profile[]>();
  const active = (people ?? []).filter((p) => p.active);

  return (
    <div className="space-y-5">
      <LiveRefresh tables={["profiles"]} />
      <PageHero
        section={{ label: t("title"), icon: <Users size={16} /> }}
        title={th("team.title")}
        subtitle={t("subtitle", { count: active.length, joined: active.filter((p) => p.user_id).length })}
        lines={groups.map((g) => ({ text: `${tg(g.slug)}: ${active.filter((p) => p.group_id === g.id).map((p) => p.full_name.split(" ")[0]).join(", ") || "—"}`, tone: "info" as const, href: `/g/${g.slug}` })).slice(0, 4)}
        stats={[
          { label: th("team.people"), value: active.length, kind: "num" },
          { label: th("team.joined"), value: active.filter((p) => p.user_id).length, kind: "num" },
          { label: th("team.noGroup"), value: active.filter((p) => !p.group_id).length, kind: "num" },
        ]}
        visual={<TeamSphere people={active.map((p) => ({ id: p.id, full_name: p.full_name, avatar_url: p.avatar_url }))} />}
      />
      <TeamManager people={people ?? []} groups={groups} meId={me.id} isAdmin={isAdmin} />
    </div>
  );
}
