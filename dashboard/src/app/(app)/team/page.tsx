import { getSession, type Profile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Avatar, Card } from "@/components/ui";

export default async function TeamPage() {
  const { groups, isAdmin } = await getSession();
  const supabase = await createClient();
  const { data: people } = await supabase
    .from("profiles").select("*").eq("active", true).order("full_name").returns<Profile[]>();
  const groupOf = (id: string | null) => groups.find((g) => g.id === id);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="text-sm text-muted">{people?.length ?? 0} members · roles are still being decided</p>
        </div>
        {isAdmin && <p className="text-xs text-muted">Inviting and editing roles arrives in step 4.</p>}
      </div>
      <Card className="p-0">
        <ul className="divide-y divide-line">
          {people?.map((p) => {
            const g = groupOf(p.group_id);
            return (
              <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                <Avatar name={p.full_name} src={p.avatar_url} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{p.full_name}</p>
                  <p className="truncate text-xs text-muted">{p.role_title ?? "Role TBD"}</p>
                </div>
                <span className="text-sm text-muted">{g ? `${g.emoji} ${g.name}` : "No group yet"}</span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
