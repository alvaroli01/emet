import { notFound } from "next/navigation";
import { getSession, type Profile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Avatar, ComingSoon, ViewOnlyBadge } from "@/components/ui";

export default async function GroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { groups, canEditGroup, me } = await getSession();
  const group = groups.find((g) => g.slug === slug);
  if (!group) notFound();

  const supabase = await createClient();
  const { data: members } = await supabase
    .from("profiles").select("*").eq("group_id", group.id).eq("active", true).order("full_name")
    .returns<Profile[]>();
  const editable = canEditGroup(group.id);

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-line bg-surface p-5 shadow-sm"
              style={{ borderTop: `4px solid ${group.color}` }}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-3xl leading-none">{group.emoji}</span>
          <h1 className="text-2xl font-semibold tracking-tight">{group.name}</h1>
          {me.group_id === group.id && (
            <span className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ background: `${group.color}22`, color: group.color }}>Your team</span>
          )}
          {!editable && <ViewOnlyBadge />}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          {members?.length ? members.map((m) => (
            <div key={m.id} className="flex items-center gap-2 rounded-full bg-surface-2 py-1 pr-3 pl-1">
              <Avatar name={m.full_name} src={m.avatar_url} size={26} />
              <span className="text-sm">{m.full_name}</span>
              {m.role_title && <span className="text-xs text-muted">· {m.role_title}</span>}
            </div>
          )) : (
            <p className="text-sm text-muted">No members yet — a team leader assigns people on the Team page.</p>
          )}
        </div>
      </header>
      <ComingSoon step={2} what="KPI cards" />
      <ComingSoon step={3} what={`The ${group.name} task board`} />
      <ComingSoon step={4} what={`${group.name} tools`} />
    </div>
  );
}
