import { getTranslations } from "next-intl/server";
import { getSession, type Profile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { TeamManager } from "@/components/team-manager";
import { LiveRefresh } from "@/components/live-refresh";

export default async function TeamPage() {
  const t = await getTranslations("team");
  const { groups, isAdmin, me } = await getSession();
  const supabase = await createClient();
  const { data: people } = await supabase.from("profiles").select("*").order("full_name").returns<Profile[]>();
  const active = (people ?? []).filter((p) => p.active);

  return (
    <div className="space-y-5">
      <LiveRefresh tables={["profiles"]} />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted">{t("subtitle", { count: active.length, joined: active.filter((p) => p.user_id).length })}</p>
      </div>
      <TeamManager people={people ?? []} groups={groups} meId={me.id} isAdmin={isAdmin} />
    </div>
  );
}
