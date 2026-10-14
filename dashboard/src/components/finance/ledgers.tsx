"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Filter, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { syncBooksSoon } from "@/lib/books-client";
import { DataTable, type Field, type Row } from "@/components/data-table";
import { eur } from "@/lib/format";
import { summary, reversalOf, METHODS, type SaleRow, type ExpenseRow } from "@/lib/finance";
import type { Member } from "@/lib/boards";

type Filters = { from: string; to: string; project: string; category: string; method: string; person: string };
const EMPTY: Filters = { from: "", to: "", project: "", category: "", method: "", person: "" };

/** Sales and expenses with filters and live totals. No deleting: a wrong entry gets a reversing entry with a reason. */
export function Ledgers({ sales, expenses, salesFields, expenseFields, members, projects, categories, canEdit, me, today }: {
  sales: Row[]; expenses: Row[]; salesFields: Field[]; expenseFields: Field[]; members: Member[];
  projects: { id: string; name: string }[]; categories: { value: string; label: string }[]; canEdit: boolean; me: string; today: string
}) {
  const t = useTranslations("finance.ledgers");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [f, setF] = useState<Filters>(EMPTY);
  const [open, setOpen] = useState(false);
  const active = Object.values(f).some(Boolean);

  const match = (r: Row, kind: "sale" | "expense") =>
    (!f.from || String(r.date) >= f.from) && (!f.to || String(r.date) <= f.to)
    && (!f.project || (f.project === "general" ? !r.project_id : r.project_id === f.project))
    && (!f.category || kind === "sale" || r.category === f.category)
    && (!f.method || (r.payment_method ?? "other") === f.method)
    && (!f.person || r.logged_by === f.person || r.rep_id === f.person);
  const s = sales.filter((r) => match(r, "sale")), e = expenses.filter((r) => match(r, "expense"));
  const sum = summary(s as unknown as SaleRow[], e as unknown as ExpenseRow[]);

  async function reverse(table: "sales" | "expenses", row: Row) {
    const reason = prompt(t("reasonPrompt"));
    if (!reason?.trim()) return;
    const rev = reversalOf(row as unknown as { id: string; description: string; amount: number; cost?: number }, reason.trim(), today);
    const { error } = await supabase.from(table).insert({ ...rev, project_id: row.project_id ?? null, payment_method: row.payment_method ?? null, ...(table === "expenses" ? { category: row.category ?? null } : {}), logged_by: me });
    if (error) return toast("error", error.message.includes("closed") ? t("closedMonth") : t("saveError"));
    toast("ok", t("reversed")); syncBooksSoon(); router.refresh();
  }

  const sel = "input w-auto py-1.5 text-sm";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm ${active ? "bg-brand text-brand-contrast" : "bg-surface-2 text-muted hover:text-ink"}`}>
          <Filter size={14} /> {t("filters")}{active ? ` · ${Object.values(f).filter(Boolean).length}` : ""}
        </button>
        {active && <button onClick={() => setF(EMPTY)} className="flex items-center gap-1 text-xs text-muted hover:text-ink"><X size={12} /> {t("clear")}</button>}
        <span className="ml-auto text-sm text-muted tabular-nums">{t("totals", { revenue: eur(sum.revenue, locale), expenses: eur(sum.expenses, locale), net: eur(sum.net, locale) })}</span>
      </div>
      {open && (
        <div className="panel flex flex-wrap gap-2 p-3">
          <input type="date" value={f.from} onChange={(x) => setF({ ...f, from: x.target.value })} className={sel} aria-label={t("from")} />
          <input type="date" value={f.to} onChange={(x) => setF({ ...f, to: x.target.value })} className={sel} aria-label={t("to")} />
          <select value={f.project} onChange={(x) => setF({ ...f, project: x.target.value })} className={sel} aria-label={t("project")}>
            <option value="">{t("anyProject")}</option><option value="general">{t("general")}</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={f.category} onChange={(x) => setF({ ...f, category: x.target.value })} className={sel} aria-label={t("category")}>
            <option value="">{t("anyCategory")}</option>{categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={f.method} onChange={(x) => setF({ ...f, method: x.target.value })} className={sel} aria-label={t("method")}>
            <option value="">{t("anyMethod")}</option>{METHODS.map((m) => <option key={m} value={m}>{t(`methods.${m}`)}</option>)}
          </select>
          <select value={f.person} onChange={(x) => setF({ ...f, person: x.target.value })} className={sel} aria-label={t("person")}>
            <option value="">{t("anyone")}</option>{members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
        </div>
      )}
      <DataTable table="sales" title={t("sales")} rows={s} fields={salesFields} members={members} canEdit={canEdit}
                 defaults={{ logged_by: me, date: today, payment_method: "cash" }} emptyText={t("salesEmpty")} addLabel={t("addSale")}
                 onReverse={(r) => reverse("sales", r)} reverseLabel={t("reverse")} onSaved={syncBooksSoon} />
      <DataTable table="expenses" title={t("expenses")} rows={e} fields={expenseFields} members={members} canEdit={canEdit}
                 defaults={{ logged_by: me, date: today, payment_method: "cash" }} emptyText={t("expensesEmpty")} addLabel={t("addExpense")}
                 onReverse={(r) => reverse("expenses", r)} reverseLabel={t("reverse")} onSaved={syncBooksSoon} />
    </div>
  );
}
