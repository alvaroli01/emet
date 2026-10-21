"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, Pencil, Trash2, Users } from "lucide-react";
import { Board, type Viewer } from "@/components/board/board";
import { Avatar } from "@/components/ui";
import { useToast } from "@/components/toast";
import { createClient } from "@/lib/supabase/client";
import { eur, shortDate, timeAgo } from "@/lib/format";
import { daysLeft, progress } from "@/lib/projects";
import type { BoardData, Member } from "@/lib/boards";
import { ProjectForm } from "./project-form";
import { ProjectLinks, LinkIcon } from "./project-links";
import { ProjectUpdates } from "./project-updates";
import { ProjectFiles } from "./project-files";
import { ProjectMoney } from "./project-money";
import { ProjectIcon } from "./project-icon";
import { ProjectLeads, type ProjectLead } from "./project-leads";
import { AssignTasks, MyTeamTasks } from "@/components/tools/team-tasks";
import type { TeamTask } from "@/lib/team-tasks";

export type Project = { id: string; name: string; description: string | null; status: "planning" | "live" | "closed"; starts_on: string | null; ends_on: string | null; goal: number | null; color: string; icon_path?: string | null; icon_url?: string | null };
export type ProjectLink = { id: string; title: string; url: string; created_by: string | null; created_at: string };
export type ProjectUpdate = { id: string; body: string; created_by: string | null; created_at: string };
export type ProjectFile = { id: string; name: string; size: number; mime: string; path: string; uploaded_by: string | null; created_at: string };
export type Money = { revenue: number; costs: number; profit: number };

const TABS = ["overview", "money", "tasks", "leads", "links", "files", "updates"] as const;
type Tab = (typeof TABS)[number];
export const STATUS_STYLE = { planning: "bg-surface-2 text-muted", live: "bg-ok/20 text-ok-text", closed: "bg-line text-muted" } as const;

