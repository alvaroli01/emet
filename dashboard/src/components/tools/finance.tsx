import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { DataTable, type Field, type Row } from "@/components/data-table";
import { totals, weekStart } from "@/lib/metrics";
import { loggedOnTime } from "@/lib/kpis";
import { eur, pct, todayISO } from "@/lib/format";
import { FridayReport } from "./friday-report";
import type { ToolProps } from "./types";

export const EXPENSE_CATEGORIES = ["stock", "marketing", "tools", "transport", "printing", "events", "other"] as const;

export async function FinanceTools({ editable, session, allMembers }: ToolProps) {
  const t = await getTranslations("tools");
  const locale = await getLocale();
  const supabase = await createClient();
  const [sales, expenses, inventory] = await Promise.all([
    supabase.from("sales").select("*").order("date", { ascending: false }).order("created_at", { ascending: false }).returns<Row[]>(),
    supabase.from("expenses").select("*").order("date", { ascending: false }).order("created_at", { ascending: false }).returns<Row[]>(),
    supabase.from("inventory").select("*").order("product").returns<Row[]>(),
  ]);
  const s = (sales.data ?? []) as unknown as { date: string; amount: number; cost: number; created_at: string }[];
  const e = (expenses.data ?? []) as unknown as { date: string; amount: number; created_at: string; category: string; description: string }[];
  const tot = totals(s, e);
  const week = weekStart(Date.now());
  const weekEntries = [...s, ...e].filter((x) => weekStart(x.date) === week);
  const onTime = weekEntries.length ? weekEntries.filter((x) => loggedOnTime(x.date, x.created_at)).length / weekEntries.length : null;
  const me = session.me.id;
  const categoryOptions = EXPENSE_CATEGORIES.map((c) => ({ value: c, label: t(`categories.${c}`) }));

  const salesFields: Field[] = [
    { key: "date", label: t("fields.date"), type: "date", required: true },
    { key: "description", label: t("fields.description"), type: "text", required: true },
    { key: "amount", label: t("fields.amount"), type: "money", required: true },
    { key: "cost", label: t("fields.cost"), type: "money" },
    { key: "channel", label: t("fields.channel"), type: "text", placeholder: "Instagram, market stall…" },
    { key: "rep_id", label: t("fields.rep"), type: "person" },
    { key: "logged_by", label: t("fields.loggedBy"), type: "person", form: false },
    { key: "in24", label: t("fields.in24"), type: "logged24", date: "date", created: "created_at" },
  ];
  const expenseFields: Field[] = [
    { key: "date", label: t("fields.date"), type: "date", required: true },
    { key: "description", label: t("fields.description"), type: "text", required: true },
    { key: "category", label: t("fields.category"), type: "select", options: categoryOptions },
    { key: "amount", label: t("fields.amount"), type: "money", required: true },
    { key: "logged_by", label: t("fields.loggedBy"), type: "person", form: false },
    { key: "in24", label: t("fields.in24"), type: "logged24", date: "date", created: "created_at" },
  ];
  const inventoryFields: Field[] = [
    { key: "product", label: t("fields.product"), type: "text", required: true },
    { key: "sku", label: "SKU", type: "text" },
    { key: "stock", label: t("fields.stock"), type: "number", required: true },
    { key: "unit_cost", label: t("fields.unitCost"), type: "money" },
    { key: "price", label: t("fields.price"), type: "money" },
    { key: "margin", label: t("fields.margin"), type: "margin", price: "price", cost: "unit_cost" },
  ];

  const tiles = [
    { label: t("finance.revenue"), value: eur(tot.revenue, locale) },
    { label: t("finance.costs"), value: eur(tot.cogs + tot.expenses, locale) },
    { label: t("finance.profit"), value: eur(tot.profit, locale) },
    { label: t("finance.margin"), value: pct(tot.margin, locale), note: t("finance.marginNote") },
    { label: t("finance.loggedOnTime"), value: pct(onTime, locale), note: t("finance.loggedNote") },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-semibold">💰 {t("finance.title")}</h2>
        <FridayReport sales={s} expenses={e} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((x) => (
          <div key={x.label} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
            <p className="text-xs text-muted">{x.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{x.value}</p>
            {x.note && <p className="text-[11px] text-muted">{x.note}</p>}
          </div>
        ))}
      </div>
      <DataTable table="sales" title={t("finance.sales")} rows={sales.data ?? []} fields={salesFields} members={allMembers}
                 canEdit={editable} defaults={{ logged_by: me, date: todayISO() }}
                 emptyText={t("finance.salesEmpty")} addLabel={t("finance.addSale")} />
      <DataTable table="expenses" title={t("finance.expenses")} rows={expenses.data ?? []} fields={expenseFields} members={allMembers}
                 canEdit={editable} defaults={{ logged_by: me }}
                 emptyText={t("finance.expensesEmpty")} addLabel={t("finance.addExpense")} />
      <DataTable table="inventory" title={t("finance.inventory")} rows={inventory.data ?? []} fields={inventoryFields} members={allMembers}
                 canEdit={editable} emptyText={t("finance.inventoryEmpty")} addLabel={t("finance.addProduct")} />
    </section>
  );
}
