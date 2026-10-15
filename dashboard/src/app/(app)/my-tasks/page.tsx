import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Calendar, CheckCircle2, CheckSquare } from "lucide-react";
import { PageHero } from "@/components/shell/page-hero";
import { ProgressRing } from "@/components/shell/hero-visuals";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { LiveRefresh } from "@/components/live-refresh";
import { shortDate } from "@/lib/format";
import { MyTeamTasks } from "@/components/tools/team-tasks";
import { loadTeamTasks } from "@/lib/team-tasks";

type Row = {
  id: string; title: string; due_at: string | null; completed_at: string | null; labels: string[];
  boards: { slug: string; name: string; group_id: string | null } | null;
  board_lists: { name: string } | null;
};

export default async function MyTasksPage() {
  const t = await getTranslations("myTasks");
  const tg = await getTranslations("group.names");
  const tl = await getTranslations("board.lists");
  const listName = (n?: string) => {
    const key = ({ "to do": "todo", doing: "doing", review: "review", done: "done" } as Record<string, string>)[(n ?? "").toLowerCase()];
    return key ? tl(key) : n;
  };
  const locale = await getLocale();
  const { me, groups } = await getSession();
  const supabase = await createClient();
  const { data } = await supabase
    .from("cards")
    .select("id, title, due_at, completed_at, labels, boards(slug, name, group_id), board_lists(name), card_assignees!inner(user_id)")
    .eq("card_assignees.user_id", me.id)
    .returns<Row[]>();

  const teamTasks = await loadTeamTasks(me.id);
  const now = Date.now();
  const rows = data ?? [];
  const open = rows.filter((r) => !r.completed_at);
  const sections = [
    { key: "overdue", items: open.filter((r) => r.due_at && Date.parse(r.due_at) < now) },
    { key: "upcoming", items: open.filter((r) => r.due_at && Date.parse(r.due_at) >= now) },
    { key: "noDate", items: open.filter((r) => !r.due_at) },
    { key: "done", items: rows.filter((r) => r.completed_at) },
  ] as const;
  const byDue = (a: Row, b: Row) => Date.parse(a.due_at ?? "9999") - Date.parse(b.due_at ?? "9999");
  const th = await getTranslations("hero");
  const nextDue = [...sections[1].items].sort(byDue)[0];
  const doneWeek = rows.filter((r) => r.completed_at && Date.parse(r.completed_at) >= now - 7 * 864e5).length;

  return (
    <div className="space-y-6">
      <LiveRefresh tables={["cards", "card_assignees", "team_tasks", "team_task_people"]} />
      <PageHero
        section={{ label: t("title"), icon: <CheckSquare size={16} /> }}
        title={th("tasks.title", { name: me.full_name.split(" ")[0] })}
        subtitle={th("tasks.subtitle")}
        lines={[
          ...(sections[0].items.length ? [{ text: th("tasks.late", { count: sections[0].items.length }), tone: "bad" as const }] : []),
          ...(nextDue ? [{ text: th("tasks.next", { title: nextDue.title, date: shortDate(nextDue.due_at!, locale) }), tone: "info" as const }] : []),
          ...(!open.length ? [{ text: th("tasks.clear"), tone: "ok" as const }] : []),
        ]}
        stats={[
          { label: t("sections.overdue"), value: sections[0].items.length, kind: "num" },
          { label: t("sections.upcoming"), value: sections[1].items.length, kind: "num" },
          { label: th("tasks.doneWeek"), value: doneWeek, kind: "num" },
        ]}
        actions={[{ label: th("tasks.board"), href: "/board", primary: true }, { label: th("tasks.camp"), href: "/camp" }]}
        visual={<ProgressRing value={sections[3].items.length} max={rows.length} label={th("tasks.ring")} />}
      />
      <MyTeamTasks tasks={teamTasks} meId={me.id} />
      {!rows.length && !teamTasks.length && (
        <Card className="text-center text-sm text-muted">{t("empty")}</Card>
      )}
      {sections.map(({ key, items }) => items.length > 0 && (
        <section key={key} className={key === "done" ? "opacity-90" : ""}>
          <h2 className={`mb-2 text-sm font-semibold ${key === "overdue" ? "text-bad-text" : ""}`}>
            {t(`sections.${key}`)} <span className="text-muted tabular-nums">· {items.length}</span>
          </h2>
          <Card className="p-0">
            <ul className="divide-y divide-line">
              {[...items].sort(byDue).map((r) => {
                const g = groups.find((x) => x.id === r.boards?.group_id);
                const href = r.boards?.group_id && g ? `/g/${g.slug}?card=${r.id}` : `/board?card=${r.id}`;
                return (
                  <li key={r.id}>
                    <Link href={href} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2/60">
                      {key === "done" ? <CheckCircle2 size={16} className="shrink-0 text-ok-text" /> :
                        <span className="size-4 shrink-0 rounded-full border-2 border-line" aria-hidden />}
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm ${key === "done" ? "text-muted line-through" : ""}`}>{r.title}</p>
                        <p className="text-xs text-muted">{g ? tg(g.slug) : t("general")} · {listName(r.board_lists?.name)}</p>
                      </div>
                      {r.due_at && (
                        <span className={`inline-flex shrink-0 items-center gap-1 text-xs ${key === "overdue" ? "font-medium text-bad-text" : "text-muted"}`}>
                          <Calendar size={12} /> {shortDate(r.due_at, locale)}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      ))}
    </div>
  );
}
