"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { FolderKanban, Plus, Users } from "lucide-react";
import { eur } from "@/lib/format";
import { daysLeft, progress } from "@/lib/projects";
import type { Member } from "@/lib/boards";
import { ProjectForm } from "./project-form";
import { STATUS_STYLE, type Project } from "./project-page";

export type ProjectCard = Project & { members: number; revenue: number };

/** Own profile: the projects I'm in (leaders see all of them and can start a new one). */
export function MyProjects({ projects, canCreate = false, people = [], today, title }: { projects: ProjectCard[]; canCreate?: boolean; people?: Member[]; today: string; title?: string }) {
  const t = useTranslations("projects");
  const locale = useLocale();
  const [creating, setCreating] = useState(false);
  return (
    <section id="projects" className="panel scroll-mt-24 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><FolderKanban size={18} /> {title ?? t("mine")}</h2>
        {canCreate && <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-sm font-medium text-brand-contrast"><Plus size={15} /> {t("new")}</button>}
      </div>
      {projects.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => {
            const pct = progress(p.revenue, p.goal), left = daysLeft(p.ends_on, today);
            return (
              <Link key={p.id} href={`/projects/${p.id}`} className="group relative overflow-hidden rounded-2xl bg-surface-2/50 p-4 ring-1 ring-line transition hover:ring-brand/50">
                <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: p.color }} />
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold group-hover:text-link">{p.name}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[p.status]}`}>{t(`status.${p.status}`)}</span>
                </div>
                {p.description && <p className="mt-1 line-clamp-2 text-xs text-muted">{p.description}</p>}
                {pct !== null && (
                  <div className="mt-3">
                    <div className="h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full" style={{ width: `${Math.max(pct * 100, 2)}%`, background: p.color }} /></div>
                    <p className="mt-1 text-[11px] text-muted">{t("goalOf", { done: eur(p.revenue, locale), goal: eur(p.goal!, locale) })}</p>
                  </div>
                )}
                <p className="mt-3 flex items-center gap-3 text-xs text-muted">
                  <span className="flex items-center gap-1"><Users size={12} /> {p.members}</span>
                  {left !== null && p.status !== "closed" && <span className={left < 0 ? "text-bad-text" : ""}>{left < 0 ? t("overdue", { n: -left }) : t("daysLeft", { n: left })}</span>}
                </p>
              </Link>
            );
          })}
        </div>
      ) : <p className="rounded-2xl bg-surface-2/40 p-6 text-center text-sm text-muted">{canCreate ? t("emptyLeader") : t("empty")}</p>}
      {creating && <ProjectForm people={people} onClose={() => setCreating(false)} />}
    </section>
  );
}
