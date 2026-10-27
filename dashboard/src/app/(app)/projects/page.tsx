import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { FolderKanban, Users } from "lucide-react";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { loadMembers } from "@/lib/boards";
import { Avatar } from "@/components/ui";
import { shortDate, timeAgo } from "@/lib/format";

type P = { id: string; name: string; status: string; color: string; project_members: { user_id: string }[]; boards: { id: string }[] };
type C = { id: string; title: string; board_id: string; due_at: string | null; card_assignees: { user_id: string }[]; board_lists: { name: string } | null };
type U = { project_id: string; body: string; created_by: string | null; created_at: string };

/** Coach (and leaders/admins): every project, who is in it and what each person is working on right now. Read only. */
export default async function AllProjectsPage() {
  const { me, isAdmin, isLeader } = await getSession();
  if (!me.is_coach && !isAdmin && !isLeader) notFound();
  const t = await getTranslations("allProjects");
  const locale = await getLocale();
  const sb = await createClient();
  const [{ data: projects }, people] = await Promise.all([
    sb.from("projects").select("id, name, status, color, project_members(user_id), boards(id)").neq("status", "closed").order("name").returns<P[]>(),
    loadMembers(),
  ]);
  const boardIds = (projects ?? []).flatMap((p) => p.boards.map((b) => b.id));
  const [{ data: cards }, { data: updates }] = await Promise.all([
    boardIds.length ? sb.from("cards").select("id, title, board_id, due_at, card_assignees(user_id), board_lists(name)").in("board_id", boardIds).is("completed_at", null).returns<C[]>() : Promise.resolve({ data: [] as C[] }),
    sb.from("project_updates").select("project_id, body, created_by, created_at").order("created_at", { ascending: false }).limit(200).returns<U[]>(),
  ]);
  const person = new Map(people.map((p) => [p.id, p]));

  return (
    <div className="space-y-5">
      <header>
        <p className="flex items-center gap-2 text-sm text-muted"><FolderKanban size={15} /> {t("title")}</p>
        <h1 className="mt-1 text-[clamp(1.5rem,3vw,2.1rem)] font-[650] tracking-tight">{t("heading")}</h1>
        <p className="text-sm text-muted">{t("hint")}</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        {(projects ?? []).map((p) => {
          const ids = new Set(p.boards.map((b) => b.id));
          const open = (cards ?? []).filter((c) => ids.has(c.board_id));
          const last = (updates ?? []).find((u) => u.project_id === p.id);
          return (
            <section key={p.id} className="panel p-5">
              <div className="flex items-center gap-2.5">
                <span className="size-3 rounded-full" style={{ background: p.color }} />
                <Link href={`/projects/${p.id}`} className="font-semibold hover:text-link">{p.name}</Link>
                <span className="ml-auto flex items-center gap-1 text-xs text-muted"><Users size={12} /> {p.project_members.length}</span>
              </div>
              <ul className="mt-3 space-y-2.5">
                {p.project_members.map((m) => {
                  const who = person.get(m.user_id);
                  const doing = open.filter((c) => c.card_assignees.some((a) => a.user_id === m.user_id));
                  return (
                    <li key={m.user_id} className="flex items-start gap-2.5 text-sm">
                      <Avatar name={who?.full_name ?? "?"} src={who?.avatar_url ?? null} size={26} />
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{who?.full_name ?? "—"}</span>
                        {doing.length ? doing.slice(0, 3).map((c) => (
                          <span key={c.id} className="block truncate text-xs text-muted">{c.board_lists?.name ?? ""} · {c.title}{c.due_at ? ` · ${shortDate(c.due_at, locale)}` : ""}</span>
                        )) : <span className="block text-xs text-muted">{t("nothingOpen")}</span>}
                      </span>
                    </li>
                  );
                })}
                {!p.project_members.length && <li className="text-sm text-muted">{t("noPeople")}</li>}
              </ul>
              {last && <p className="mt-3 border-t border-line pt-2.5 text-xs text-muted">{t("lastUpdate", { who: person.get(last.created_by ?? "")?.full_name ?? "—", when: timeAgo(last.created_at, locale) })}: <span className="text-ink">{last.body.slice(0, 140)}</span></p>}
            </section>
          );
        })}
      </div>
      {!projects?.length && <p className="panel p-8 text-center text-sm text-muted">{t("none")}</p>}
    </div>
  );
}
