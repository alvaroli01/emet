import { getTranslations } from "next-intl/server";
import { getSession, type Profile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { TeamManager } from "@/components/team-manager";
import { LiveRefresh } from "@/components/live-refresh";
import { TeamTable } from "@/components/team/team-table";
import { loadTeamTable } from "@/lib/team-stats";

export default async function TeamPage() {
  const t = await getTranslations("team");
  const { groups, isAdmin, me } = await getSession();
  const supabase = await createClient();
  const { data: people } = await supabase.from("profiles").select("*").order("full_name").returns<Profile[]>();
  const active = (people ?? []).filter((p) => p.active);

  return (
    <div className="space-y-5">
      <LiveRefresh tables={["profiles"]} />
      <h1 className="pt-1 text-[clamp(1.7rem,3.5vw,2.4rem)] font-medium tracking-tight">{t("title")}</h1>
      <p className="-mt-3 text-sm text-muted">{t("subtitle", { count: active.length, joined: active.filter((p) => p.user_id).length })}</p>
      <TeamTable rows={await loadTeamTable(people ?? [], groups)} />
      <details className="panel group p-4 sm:p-6">
        <summary className="cursor-pointer list-none font-medium marker:hidden">{t("manage")}</summary>
        <div className="mt-4">
          <TeamManager people={people ?? []} groups={groups} meId={me.id} isAdmin={isAdmin} />
        </div>
      </details>
    </div>
  );
}
