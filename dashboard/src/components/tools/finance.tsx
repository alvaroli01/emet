import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { type Field, type Row } from "@/components/data-table";
import { todayISO } from "@/lib/format";
import { METHODS, cashExpected, type SaleRow, type ExpenseRow, type Project } from "@/lib/finance";
import { booksStatus } from "@/lib/books";
import { FinanceOverview } from "@/components/finance/overview";
import { FinanceProjects } from "@/components/finance/projects";
import { Ledgers } from "@/components/finance/ledgers";
import { Stock } from "@/components/finance/stock";
import { Bookkeeper } from "@/components/finance/bookkeeper";
import { ClaimButton } from "@/components/finance/claim";
import { FridayReport } from "./friday-report";
import { HEARD_ABOUT } from "./marketing";
import type { ToolProps, ToolTab } from "./types";

export const EXPENSE_CATEGORIES = ["stock", "marketing", "tools", "transport", "printing", "events", "other"] as const;

export async function FinanceTools({ editable, session, allMembers }: ToolProps): Promise<ToolTab[]> {
  const t = await getTranslations("tools");
  const tf = await getTranslations("finance");
  const tmk = await getTranslations("marketing");
  const supabase = await createClient();
  const today = todayISO();
  const [sales, expenses, inventory, projects, flags, locks, claims, counts, audit, won, people, codes] = await Promise.all([
    supabase.from("sales").select("*").order("date", { ascending: false }).order("created_at", { ascending: false }).returns<Row[]>(),
    supabase.from("expenses").select("*").order("date", { ascending: false }).order("created_at", { ascending: false }).returns<Row[]>(),
    supabase.from("inventory").select("*").order("product").returns<Row[]>(),
    supabase.from("projects").select("*").order("created_at").returns<Project[]>(),
    supabase.from("app_flags").select("key, enabled"),
    supabase.from("month_locks").select("month"),
    supabase.from("expense_claims").select("*").order("created_at", { ascending: false }),
    editable ? supabase.from("cash_counts").select("*").order("counted_at", { ascending: false }).limit(10) : Promise.resolve({ data: [] }),
    editable ? supabase.from("finance_audit").select("*").order("at", { ascending: false }).limit(100) : Promise.resolve({ data: [] }),
    supabase.from("prospects").select("id", { count: "exact", head: true }).eq("stage", "won"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("discount_codes").select("code").eq("active", true).order("code"),
  ]);
  const me = session.me.id;
  const s = (sales.data ?? []) as unknown as SaleRow[];
  const e = (expenses.data ?? []) as unknown as ExpenseRow[];
  const p = projects.data ?? [];
  const projectOptions = p.map((x) => ({ value: x.id, label: x.name }));
  const methodOptions = METHODS.map((m) => ({ value: m, label: tf(`ledgers.methods.${m}`) }));
  const categoryOptions = EXPENSE_CATEGORIES.map((c) => ({ value: c, label: t(`categories.${c}`) }));
  const linking = (flags.data ?? []).find((f) => f.key === "product_linking")?.enabled ?? false;
  const names = Object.fromEntries(allMembers.map((m) => [m.id, m.full_name]));
  const sync = editable ? await booksStatus().catch(() => ({ connected: false, pending: 0, sheetUrl: null })) : { connected: false, pending: 0, sheetUrl: null };

  const salesFields: Field[] = [
    { key: "date", label: t("fields.date"), type: "date", required: true },
    { key: "description", label: t("fields.description"), type: "text", required: true },
    { key: "amount", label: t("fields.amount"), type: "money", required: true },
    { key: "cost", label: t("fields.cost"), type: "money" },
    { key: "payment_method", label: tf("ledgers.method"), type: "select", options: methodOptions },
    { key: "project_id", label: tf("ledgers.project"), type: "select", options: projectOptions },
    { key: "heard_about", label: tmk("heardLabel"), type: "select", required: true, options: HEARD_ABOUT.map((h) => ({ value: h, label: tmk(`heard.${h}`) })) },
    { key: "code", label: tmk("codes.code"), type: "select", list: false, options: (codes.data ?? []).map((c) => ({ value: c.code, label: c.code })) },
    { key: "channel", label: t("fields.channel"), type: "text", placeholder: "Instagram, market stall…", list: false },
    { key: "rep_id", label: t("fields.rep"), type: "person", list: false },
    ...(linking ? [{ key: "item_id", label: tf("stock.item"), type: "select", options: (inventory.data ?? []).map((i) => ({ value: i.id, label: String(i.product) })), list: false } as Field,
      { key: "quantity", label: tf("stock.quantity"), type: "number", list: false } as Field] : []),
    { key: "logged_by", label: t("fields.loggedBy"), type: "person", form: false },
    { key: "in24", label: t("fields.in24"), type: "logged24", date: "date", created: "created_at" },
  ];
  const expenseFields: Field[] = [
    { key: "date", label: t("fields.date"), type: "date", required: true },
    { key: "description", label: t("fields.description"), type: "text", required: true },
    { key: "category", label: t("fields.category"), type: "select", options: categoryOptions },
    { key: "amount", label: t("fields.amount"), type: "money", required: true },
    { key: "payment_method", label: tf("ledgers.method"), type: "select", options: methodOptions },
    { key: "project_id", label: tf("ledgers.project"), type: "select", options: projectOptions },
    { key: "logged_by", label: t("fields.loggedBy"), type: "person", form: false },
    { key: "in24", label: t("fields.in24"), type: "logged24", date: "date", created: "created_at" },
  ];
  const inventoryFields: Field[] = [
    { key: "product", label: t("fields.product"), type: "text", required: true },
    { key: "sku", label: "SKU", type: "text" },
    { key: "stock", label: t("fields.stock"), type: "number", required: true },
    { key: "low_stock", label: tf("stock.lowAt"), type: "number" },
    { key: "unit_cost", label: t("fields.unitCost"), type: "money" },
    { key: "price", label: t("fields.price"), type: "money" },
    { key: "margin", label: t("fields.margin"), type: "margin", price: "price", cost: "unit_cost" },
  ];

  return [
    {
      id: "money", group: "numbers", label: tf("tabs.overview"),
      node: (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ClaimButton projects={p} categories={categoryOptions} />
            <FridayReport sales={s} expenses={e} />
            <a href="/api/books/xlsx" className="inline-flex items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-line">{tf("books.excel")}</a>
          </div>
          <FinanceOverview sales={s} expenses={e} projects={p} members={people.count ?? 1} customersWon={won.count ?? 0} today={today} />
        </div>
      ),
    },
    { id: "projects", group: "plan", label: tf("tabs.projects"), node: <FinanceProjects projects={p} sales={s} expenses={e} names={names} canEdit={editable} /> },
    {
      id: "ledgers", group: "numbers", label: tf("tabs.ledgers"),
      node: <Ledgers sales={sales.data ?? []} expenses={expenses.data ?? []} salesFields={salesFields} expenseFields={expenseFields} members={allMembers}
                     projects={p} categories={categoryOptions} canEdit={editable} me={me} today={today} />,
    },
    { id: "stock", group: "work", label: tf("tabs.stock"), node: <Stock items={inventory.data ?? []} fields={inventoryFields} sales={s} members={allMembers} canEdit={editable} isAdmin={session.isAdmin} linking={linking} today={today} /> },
    ...(editable ? [{
      id: "books", group: "work" as const, label: tf("tabs.books"),
      node: <Bookkeeper claims={(claims.data ?? []) as never} counts={(counts.data ?? []) as never} audit={(audit.data ?? []) as never}
                        locks={(locks.data ?? []).map((l) => l.month)} entries={[...s, ...e].map((x) => ({ date: x.date, created_at: x.created_at, logged_by: x.logged_by, description: x.description }))}
                        cashExpected={cashExpected(s, e)} projects={p} categories={categoryOptions} names={names} isAdmin={session.isAdmin} me={me} today={today} sync={sync} />,
    }] : []),
  ];
}
