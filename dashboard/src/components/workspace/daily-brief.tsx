"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, CalendarDays, Dumbbell } from "lucide-react";
import { Modal } from "@/components/data-table";
import { Avatar } from "@/components/ui";
import { dueLabel } from "@/lib/task-popup";
import { shouldShowBrief } from "@/lib/daily-brief";

type Item = { id: string; title: string; due: string; href: string };
type Person = { id: string; name: string; avatar: string | null };
type Brief = { today: string; late: Item[]; upcoming: Item[]; training: { thisWeek: Person[]; nextWeek: Person[] }; me: string };

const KEY = "emet.brief.shown";
const SHOW = 8;

/** The first time someone opens emet each day: a pop-up in the middle of the screen with their tasks
 *  (late + the next month) and who leads training this week and next. */
export function DailyBrief() {
  const t = useTranslations("brief");
  const locale = useLocale();
  const [brief, setBrief] = useState<Brief | null>(null);

  useEffect(() => {
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
    let last: string | null = null;
    try { last = localStorage.getItem(KEY); } catch { /* storage blocked: show it */ }
    if (!shouldShowBrief(last, today)) return;
    let live = true;
    fetch("/api/brief").then((r) => (r.ok ? r.json() : null)).then((b: Brief | null) => {
      if (!live || !b) return;
      const any = b.late.length + b.upcoming.length + b.training.thisWeek.length + b.training.nextWeek.length > 0;
      try { localStorage.setItem(KEY, b.today); } catch { /* fine */ }
      if (any) setBrief(b);
    }).catch(() => {});
    return () => { live = false; };
  }, []);

  if (!brief) return null;
  const close = () => setBrief(null);
  const iLead = brief.training.thisWeek.some((p) => p.id === brief.me);
  const items = [...brief.late.map((x) => ({ ...x, late: true })), ...brief.upcoming.map((x) => ({ ...x, late: false }))];
  const names = (ps: Person[]) => ps.map((p) => p.name.split(" ")[0]).join(" & ");

  return (
    <Modal title={t("title")} onClose={close} wide>
      <div className="space-y-5">
        {(brief.training.thisWeek.length > 0 || brief.training.nextWeek.length > 0) && (
          <section className={`rounded-2xl p-4 ring-1 ${iLead ? "bg-brand/15 ring-brand/50" : "bg-surface-2 ring-line"}`}>
            <p className="flex items-center gap-2 text-sm font-semibold"><Dumbbell size={16} /> {iLead ? t("youLead") : t("training")}</p>
            {brief.training.thisWeek.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted">{t("thisWeek")}</span>
                {brief.training.thisWeek.map((p) => (
                  <span key={p.id} className="flex items-center gap-1.5 rounded-full bg-surface py-0.5 pr-2.5 pl-0.5 font-medium"><Avatar name={p.name} src={p.avatar} size={22} />{p.name}</span>
                ))}
              </div>
            )}
            {brief.training.nextWeek.length > 0 && <p className="mt-2 text-sm text-muted">{t("nextWeek", { names: names(brief.training.nextWeek) })}</p>}
          </section>
        )}

        <section>
          <p className="text-sm font-semibold">{t("tasks")} <span className="font-normal text-muted">· {t("window")}</span></p>
          {items.length ? (
            <ul className="mt-2 divide-y divide-line">
              {items.slice(0, SHOW).map((x) => (
                <li key={x.id}>
                  <Link href={x.href} onClick={close} className="flex items-center gap-3 py-2.5 hover:text-link">
                    <span className={`grid size-8 shrink-0 place-items-center rounded-full ${x.late ? "bg-bad/15 text-bad-text" : "bg-surface-2 text-muted"}`}>
                      {x.late ? <AlertTriangle size={14} /> : <CalendarDays size={14} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{x.title}</span>
                    <span className={`shrink-0 text-xs ${x.late ? "font-semibold text-bad-text" : "text-muted"}`}>{x.late ? t("late") : dueLabel(x.due, locale)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-muted">{t("noTasks")}</p>}
          {items.length > SHOW && <p className="mt-1 text-xs text-muted">{t("more", { count: items.length - SHOW })}</p>}
        </section>

        <div className="flex flex-wrap justify-end gap-2">
          <Link href="/my-tasks" onClick={close} className="glass-pill min-h-11 px-4.5 text-sm font-medium">{t("openTasks")}</Link>
          <button type="button" onClick={close} className="min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-white">{t("gotIt")}</button>
        </div>
      </div>
    </Modal>
  );
}
