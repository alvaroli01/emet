"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { shortDate } from "@/lib/format";

export type WeekPlan = { week_start: string; priorities: string[]; went_well: string; to_improve: string; learned: string };
export type DueTask = { id: string; title: string; day: string; href: string; kind: "card" | "task"; parent?: string };

const EMPTY = (week: string): WeekPlan => ({ week_start: week, priorities: ["", "", ""], went_well: "", to_improve: "", learned: "" });

export function WeekTab({ week, plan, past, due, meId }: { week: string; plan: WeekPlan | null; past: WeekPlan[]; due: DueTask[]; meId: string }) {
  const t = useTranslations("camp.week");
  const locale = useLocale();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [p, setP] = useState<WeekPlan>(() => {
    const base = plan ?? EMPTY(week);
    return { ...base, priorities: [0, 1, 2].map((i) => base.priorities[i] ?? "") };
  });
  const [saved, setSaved] = useState<WeekPlan>(p);
  const weekEnd = new Date(Date.parse(week) + 7 * 864e5).toISOString().slice(0, 10);
  const thisWeek = due.filter((d) => d.day < weekEnd);
  const done = p.priorities.filter((x) => x.trim().startsWith("✓")).length;

  async function save(next: WeekPlan) {
    if (JSON.stringify(next) === JSON.stringify(saved)) return;
    const { error } = await supabase.from("week_plans").upsert({ ...next, owner_id: meId }, { onConflict: "owner_id,week_start" });
    if (error) return toast("error", t("saveError"));
    setSaved(next);
  }

  const setPriority = (i: number, v: string) => setP((x) => ({ ...x, priorities: x.priorities.map((y, j) => (j === i ? v : y)) }));
  const togglePriority = (i: number) => {
    const v = p.priorities[i];
    const next = { ...p, priorities: p.priorities.map((y, j) => (j === i ? (v.startsWith("✓ ") ? v.slice(2) : `✓ ${v}`) : y)) };
    setP(next);
    save(next);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div className="space-y-4">
        <section className="panel p-5">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight">{t("priorities")}</h2>
            <span className="text-xs text-muted tabular-nums">{t("weekOf", { date: shortDate(week, locale) })}</span>
          </div>
          <p className="mb-4 text-sm text-muted">{t("prioritiesHint")}</p>
          <ol className="space-y-2">
            {p.priorities.map((v, i) => {
              const ticked = v.startsWith("✓ ");
              return (
                <li key={i} className="flex items-center gap-3">
                  <button type="button" onClick={() => v.trim() && togglePriority(i)} aria-pressed={ticked} aria-label={t("markDone")}
                          className={`readout grid size-8 shrink-0 place-items-center rounded-full text-sm transition-colors ${
                            ticked ? "bg-ok text-white" : "bg-surface-2 text-muted hover:text-ink"}`}>
                    {ticked ? <CheckCircle2 size={16} /> : i + 1}
                  </button>
                  <input value={ticked ? v.slice(2) : v} placeholder={t(`placeholder${i + 1}`)}
                         onChange={(e) => setPriority(i, ticked ? `✓ ${e.target.value}` : e.target.value)} onBlur={() => save(p)}
                         className={`input ${ticked ? "text-muted line-through" : ""}`} />
                </li>
              );
            })}
          </ol>
          {done > 0 && <p className="mt-3 text-xs text-ok-text">{t("doneCount", { count: done })}</p>}
        </section>

        <section className="panel p-5">
          <h2 className="text-lg font-semibold tracking-tight">{t("reflection")}</h2>
          <p className="mb-4 text-sm text-muted">{t("reflectionHint")}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {(["went_well", "to_improve", "learned"] as const).map((k) => (
              <label key={k} className="block">
                <span className="mb-1.5 block text-sm font-medium">{t(k)}</span>
                <textarea rows={4} value={p[k]} onChange={(e) => setP((x) => ({ ...x, [k]: e.target.value }))} onBlur={() => save(p)}
                          className="input resize-y" />
              </label>
            ))}
          </div>
          {past.some((w) => w.went_well || w.to_improve || w.learned) && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-muted hover:text-ink">{t("pastWeeks")}</summary>
              <ul className="mt-3 space-y-3">
                {past.filter((w) => w.went_well || w.to_improve || w.learned).map((w) => (
                  <li key={w.week_start} className="rounded-[10px] bg-surface-2/60 p-3">
                    <p className="mb-1 text-xs font-medium text-muted">{t("weekOf", { date: shortDate(w.week_start, locale) })}</p>
                    {w.went_well && <p><span className="text-muted">{t("went_well")}:</span> {w.went_well}</p>}
                    {w.to_improve && <p><span className="text-muted">{t("to_improve")}:</span> {w.to_improve}</p>}
                    {w.learned && <p><span className="text-muted">{t("learned")}:</span> {w.learned}</p>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </div>

      <section className="panel self-start p-5">
        <h2 className="text-lg font-semibold tracking-tight">{t("dueThisWeek")}</h2>
        <p className="mb-3 text-sm text-muted">{t("dueHint")}</p>
        {thisWeek.length ? (
          <ul className="divide-y divide-line">
            {thisWeek.map((d) => {
              const late = d.day < new Date().toISOString().slice(0, 10);
              return (
                <li key={`${d.kind}-${d.id}`}>
                  <Link href={d.href} className="group flex items-center gap-3 py-2.5">
                    <span className={`w-14 shrink-0 text-xs tabular-nums ${late ? "font-medium text-bad-text" : "text-muted"}`}>{shortDate(d.day, locale)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{d.title}</span>
                      {d.parent && <span className="block truncate text-xs text-muted">{d.parent}</span>}
                    </span>
                    <ArrowUpRight size={14} className="shrink-0 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : <p className="py-6 text-center text-sm text-muted">{t("nothingDue")}</p>}
      </section>
    </div>
  );
}
