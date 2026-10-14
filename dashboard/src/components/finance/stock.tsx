"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, Link2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { DataTable, type Field, type Row } from "@/components/data-table";
import { eur } from "@/lib/format";
import { daysOfStock, type SaleRow } from "@/lib/finance";
import type { Member } from "@/lib/boards";

/** Stock list + stock value, low-stock alerts and days left. Product linking is a switch (off by default). */
export function Stock({ items, fields, sales, members, canEdit, isAdmin, linking, today }: {
  items: Row[]; fields: Field[]; sales: SaleRow[]; members: Member[]; canEdit: boolean; isAdmin: boolean; linking: boolean; today: string;
}) {
  const t = useTranslations("finance.stock");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [on, setOn] = useState(linking);
  const value = items.reduce((a, i) => a + (Number(i.stock) || 0) * (Number(i.unit_cost) || 0), 0);
  const low = items.filter((i) => i.low_stock !== null && i.low_stock !== undefined && Number(i.stock) <= Number(i.low_stock));

  async function toggle() {
    const next = !on;
    if (next && !confirm(t("confirmLinking"))) return;
    const { error } = await supabase.from("app_flags").update({ enabled: next, updated_at: new Date().toISOString() }).eq("key", "product_linking");
    if (error) return toast("error", t("saveError"));
    setOn(next); toast("ok", next ? t("linkingOn") : t("linkingOff")); router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="panel p-4"><p className="text-xs text-muted">{t("value")}</p><p className="readout text-2xl">{eur(value, locale)}</p><p className="text-xs text-muted">{t("valueHint")}</p></div>
        <div className="panel p-4"><p className="text-xs text-muted">{t("items")}</p><p className="readout text-2xl">{items.length}</p></div>
        <div className="panel p-4"><p className="text-xs text-muted">{t("low")}</p>
          <p className={`readout text-2xl ${low.length ? "text-bad-text" : ""}`}>{low.length}</p>
          {low.length > 0 && <p className="flex items-center gap-1 text-xs text-bad-text"><AlertTriangle size={12} /> {low.map((i) => i.product as string).join(", ")}</p>}</div>
      </div>

      {items.length > 0 && (
        <ul className="panel divide-y divide-line">
          {items.map((i) => {
            const stock = Number(i.stock) || 0, threshold = i.low_stock === null || i.low_stock === undefined ? null : Number(i.low_stock);
            const isLow = threshold !== null && stock <= threshold;
            const scale = Math.max(stock, (threshold ?? 0) * 3, 1);
            const days = on ? daysOfStock(stock, i.id, sales, today) : null;
            return (
              <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3">
                <span className="min-w-32 flex-1 font-medium">{String(i.product)}</span>
                <span className="w-36">
                  <span className="mb-1 flex justify-between text-xs"><span className={isLow ? "font-medium text-bad-text" : "text-muted"}>{isLow ? t("lowLabel") : t("inStock")}</span><span className="tabular-nums">{stock}</span></span>
                  <span className="relative block h-2 overflow-hidden rounded-full bg-surface-2">
                    <span className={`block h-full rounded-full ${isLow ? "bg-bad" : "bg-ok"}`} style={{ width: `${Math.min(100, (stock / scale) * 100)}%` }} />
                    {threshold !== null && <span aria-hidden className="absolute top-0 h-full w-0.5 bg-ink/60" style={{ left: `${(threshold / scale) * 100}%` }} />}
                  </span>
                </span>
                <span className="w-24 text-right text-xs text-muted tabular-nums">{eur(stock * (Number(i.unit_cost) || 0), locale)}</span>
                <span className="w-28 text-right text-xs text-muted">{days === null ? (on ? t("noSalesYet") : "") : t("daysLeft", { count: days })}</span>
              </li>
            );
          })}
        </ul>
      )}

      <DataTable table="inventory" title={t("title")} rows={items} fields={fields} members={members} canEdit={canEdit}
                 emptyText={t("empty")} addLabel={t("add")} />

      <section className="panel flex flex-wrap items-center gap-3 p-4">
        <Link2 size={18} className="text-muted" />
        <div className="min-w-48 flex-1">
          <p className="font-medium">{t("linking")}</p>
          <p className="text-xs text-muted">{t("linkingHint")}</p>
        </div>
        <button onClick={toggle} disabled={!isAdmin} role="switch" aria-checked={on} aria-label={t("linking")}
                className={`relative h-6 w-11 rounded-full transition disabled:opacity-50 ${on ? "bg-ok" : "bg-line"}`}>
          <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left] ${on ? "left-[22px]" : "left-0.5"}`} />
        </button>
        {!isAdmin && <p className="w-full text-xs text-muted">{t("adminOnly")}</p>}
      </section>
    </div>
  );
}
