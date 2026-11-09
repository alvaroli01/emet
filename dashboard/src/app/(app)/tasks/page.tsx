import { getTranslations } from "next-intl/server";
import { ListChecks } from "lucide-react";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { loadMembers } from "@/lib/boards";
import { loadProjectPeople } from "@/lib/projects-server";
import { LiveRefresh } from "@/components/live-refresh";
import { PageHero } from "@/components/shell/page-hero";
import { ProgressRing } from "@/components/shell/hero-visuals";
import { TasksView, type Goal } from "@/components/tasks/tasks-view";
import { MyExtras } from "@/components/tasks/my-extras";
import { statusOf, isOverdue, type Task, type TaskBoard } from "@/lib/tasks";

type RawTask = Omit<Task, "people" | "checklist"> & {
  card_assignees: Task["people"]; card_checklist_items: Task["checklist"];
};

/** Every task in one place: EMET tasks (the general + team boards) and each project's tasks, with its goal. */
export default async function TasksPage({ searchParams }: { searchParams: Promise<{ view?: string; project?: string; task?: string; due?: string }> }) {
  const sp = await searchParams;
  const { me, groups, isAdmin, isLeader, canEditGroup } = await getSession();
  const supabase = await createClient();
  // Private "My board"s are personal and stay on My Tasks
  const { data: boardRows } = await supabase.from("boards").select("id, name, group_id, project_id, board_lists(id, name, position)").is("owner_id", null)
    .returns<(Omit<TaskBoard, "lists"> & { board_lists: { id: string; name: string; position: number }[] })[]>();
  const boards: TaskBoard[] = (boardRows ?? []).map(({ board_lists, ...b }) => ({ ...b, lists: [...board_lists].sort((x, y) => x.position - y.position) }));
  const [cards, people, projects, goals] = await Promise.all([
    boards.length
      ? supabase.from("cards").select("id, board_id, list_id, title, description, due_at, completed_at, priority, needs_file, created_by, created_at, card_assignees(user_id, done_at, file_path, file_name), card_checklist_items(id, text, done, position)")
          .in("board_id", boards.map((b) => b.id)).order("created_at", { ascending: false }).limit(1000).returns<RawTask[]>()
      : Promise.resolve({ data: [] as RawTask[] }),
    loadMembers(),
    loadProjectPeople(supabase),
    supabase.from("project_goals").select("project_id, statement, target_on, milestones").returns<Goal[]>(),
  ]);
  const tasks: Task[] = (cards.data ?? []).map(({ card_assignees, card_checklist_items, ...c }) => ({
    ...c, people: card_assignees, checklist: [...card_checklist_items].sort((a, b) => a.position - b.position),
  }));
  // Only projects that have a board here (a project you can see)
  const shown = projects.filter((p) => boards.some((b) => b.project_id === p.id));

  const t = await getTranslations("taskHub");
  const listName = new Map(boards.flatMap((b) => b.lists.map((l) => [l.id, l.name] as const)));
  const st = (x: Task) => statusOf(listName.get(x.list_id));
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
        tasks={tasks} boards={boards} people={people} projects={shown} goals={goals.data ?? []}
        groups={groups.map((g) => ({ id: g.id, slug: g.slug }))}
        viewer={{ meId: me.id, myGroupId: me.group_id, isLeader, isAdmin, isCoach: !!me.is_coach, isGuest: !!me.is_guest,
                  editGroups: groups.filter((g) => canEditGroup(g.id)).map((g) => g.id) }}
        mine={<MyExtras />}
        initial={{ view: sp.view === "mine" || sp.view === "emet" || sp.view === "project" ? sp.view : "all", project: sp.project ?? null, task: sp.task ?? null, overdue: sp.due === "overdue" }}
      />
    </div>
  );
}
