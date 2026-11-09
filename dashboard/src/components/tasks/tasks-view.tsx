"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Calendar, Check, CheckSquare, Flag, Plus, Target, Pencil, X, Paperclip, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { TaskDialog } from "./task-dialog";
import {
  statusOf, isOverdue, filterTasks, sortTasks, canAdd, NO_FILTERS, STATUSES, PRIORITIES,
  type Task, type TaskBoard, type Viewer, type ProjectInfo, type Status, type Filters,
} from "@/lib/tasks";

export type Person = { id: string; full_name: string; avatar_url: string | null; group_id: string | null };
export type Goal = { project_id: string; statement: string; target_on: string | null; milestones: { text: string; done: boolean }[] };
type View = "all" | "mine" | "emet" | "project";

const dayLabel = (iso: string, locale: string) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "Europe/Madrid" });

export const STATUS_STYLE: Record<Status, string> = {
  todo: "bg-surface-2 text-muted", doing: "bg-brand/15 text-ink", blocked: "bg-warn/20 text-warn-text", done: "bg-ok/15 text-ok-text",
};
export const PRIORITY_STYLE = { high: "text-bad-text", medium: "text-muted", low: "text-muted/60" } as const;

export function TasksView({ tasks, boards, people, projects, goals, goalProgress, groups, viewer, initial, mine }: {
  tasks: Task[]; boards: TaskBoard[]; people: Person[]; projects: ProjectInfo[]; goals: Goal[];
  /** Per project: done / all of its tasks (also the ones not given to me) */
  goalProgress: Record<string, { done: number; total: number }>;
  groups: { id: string; slug: string }[]; viewer: Viewer; initial: { view: View; project: string | null; task: string | null; overdue?: boolean };
  /** Shown under "My tasks": my private board and Notion deadlines (rendered on the server) */
  mine?: React.ReactNode;
}) {
  const t = useTranslations("taskHub");
  const tg = useTranslations("group.names");
  const tn = useTranslations("nav");
  const locale = useLocale();
  const [view, setView] = useState<View>(initial.view === "project" && !projects.length ? "all" : initial.view);
  const [projectId, setProjectId] = useState<string | null>(projects.find((p) => p.id === initial.project)?.id ?? projects[0]?.id ?? null);
  const [filters, setFilters] = useState<Filters>(initial.overdue ? { ...NO_FILTERS, due: "overdue" } : NO_FILTERS);
  // open = a task id; "new" = the create form
  const [open, setOpen] = useState<string | null>(tasks.some((x) => x.id === initial.task) ? initial.task : null);
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  // My ticks from the list show at once; each is dropped as soon as the server's copy of my row changes
  const [ticks, setTicks] = useState<Record<string, { base: string | null; value: string | null }>>({});
  const live = useMemo(() => tasks.map((x) => {
    const k = ticks[x.id];
    return k ? { ...x, people: x.people.map((p) => (p.user_id === viewer.meId && p.done_at === k.base ? { ...p, done_at: k.value } : p)) } : x;
  }), [tasks, ticks, viewer.meId]);
  async function tick(x: Task, on: boolean) {
    const base = tasks.find((y) => y.id === x.id)?.people.find((p) => p.user_id === viewer.meId)?.done_at ?? null;
    const value = on ? new Date().toISOString() : null;
    setTicks((m) => ({ ...m, [x.id]: { base, value } }));
    const { error } = await supabase.from("card_assignees").update({ done_at: value }).eq("card_id", x.id).eq("user_id", viewer.meId);
    if (error) {
      setTicks((m) => { const n = { ...m }; delete n[x.id]; return n; });
      return toast("error", error.message?.startsWith("emet:") ? error.message.slice(6) : t("saveError"));
    }
    router.refresh();
  }

  const boardById = useMemo(() => new Map(boards.map((b) => [b.id, b])), [boards]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const names = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const listName = useMemo(() => new Map(boards.flatMap((b) => b.lists.map((l) => [l.id, l.name] as const))), [boards]);
  const st = (x: Task) => statusOf(listName.get(x.list_id));
  const general = boards.find((b) => !b.project_id && !b.group_id);
  const projectBoard = boards.find((b) => b.project_id === projectId);

  // Keep the address in step so a link (or a reload) lands on the same view
  // fetch = also reload the page data (a task that was just created isn't in it yet)
  function go(next: { view?: View; project?: string | null; task?: string | null }, fetch = false) {
    const v = next.view ?? view, p = next.project !== undefined ? next.project : projectId, k = next.task !== undefined ? next.task : open;
    if (next.view) setView(next.view);
    if (next.project !== undefined) setProjectId(next.project);
    if (next.task !== undefined) setOpen(next.task);
    const q = new URLSearchParams();
    if (v !== "all") q.set("view", v);
    if (v === "project" && p) q.set("project", p);
    if (k && k !== "new") q.set("task", k);
    const url = `/tasks${q.size ? `?${q}` : ""}`;
    if (fetch) router.replace(url, { scroll: false });
    else window.history.replaceState(null, "", url);
  }

  const inView = live.filter((x) => {
    const b = boardById.get(x.board_id);
    if (view === "mine") return x.people.some((p) => p.user_id === viewer.meId);
    if (view === "emet") return !b?.project_id;
    if (view === "project") return b?.project_id === projectId;
    return true;
  });
  const shown = sortTasks(filterTasks(inView, boardById, st, filters), st);
  // Where "New task" puts it
  const newBoard = view === "project" ? projectBoard : general;
  const mayAdd = !!newBoard && canAdd(viewer, newBoard, newBoard.project_id ? projectById.get(newBoard.project_id) : undefined);
  const peopleInView = view === "project" && projectId ? people.filter((p) => projectById.get(projectId)?.memberIds.includes(p.id)) : people;
  const where = (b?: TaskBoard) => b?.project_id ? projectById.get(b.project_id)?.name ?? b.name
    : b?.group_id ? tg(groups.find((g) => g.id === b.group_id)?.slug ?? "") : "EMET";

  const tabs: { id: View; label: string }[] = [
    { id: "all", label: t("tabAll") }, { id: "mine", label: tn("myTasks") }, { id: "emet", label: t("tabEmet") },
    ...(projects.length ? [{ id: "project" as const, label: t("tabProjects") }] : []),
  ];
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const active = Object.values(filters).some(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label={t("title")} className="flex rounded-full bg-surface-2 p-1 ring-1 ring-line">
          {tabs.map((x) => (
            <button key={x.id} role="tab" aria-selected={view === x.id} onClick={() => { go({ view: x.id }); if (x.id !== "all" && x.id !== "mine") set("project", ""); if (x.id === "mine") set("person", ""); }}
                    className={`min-h-9 rounded-full px-4 text-sm font-semibold transition ${view === x.id ? "bg-solid shadow-sm ring-1 ring-line" : "text-muted hover:text-ink"}`}>
              {x.label}
            </button>
          ))}
        </div>
        {view === "project" && (
          <select value={projectId ?? ""} onChange={(e) => go({ project: e.target.value })} aria-label={t("pickProject")} className="input min-h-10 w-auto">
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        {mayAdd && (
          <button onClick={() => setOpen("new")} className="ml-auto flex min-h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-semibold text-white">
            <Plus size={16} /> {t("newTask")}
          </button>
        )}
      </div>

      {view === "project" && projectId && (
        <GoalCard key={projectId} projectId={projectId} goal={goals.find((g) => g.project_id === projectId)}
                  progress={goalProgress[projectId] ?? { done: 0, total: 0 }} locale={locale}
                  canEdit={viewer.isLeader || !!projectById.get(projectId)?.memberIds.includes(viewer.meId)} />
      )}

      <div className="flex flex-wrap items-center gap-2" aria-label={t("filters")}>
        {view !== "mine" && <select value={filters.person} onChange={(e) => set("person", e.target.value)} aria-label={t("fPerson")} className="input min-h-9 w-auto py-1 text-sm">
          <option value="">{t("fAnyone")}</option>
          <option value={viewer.meId}>{t("fMe")}</option>
          {peopleInView.filter((p) => p.id !== viewer.meId).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>}
        {(view === "all" || view === "mine") && (
          <select value={filters.project} onChange={(e) => set("project", e.target.value)} aria-label={t("fProject")} className="input min-h-9 w-auto py-1 text-sm">
            <option value="">{t("fEverywhere")}</option>
            <option value="emet">EMET</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <select value={filters.status} onChange={(e) => set("status", e.target.value as Filters["status"])} aria-label={t("fStatus")} className="input min-h-9 w-auto py-1 text-sm">
          <option value="">{t("fAnyStatus")}</option>
          <option value="open">{t("fOpen")}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
        </select>
        <select value={filters.priority} onChange={(e) => set("priority", e.target.value as Filters["priority"])} aria-label={t("fPriority")} className="input min-h-9 w-auto py-1 text-sm">
          <option value="">{t("fAnyPriority")}</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}
        </select>
        <select value={filters.due} onChange={(e) => set("due", e.target.value as Filters["due"])} aria-label={t("fDue")} className="input min-h-9 w-auto py-1 text-sm">
          <option value="">{t("fAnyDue")}</option>
          <option value="overdue">{t("fOverdue")}</option>
          <option value="week">{t("fWeek")}</option>
          <option value="none">{t("fNoDate")}</option>
        </select>
        {active && <button onClick={() => setFilters(NO_FILTERS)} className="min-h-9 px-2 text-sm text-muted underline">{t("fClear")}</button>}
        <span className="ml-auto text-xs text-muted tabular-nums">{t("count", { count: shown.length })}</span>
      </div>

      <ul className="panel divide-y divide-line">
        {shown.map((x) => {
          const s = st(x), late = isOverdue(x, s), b = boardById.get(x.board_id);
          const me = x.people.find((p) => p.user_id === viewer.meId);
          const done = x.people.filter((p) => p.done_at).length, items = x.checklist.filter((i) => i.done).length;
          return (
            <li key={x.id} className={`flex items-stretch ${late ? "bg-bad/5 shadow-[inset_3px_0_0_var(--color-bad)]" : ""}`}>
              {me && (
                // My part: tick it off right here (a task that needs a file opens so I can upload it)
                <button onClick={() => (x.needs_file && !me.done_at ? go({ task: x.id }) : tick(x, !me.done_at))} role="checkbox" aria-checked={!!me.done_at}
                        aria-label={me.done_at ? t("untickMine", { title: x.title }) : t("tickMine", { title: x.title })} title={x.needs_file && !me.done_at ? t("uploadToFinish") : undefined}
                        className="grid shrink-0 place-items-center pl-4">
                  <span className={`grid size-6 place-items-center rounded-lg ring-2 transition-colors duration-150 ${me.done_at ? "bg-ok text-[#06281a] ring-ok" : x.needs_file ? "text-brand ring-brand/60 hover:ring-brand" : "ring-line hover:ring-brand"}`}>
                    {me.done_at ? <Check size={14} strokeWidth={3} /> : x.needs_file ? <Paperclip size={12} /> : null}
                  </span>
                </button>
              )}
              <button onClick={() => go({ task: x.id })} aria-label={t("openTask", { title: x.title })}
                      className={`flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5 py-3 pr-4 text-left transition hover:bg-surface-2/60 sm:flex-nowrap ${me ? "pl-3" : "pl-4"}`}>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[s]}`}>{t(`status.${s}`)}</span>
                <span className="min-w-0 flex-1 basis-48">
                  <span className={`block truncate font-medium ${s === "done" ? "text-muted line-through" : ""}`}>{x.title}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                    {view !== "project" && <span className="rounded-full bg-surface-2 px-2 py-px text-[11px] font-medium">{where(b)}</span>}
                    {x.due_at && <span className={`flex items-center gap-1 ${late ? "font-semibold text-bad-text" : ""}`}><Calendar size={12} /> {late ? t("lateOn", { date: dayLabel(x.due_at, locale) }) : dayLabel(x.due_at, locale)}</span>}
                    {x.checklist.length > 0 && <span className="flex items-center gap-1 tabular-nums"><CheckSquare size={12} /> {items}/{x.checklist.length}</span>}
                    {x.needs_file && <span className="flex items-center gap-1"><Paperclip size={12} /> {t("fileNeeded")}</span>}
                  </span>
                </span>
                {x.priority !== "medium" && <span className={`flex shrink-0 items-center gap-1 text-xs font-medium ${PRIORITY_STYLE[x.priority]}`}><Flag size={12} /> {t(`priority.${x.priority}`)}</span>}
                {x.people.length > 0 && (
                  // Who finished, as one calm chip (names on hover; the full list is inside the task)
                  <span title={x.people.map((p) => `${names.get(p.user_id)?.full_name ?? "?"}: ${p.done_at ? t("finished") : t("notYet")}`).join("\n")}
                        className={`flex w-24 shrink-0 items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${done === x.people.length ? "bg-ok/15 text-ok-text" : "bg-surface-2 text-muted"}`}>
                    {done === x.people.length ? <Check size={12} strokeWidth={3} /> : <Users size={12} />}
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-line"><span className="block h-full rounded-full bg-ok" style={{ width: `${(done / x.people.length) * 100}%` }} /></span>
                    {done}/{x.people.length}
                  </span>
                )}
              </button>
            </li>
          );
        })}
        {!shown.length && <li className="px-4 py-10 text-center text-sm text-muted">{active ? t("noneFiltered") : t("none")}</li>}
      </ul>

      {view === "mine" && mine}

      {open && (
        <TaskDialog
          taskId={open === "new" ? null : open} tasks={live} board={(open === "new" ? newBoard : boardById.get(tasks.find((x) => x.id === open)?.board_id ?? "") ?? newBoard)!}
          people={people} projects={projectById} viewer={viewer} where={where}
          onCreated={(id) => go({ task: id }, true)} onClose={() => go({ task: null })} />
      )}
    </div>
  );
}

/** The project's goal: statement, target date, progress (done / all tasks) and optional milestones. */
function GoalCard({ projectId, goal, progress: pr, locale, canEdit }: { projectId: string; goal?: Goal; progress: { done: number; total: number }; locale: string; canEdit: boolean }) {
  const t = useTranslations("taskHub");
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [editing, setEditing] = useState(false);
  const [statement, setStatement] = useState(goal?.statement ?? "");
  const [target, setTarget] = useState(goal?.target_on ?? "");
  const [milestones, setMilestones] = useState(goal?.milestones ?? []);
  const [newMilestone, setNewMilestone] = useState("");
  const pct = pr.total ? Math.round((pr.done / pr.total) * 100) : 0;

  async function save(patch: Partial<Omit<Goal, "project_id">>) {
    const row = { project_id: projectId, statement, target_on: target || null, milestones, ...patch };
    const { error } = await supabase.from("project_goals").upsert(row);
    if (error) { toast("error", t("saveError")); return false; }
    router.refresh();
    return true;
  }
  const toggle = (i: number) => { if (!canEdit) return; const m = milestones.map((x, j) => (j === i ? { ...x, done: !x.done } : x)); setMilestones(m); save({ milestones: m }); };
  const remove = (i: number) => { const m = milestones.filter((_, j) => j !== i); setMilestones(m); save({ milestones: m }); };
  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!newMilestone.trim()) return;
    const m = [...milestones, { text: newMilestone.trim().slice(0, 120), done: false }];
    setMilestones(m); setNewMilestone(""); save({ milestones: m });
  }

  return (
    <section className="panel p-5" aria-label={t("goal")}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand/15 text-brand"><Target size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">{t("goal")}</p>
          {editing ? (
            <form onSubmit={async (e) => { e.preventDefault(); if (await save({})) setEditing(false); }} className="mt-1.5 space-y-2">
              <input value={statement} onChange={(e) => setStatement(e.target.value)} maxLength={300} placeholder={t("goalPlaceholder")} aria-label={t("goalStatement")} className="input" autoFocus />
              <label className="block w-fit text-sm">{t("targetDate")}
                <input type="date" value={target} onChange={(e) => setTarget(e.target.value)} className="input mt-1" />
              </label>
              <div className="flex gap-2">
                <button className="min-h-9 rounded-full bg-brand px-4 text-sm font-semibold text-white">{t("save")}</button>
                <button type="button" onClick={() => { setEditing(false); setStatement(goal?.statement ?? ""); setTarget(goal?.target_on ?? ""); }} className="min-h-9 px-3 text-sm text-muted">{t("cancel")}</button>
              </div>
            </form>
          ) : (
            <>
              <p className="mt-0.5 text-lg font-semibold">{goal?.statement || <span className="text-muted">{canEdit ? t("noGoalYet") : t("noGoal")}</span>}</p>
              {goal?.target_on && <p className="mt-0.5 flex items-center gap-1 text-sm text-muted"><Calendar size={13} /> {t("by", { date: new Date(goal.target_on + "T12:00:00Z").toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) })}</p>}
            </>
          )}
        </div>
        {canEdit && !editing && <button onClick={() => setEditing(true)} aria-label={t("editGoal")} className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2"><Pencil size={15} /></button>}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-muted"><span>{t("progress")}</span><span className="tabular-nums">{t("progressCount", { done: pr.done, total: pr.total })} · {pct}%</span></div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t("progress")}>
          <div className="h-full rounded-full bg-ok transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {(milestones.length > 0 || canEdit) && (
        <div className="mt-4">
          <p className="text-sm font-semibold">{t("milestones")}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {milestones.map((m, i) => (
              <li key={i} className={`flex items-center gap-1.5 rounded-full py-1 pr-1.5 pl-1 text-sm ring-1 ${m.done ? "bg-ok/15 text-ok-text ring-ok/30" : "bg-surface-2 ring-line"}`}>
                <button onClick={() => toggle(i)} disabled={!canEdit} role="checkbox" aria-checked={m.done} aria-label={m.text}
                        className={`grid size-6 place-items-center rounded-full ${m.done ? "bg-ok text-[#06281a]" : "ring-2 ring-line"}`}>{m.done && <Check size={13} strokeWidth={3} />}</button>
                <span className={m.done ? "line-through" : ""}>{m.text}</span>
                {canEdit && <button onClick={() => remove(i)} aria-label={t("removeMilestone", { text: m.text })} className="grid size-6 place-items-center rounded-full text-muted hover:text-bad-text"><X size={13} /></button>}
              </li>
            ))}
            {canEdit && milestones.length < 20 && (
              <li>
                <form onSubmit={add} className="flex items-center gap-1">
                  <input value={newMilestone} onChange={(e) => setNewMilestone(e.target.value)} maxLength={120} placeholder={t("addMilestone")} aria-label={t("addMilestone")} className="input min-h-8 w-44 py-1 text-sm" />
                  {newMilestone.trim() && <button className="grid size-8 place-items-center rounded-full bg-brand text-white" aria-label={t("addMilestone")}><Plus size={14} /></button>}
                </form>
              </li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}
