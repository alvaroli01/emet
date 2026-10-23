"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Dumbbell, X, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { Avatar } from "@/components/ui";
import type { Member } from "@/lib/boards";

const range = (monday: string, locale: string) => {
  const f = (d: Date) => d.toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "UTC" });
  const start = new Date(`${monday}T12:00:00Z`);
  return `${f(start)} – ${f(new Date(start.getTime() + 6 * 864e5))}`;
};

/** Who leads the training sessions each week (Mon–Sun). Everyone sees it; admins add and remove leaders. */
export function TrainingLeaders({ weeks, leaders, members, thisWeek, canEdit }: {
  weeks: string[]; leaders: { week_start: string; user_id: string }[]; members: Member[]; thisWeek: string; canEdit: boolean;
}) {
  const t = useTranslations("training");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState<string | null>(null);
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  async function add(week: string, user_id: string) {
    if (!user_id) return;
    setBusy(week);
    const { error } = await supabase.from("training_leaders").insert({ week_start: week, user_id });
    setBusy(null);
    if (error) return toast("error", t("saveError"));
    router.refresh();
  }
  async function remove(week: string, user_id: string) {
    setBusy(week);
    const { error } = await supabase.from("training_leaders").delete().eq("week_start", week).eq("user_id", user_id);
    setBusy(null);
    if (error) return toast("error", t("saveError"));
    router.refresh();
  }

  return (
    <section className="panel p-5">
      <h3 className="flex items-center gap-2 font-semibold"><Dumbbell size={16} /> {t("title")}</h3>
      <p className="text-sm text-muted">{canEdit ? t("hintAdmin") : t("hint")}</p>
      <ul className="mt-4 divide-y divide-line">
        {weeks.map((w) => {
          const here = leaders.filter((l) => l.week_start === w);
          const free = members.filter((m) => !here.some((l) => l.user_id === m.id));
          return (
            <li key={w} className={`flex flex-wrap items-center gap-x-4 gap-y-2 py-3 ${w === thisWeek ? "-mx-3 rounded-xl bg-brand/10 px-3" : ""}`}>
              <span className="flex w-52 shrink-0 flex-wrap items-center gap-y-1 text-sm">
                <span className="font-medium whitespace-nowrap">{range(w, locale)}</span>
                {w === thisWeek && <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-white">{t("now")}</span>}
              </span>
              <span className="flex flex-1 flex-wrap items-center gap-1.5">
                {here.map((l) => {
                  const m = byId.get(l.user_id);
                  return (
                    <span key={l.user_id} className="flex items-center gap-1.5 rounded-full bg-surface-2 py-0.5 pr-1 pl-0.5 text-sm font-medium ring-1 ring-line">
                      <Avatar name={m?.full_name ?? "?"} src={m?.avatar_url ?? null} size={24} />{m?.full_name ?? "—"}
                      {canEdit ? (
                        <button type="button" onClick={() => remove(w, l.user_id)} disabled={busy === w} aria-label={t("remove", { name: m?.full_name ?? "" })}
                                className="grid size-6 place-items-center rounded-full text-muted hover:bg-line hover:text-bad-text"><X size={12} /></button>
                      ) : <span className="w-1.5" />}
                    </span>
                  );
                })}
                {!here.length && <span className="text-sm text-muted">{t("nobody")}</span>}
                {canEdit && (
                  <label className="flex items-center gap-1 text-sm text-muted">
                    <Plus size={14} aria-hidden />
                    <select value="" disabled={busy === w} onChange={(e) => add(w, e.target.value)} aria-label={t("addFor", { week: range(w, locale) })} className="input h-9 w-auto py-0 text-sm">
                      <option value="">{t("add")}</option>
                      {free.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                    </select>
                  </label>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
