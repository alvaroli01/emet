"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Gavel, Trash2, Check, Droplets } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { Avatar } from "@/components/ui";
import { shortDate } from "@/lib/format";
import { STRIKE_KINDS, weightOf, fineOf, quarterOf, strikeSummary, PUNISHMENT_EUR } from "@/lib/strikes";
import type { StrikesData, Strike, Punishment } from "@/lib/strikes-server";
import type { Member } from "@/lib/boards";

/** Team Leaders: give strikes, mark the €3 for arriving late paid, and follow the €75 punishments. */
export function StrikesTool({ people, data, today }: { people: Member[]; data: StrikesData; today: string }) {
  const t = useTranslations("strikes");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [f, setF] = useState({ user: "", kind: "late_arrival" as string, on: today, note: "" });
  const [busy, setBusy] = useState(false);
  const name = (id: string) => people.find((p) => p.id === id)?.full_name ?? "—";
  const q = quarterOf(today);
  const thisQuarter = data.strikes.filter((s) => quarterOf(s.happened_on) === q);
  const openPunishments = data.punishments.filter((p) => !p.done_at);

  async function give(e: React.FormEvent) {
    e.preventDefault();
    if (!f.user || busy) return;
    setBusy(true);
    const { error } = await supabase.from("strikes").insert({ user_id: f.user, kind: f.kind, happened_on: f.on, note: f.note.trim() || null });
    setBusy(false);
    if (error) return toast("error", t("saveError"));
    toast("ok", t("given", { name: name(f.user) }));
    setF({ ...f, note: "" }); router.refresh();
  }
  async function patch(table: "strikes" | "strike_punishments", id: string, values: Record<string, unknown>) {
    const { error } = await supabase.from(table).update(values).eq("id", id);
    if (error) return toast("error", t("saveError"));
    router.refresh();
  }
  async function remove(s: Strike) {
    if (!window.confirm(t("confirmDelete", { name: name(s.user_id) }))) return;
    const { error } = await supabase.from("strikes").delete().eq("id", s.id);
    if (error) return toast("error", t("saveError"));
    router.refresh();
  }
  const kindLabel = (k: string) => `${t(`kinds.${k}`)} (${weightOf(k)}${fineOf(k) ? ` · €${fineOf(k)}` : ""})`;

  return (
    <div className="space-y-4">
      <form onSubmit={give} className="panel grid gap-3 p-5 sm:grid-cols-[1fr_1.4fr_auto_1.4fr_auto] sm:items-end">
        <h3 className="flex items-center gap-2 font-semibold sm:col-span-5"><Gavel size={16} /> {t("give")}</h3>
        <label className="block text-sm font-medium">{t("who")}
          <select required value={f.user} onChange={(e) => setF({ ...f, user: e.target.value })} className="input mt-1.5">
            <option value="">—</option>{people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select></label>
        <label className="block text-sm font-medium">{t("why")}
          <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className="input mt-1.5">
            {STRIKE_KINDS.map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}
          </select></label>
        <label className="block text-sm font-medium">{t("when")}
          <input type="date" max={today} value={f.on} onChange={(e) => setF({ ...f, on: e.target.value })} className="input mt-1.5" /></label>
        <label className="block text-sm font-medium">{t("note")}
          <input maxLength={300} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className="input mt-1.5" /></label>
        <button disabled={busy || !f.user} className="min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-white disabled:opacity-40">{t("giveButton")}</button>
        <p className="text-xs text-muted sm:col-span-5">{t("rules", { eur: PUNISHMENT_EUR, reset: shortDate(strikeSummary([], today).reset, locale) })}</p>
      </form>

      {openPunishments.length > 0 && (
        <section className="panel p-5">
          <h3 className="flex items-center gap-2 font-semibold"><Droplets size={16} /> {t("punishments")}</h3>
          <ul className="mt-2 divide-y divide-line">
            {openPunishments.map((p: Punishment) => {
              const late = p.due_on < today;
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 font-medium">{name(p.user_id)} <span className="font-normal text-muted">· {t("punishmentText", { eur: PUNISHMENT_EUR })}</span></span>
                  <span className={`text-xs ${late ? "font-semibold text-bad-text" : "text-muted"}`}>{late ? t("overdue", { date: shortDate(p.due_on, locale) }) : t("dueOn", { date: shortDate(p.due_on, locale) })}</span>
                  <button onClick={() => patch("strike_punishments", p.id, { done_at: new Date().toISOString() })} className="flex items-center gap-1 rounded-full bg-ok/15 px-3 py-1 text-xs font-medium text-ok-text"><Check size={12} /> {t("markDone")}</button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="panel p-5">
        <h3 className="font-semibold">{t("thisQuarter")}</h3>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((p) => {
            const s = strikeSummary(data.strikes.filter((x) => x.user_id === p.id), today);
            if (!s.total && !s.unpaid) return null;
            return (
              <li key={p.id} className={`flex items-center gap-2.5 rounded-xl p-2.5 ring-1 ${s.total >= 3 ? "bg-bad/10 ring-bad/40" : "bg-surface-2 ring-line"}`}>
                <Avatar name={p.full_name} src={p.avatar_url} size={28} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.full_name}</span>
                <span className="text-sm tabular-nums"><b>{s.total}</b> / 3</span>
                {s.unpaid > 0 && <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-medium text-warn-text">€{s.unpaid}</span>}
              </li>
            );
          })}
        </ul>
        {!thisQuarter.length && <p className="mt-2 text-sm text-muted">{t("noneYet")}</p>}
      </section>

      <section className="panel p-5">
        <h3 className="font-semibold">{t("history")}</h3>
        <ul className="mt-2 divide-y divide-line">
          {data.strikes.slice(0, 60).map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
              <span className="w-16 shrink-0 text-xs text-muted tabular-nums">{shortDate(s.happened_on, locale)}</span>
              <span className="min-w-0 flex-1"><span className="font-medium">{name(s.user_id)}</span> · {kindLabel(s.kind)}{s.note && <span className="block truncate text-xs text-muted">{s.note}</span>}</span>
              {Number(s.fine) > 0 && (
                <button onClick={() => patch("strikes", s.id, { paid_at: s.paid_at ? null : new Date().toISOString() })}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${s.paid_at ? "bg-ok/15 text-ok-text" : "bg-warn/15 text-warn-text"}`}>{s.paid_at ? t("paid") : t("notPaid")}</button>
              )}
              <span className="text-xs text-muted">{t("by", { name: s.given_by ? name(s.given_by) : "—" })}</span>
              <button onClick={() => remove(s)} aria-label={t("delete")} className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-bad-text"><Trash2 size={14} /></button>
            </li>
          ))}
          {!data.strikes.length && <li className="py-6 text-center text-sm text-muted">{t("noneYet")}</li>}
        </ul>
      </section>
    </div>
  );
}
