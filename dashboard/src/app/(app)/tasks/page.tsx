import { getTranslations } from "next-intl/server";
import { ListChecks } from "lucide-react";
import { getSession } from "@/lib/session";
import { LiveRefresh } from "@/components/live-refresh";
import { PageHero } from "@/components/shell/page-hero";
import { ProgressRing } from "@/components/shell/hero-visuals";
import { TasksView } from "@/components/tasks/tasks-view";
import { MyExtras } from "@/components/tasks/my-extras";
import { isOverdue } from "@/lib/tasks";
import { loadTaskHub } from "@/lib/task-hub";

/** Every task in one place: EMET tasks (the general + team boards) and each project's tasks, with its goal. */
export default async function TasksPage({ searchParams }: { searchParams: Promise<{ view?: string; project?: string; task?: string; due?: string }> }) {
  const sp = await searchParams;
  const { me, groups, isAdmin, isLeader, canEditGroup } = await getSession();
  const { tasks, boards, people, projects: shown, goals, goalProgress, st } = await loadTaskHub(me.id);

  const t = await getTranslations("taskHub");
  const open = tasks.filter((x) => st(x) !== "done");
  const late = open.filter((x) => isOverdue(x, "todo")).length;
  const mine = open.filter((x) => x.people.some((p) => p.user_id === me.id && !p.done_at)).length;

  return (
    <div className="space-y-6">
      <LiveRefresh tables={["cards", "card_assignees", "card_checklist_items", "board_lists", "project_goals"]} />
      <PageHero
        section={{ label: t("title"), icon: <ListChecks size={16} /> }}
        title={t("heroTitle")}
        subtitle={t("heroSubtitle")}
        lines={[
          ...(late ? [{ text: t("heroLate", { count: late }), tone: "bad" as const }] : []),
          ...(mine ? [{ text: t("heroMine", { count: mine }), tone: "info" as const }] : [{ text: t("heroClear"), tone: "ok" as const }]),
        ]}
        stats={[
          { label: t("statOpen"), value: open.length, kind: "num" },
          { label: t("statDone"), value: tasks.length - open.length, kind: "num" },
        ]}
        visual={<ProgressRing value={tasks.length - open.length} max={tasks.length} label={t("ring")} />}
      />
      <TasksView
        tasks={tasks} boards={boards} people={people} projects={shown} goals={goals} goalProgress={goalProgress}
        groups={groups.map((g) => ({ id: g.id, slug: g.slug }))}
        viewer={{ meId: me.id, myGroupId: me.group_id, isLeader, isAdmin, isCoach: !!me.is_coach, isGuest: !!me.is_guest,
                  editGroups: groups.filter((g) => canEditGroup(g.id)).map((g) => g.id) }}
        mine={<MyExtras />}
        initial={{ view: sp.view === "mine" || sp.view === "emet" || sp.view === "project" ? sp.view : "all", project: sp.project ?? null, task: sp.task ?? null, overdue: sp.due === "overdue" }}
      />
    </div>
  );
}
