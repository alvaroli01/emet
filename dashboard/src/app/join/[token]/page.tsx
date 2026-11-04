import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/drive";
import { JoinForm } from "./join-form";

type Invite = { project_id: string; projects: { name: string } | null };

/** Invite link for Ollin people. Logged in → join the project and open it. Not logged in → name + Gmail form. */
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations("join");
  const db = serviceDb();
  const { data: invite } = /^[0-9a-f]{32}$/.test(token)
    ? await db.from("project_invites").select("project_id, projects(name)").eq("token", token).maybeSingle<Invite>()
    : { data: null };

  if (invite) {
    const { data } = await (await createClient()).auth.getClaims();
    const userId = data?.claims?.sub;
    const { data: me } = userId
      ? await db.from("profiles").select("id").eq("user_id", userId).eq("active", true).maybeSingle()
      : { data: null };
    if (me) {
      const { error } = await db.from("project_members")
        .upsert({ project_id: invite.project_id, user_id: me.id }, { onConflict: "project_id,user_id", ignoreDuplicates: true });
      if (!error) redirect(`/projects/${invite.project_id}`);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-bg p-4">
      <section className="panel w-full max-w-sm space-y-4 p-6">
        <p className="text-sm font-semibold tracking-tight text-muted">emet HQ</p>
        {invite ? (<>
          <h1 className="text-xl font-semibold tracking-tight">{t("title", { project: invite.projects?.name ?? "" })}</h1>
          <JoinForm token={token} />
        </>) : <p className="text-sm">{t("invalid")}</p>}
      </section>
    </main>
  );
}
