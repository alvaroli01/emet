"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Repeat, Trash2, Plus, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { syncBooksSoon } from "@/lib/books-client";
import { eur, shortDate } from "@/lib/format";
import { METHODS, type ExpenseRow, type Method } from "@/lib/finance";

export type Subscription = {
  id: string; name: string; amount: number | string; every: number; unit: "week" | "month" | "year";
  starts_on: string; next_charge_on: string; category: string; payment_method: Method | null; project_id: string | null;
};

/** What one subscription costs per month on average, so weekly and yearly ones add up with monthly ones. */
const perMonth = (s: Subscription) => (Number(s.amount) || 0) * (s.unit === "week" ? 52 / 12 : s.unit === "year" ? 1 / 12 : 1) / s.every;

/** Repeating costs (Canva, hosting, ads…): each charge books itself as an expense on its day, even if nobody logs in. */
export function Subscriptions({ subs, expenses, projects, categories, canEdit, today }: {
  subs: Subscription[]; expenses: ExpenseRow[]; projects: { id: string; name: string }[];
  categories: { value: string; label: string }[]; canEdit: boolean; today: string;
}) {
  const t = useTranslations("finance.subs");
  const tm = useTranslations("finance.ledgers.methods");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [f, setF] = useState({ name: "", amount: "", every: "1", unit: "month" as Subscription["unit"], starts_on: today, category: "tools", method: "card" as Method, project: "" });
  const [busy, setBusy] = useState(false);

  const paid = useMemo(() => {
    const m = new Map<string, { total: number; count: number }>();
    for (const e of expenses) {
      if (!e.subscription_id) continue;
      const x = m.get(e.subscription_id) ?? { total: 0, count: 0 };
      x.total += Number(e.amount) || 0; x.count += 1;
      m.set(e.subscription_id, x);
    }
    return m;
  }, [expenses]);
  const monthly = subs.reduce((a, s) => a + perMonth(s), 0);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const { error } = await supabase.from("subscriptions").insert({
      name: f.name.trim(), amount: Number(f.amount), every: Number(f.every) || 1, unit: f.unit, starts_on: f.starts_on,
      category: f.category, payment_method: f.method, project_id: f.project || null,
    });
    // A subscription that is due today is booked straight away; the rest wait for their day (daily job)
    if (!error) await supabase.rpc("charge_subscriptions_now");
    setBusy(false);
    if (error) return toast("error", t("saveError"));
    toast("ok", t("added", { name: f.name.trim() }));
    setF({ ...f, name: "", amount: "" });
    syncBooksSoon(); router.refresh();
  }
  async function remove(s: Subscription) {
    if (!window.confirm(t("confirmDelete", { name: s.name }))) return;
    const { error } = await supabase.from("subscriptions").delete().eq("id", s.id);
    if (error) return toast("error", t("saveError"));
    toast("ok", t("deleted", { name: s.name }));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <section className="panel flex flex-wrap items-end justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-muted">{t("perMonth")}</p>
          <p className="readout mt-1 text-3xl">{eur(monthly, locale, 2)}</p>
          <p className="mt-1 text-sm text-muted">{t("explain")}</p>
        </div>
        <p className="text-sm text-muted">{t("count", { count: subs.length })}</p>
      </section>

      {canEdit && (
        <form onSubmit={add} className="panel space-y-4 p-5">
          <h3 className="flex items-center gap-2 font-semibold"><Plus size={16} /> {t("new")}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-sm font-medium sm:col-span-2">{t("name")}
              <input required maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={t("namePlaceholder")} className="input mt-1.5" />
            </label>
            <label className="block text-sm font-medium">{t("amount")}
              <input required type="number" inputMode="decimal" min="0.01" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="12.00" className="input mt-1.5" />
            </label>
            <div className="text-sm font-medium">{t("every")}
              <div className="mt-1.5 flex gap-2">
                <input aria-label={t("every")} type="number" min="1" max="52" value={f.every} onChange={(e) => setF({ ...f, every: e.target.value })} className="input w-20" />
                <select aria-label={t("unitLabel")} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value as Subscription["unit"] })} className="input flex-1">
                  {(["week", "month", "year"] as const).map((u) => <option key={u} value={u}>{t(`units.${u}`, { count: Number(f.every) || 1 })}</option>)}
                </select>
              </div>
            </div>
            <label className="block text-sm font-medium">{t("nextPayment")}
              <input required type="date" min={today} value={f.starts_on} onChange={(e) => setF({ ...f, starts_on: e.target.value })} className="input mt-1.5" />
            </label>
            <label className="block text-sm font-medium">{t("category")}
              <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className="input mt-1.5">
                {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium">{t("method")}
              <select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value as Method })} className="input mt-1.5">
                {METHODS.map((m) => <option key={m} value={m}>{tm(m)}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium">{t("project")}
              <select value={f.project} onChange={(e) => setF({ ...f, project: e.target.value })} className="input mt-1.5">
                <option value="">—</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          </div>
          <button disabled={busy || !f.name.trim() || !(Number(f.amount) > 0)}
                  className="flex min-h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-white transition disabled:opacity-40">
            <Repeat size={15} /> {t("add")}
          </button>
        </form>
      )}

      <section className="panel p-5">
        <h3 className="font-semibold">{t("list")}</h3>
        <ul className="mt-3 divide-y divide-line">
          {subs.map((s) => {
            const p = paid.get(s.id);
            return (
              <li key={s.id} className="flex items-start gap-3 py-3.5 first:pt-1">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2"><Repeat size={15} /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-sm text-muted">{eur(Number(s.amount), locale, 2)} · {t("everyText", { n: s.every, unit: t(`units.${s.unit}`, { count: s.every }) })}{s.payment_method ? ` · ${tm(s.payment_method)}` : ""}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    <span className="flex items-center gap-1"><Calendar size={12} /> {t("nextOn", { date: shortDate(s.next_charge_on, locale) })}</span>
                    {p && <span>{t("paidSoFar", { total: eur(p.total, locale, 2), count: p.count })}</span>}
                  </p>
                </div>
                {canEdit && (
                  <button onClick={() => remove(s)} aria-label={t("delete", { name: s.name })} title={t("delete", { name: s.name })}
                          className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-bad-text"><Trash2 size={15} /></button>
                )}
              </li>
            );
          })}
          {!subs.length && <li className="py-8 text-center text-sm text-muted">{t("none")}</li>}
        </ul>
      </section>
    </div>
  );
}