/** A project's page: header with goal and people, then Overview · Money · Tasks · Links · Files · Updates. */
export function ProjectPage({ project, memberIds, people, board, viewer, meId, isLeader, money, weeks, links, updates, files, tickTasks, leads, tab, today }: {
  project: Project; memberIds: string[]; people: Member[]; board: BoardData | null; viewer: Viewer; meId: string; isLeader: boolean;
  money: Money; weeks: { week: string; revenue: number }[]; links: ProjectLink[]; updates: ProjectUpdate[]; files: ProjectFile[];
  tickTasks: TeamTask[]; leads: ProjectLead[]; tab?: string; today: string;
}) {
  const t = useTranslations("projects");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [active, setActive] = useState<Tab>(TABS.includes(tab as Tab) ? (tab as Tab) : "overview");
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const name = new Map(people.map((p) => [p.id, p]));
  const members = memberIds.map((id) => name.get(id)).filter(Boolean) as Member[];
  const pct = progress(money.revenue, project.goal);
  const left = daysLeft(project.ends_on, today);

  function go(next: Tab) {
    setActive(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next); url.searchParams.delete("card");
    window.history.replaceState(null, "", url);
  }

  async function remove() {
    const supabase = createClient();
    if (files.length) await supabase.storage.from("projects").remove(files.map((f) => f.path));
    const { error } = await supabase.from("projects").delete().eq("id", project.id);
    if (error) { toast("error", t("error")); return; }
    router.push(`/team/${meId}#projects`);
  }

  return (
    <div className="fade-in space-y-4">
      {/* Header */}
      <section className="panel relative overflow-hidden p-5">
        <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ background: project.color }} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <ProjectIcon url={project.icon_url} color={project.color} name={project.name} size={44} />
              <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[project.status]}`}>{t(`status.${project.status}`)}</span>
            </div>
            {project.description && <p className="mt-1 max-w-2xl text-sm text-muted">{project.description}</p>}
            <p className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
              {(project.starts_on || project.ends_on) && (
                <span className="flex items-center gap-1"><CalendarDays size={13} />
                  {[project.starts_on && shortDate(project.starts_on, locale), project.ends_on && shortDate(project.ends_on, locale)].filter(Boolean).join(" → ")}
                </span>
              )}
              {left !== null && project.status !== "closed" && (
                <span className={left < 0 ? "text-bad-text" : ""}>{left < 0 ? t("overdue", { n: -left }) : t("daysLeft", { n: left })}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2" title={members.map((m) => m.full_name).join(", ")}>
              {members.slice(0, 6).map((m) => <span key={m.id} className="rounded-full ring-2 ring-solid"><Avatar name={m.full_name} src={m.avatar_url} size={30} /></span>)}
              {members.length > 6 && <span className="grid size-[30px] place-items-center rounded-full bg-surface-2 text-xs ring-2 ring-solid">+{members.length - 6}</span>}
            </div>
            {isLeader && (<>
              <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-line"><Pencil size={14} /> {t("edit")}</button>
              <button onClick={() => setConfirmDelete(true)} aria-label={t("delete")} title={t("delete")} className="grid size-9 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-bad-text"><Trash2 size={15} /></button>
            </>)}
          </div>
        </div>
        {pct !== null && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs"><span className="text-muted">{t("goal")}</span>
              <span className="font-semibold">{t("goalOf", { done: eur(money.revenue, locale), goal: eur(project.goal!, locale) })} · {Math.round(pct * 100)}%</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full" style={{ width: `${Math.max(pct * 100, 1)}%`, background: project.color }} /></div>
          </div>
        )}
        {confirmDelete && (
          <div role="alertdialog" className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-bad/10 p-3 text-sm ring-1 ring-bad/40">
            <span className="flex-1">{t("confirmDelete", { name: project.name })}</span>
            <button onClick={() => setConfirmDelete(false)} className="rounded-lg px-3 py-1.5 hover:bg-surface-2">{t("cancel")}</button>
            <button onClick={remove} className="rounded-lg bg-bad px-3 py-1.5 font-medium text-white">{t("delete")}</button>
          </div>
        )}
      </section>

      {/* Tabs */}
      <div role="tablist" className="-mx-3 flex gap-1 overflow-x-auto px-3 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {TABS.map((k) => (
          <button key={k} role="tab" aria-selected={active === k} onClick={() => go(k)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${active === k ? "bg-brand text-brand-contrast" : "glass-pill text-white"}`}>
            {t(`tabs.${k}`)}
          </button>
        ))}
      </div>

      {active === "overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ProjectMoney money={money} weeks={[]} compact />
          <section className="panel p-5">
            <h2 className="mb-3 font-semibold">{t("tabs.updates")}</h2>
            {updates.length ? (
              <ul className="space-y-3">{updates.slice(0, 5).map((u) => (
                <li key={u.id} className="text-sm"><p className="whitespace-pre-wrap">{u.body}</p>
                  <p className="mt-0.5 text-xs text-muted">{name.get(u.created_by ?? "")?.full_name ?? "—"} · {timeAgo(u.created_at, locale)}</p></li>
              ))}</ul>
            ) : <p className="text-sm text-muted">{t("noUpdates")}</p>}
          </section>
          <section className="panel p-5">
            <h2 className="mb-3 font-semibold">{t("tabs.links")}</h2>
            {links.length ? (
              <ul className="space-y-1">{links.slice(0, 6).map((l) => (
                <li key={l.id}><a href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 rounded-xl p-2 text-sm hover:bg-surface-2"><LinkIcon url={l.url} /> <span className="truncate">{l.title}</span></a></li>
              ))}</ul>
            ) : <p className="text-sm text-muted">{t("noLinks")}</p>}
          </section>
          <section className="panel p-5">
            <h2 className="mb-3 flex items-center gap-2 font-semibold"><Users size={16} /> {t("people")}</h2>
            <ul className="space-y-2">{members.map((m) => (
              <li key={m.id} className="flex items-center gap-2.5 text-sm"><Avatar name={m.full_name} src={m.avatar_url} size={28} /> <span>{m.full_name}</span>
                {m.role_title && <span className="text-xs text-muted">· {m.role_title}</span>}</li>
            ))}{!members.length && <li className="text-sm text-muted">{t("noPeople")}</li>}</ul>
          </section>
        </div>
      )}
      {active === "money" && <ProjectMoney money={money} weeks={weeks} />}
      {active === "tasks" && (
        <div className="space-y-4">
          {/* Tick-off tasks, like "From the team leader" in My Tasks: leaders give them, each person ticks their own */}
          <MyTeamTasks tasks={tickTasks.filter((x) => x.people.some((p) => p.id === meId))} meId={meId} />
          {isLeader && <AssignTasks tasks={tickTasks} people={members.map((m) => ({ id: m.id, full_name: m.full_name, avatar_url: m.avatar_url, group_id: m.group_id }))} teams={[]} meId={meId} projectId={project.id} />}
          {board ? <div className="panel p-3 sm:p-4"><Board data={board} viewer={viewer} /></div> : <p className="panel p-5 text-sm text-muted">{t("noBoard")}</p>}
        </div>
      )}
      {active === "leads" && <ProjectLeads leads={leads} />}
      {active === "links" && <ProjectLinks projectId={project.id} links={links} people={name} meId={meId} isLeader={isLeader} />}
      {active === "files" && <ProjectFiles projectId={project.id} files={files} people={name} meId={meId} isLeader={isLeader} />}
      {active === "updates" && <ProjectUpdates projectId={project.id} updates={updates} people={name} meId={meId} isLeader={isLeader} />}

      {editing && <ProjectForm project={{ ...project, memberIds }} people={people} onClose={() => setEditing(false)} />}
    </div>
  );
}
