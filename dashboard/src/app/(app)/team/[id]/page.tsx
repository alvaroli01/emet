import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getSession, type Profile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { weekStart } from "@/lib/metrics";
import { todayISO } from "@/lib/format";
import { loadMember } from "@/lib/team-stats";
import { MemberDashboard } from "@/components/team/member-dashboard";

/** One person's page: their open and finished tasks, sales, weekly activity and what's coming up. */
export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { groups } = await getSession();
  const supabase = await createClient();
  const { data: person } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle<Profile>();
  if (!person) notFound();
  const locale = await getLocale();
  const d = await loadMember(person, groups, weekStart(Date.now()), locale, (await getTranslations("personal"))("company"));
  const g = groups.find((x) => x.id === person.group_id);
  return (
    <MemberDashboard today={todayISO()} d={d}
      p={{ id: person.id, name: person.full_name, email: person.email, avatar: person.avatar_url, role: person.role_title, team: g?.name ?? null, teamSlug: g?.slug ?? null }} />
  );
}
