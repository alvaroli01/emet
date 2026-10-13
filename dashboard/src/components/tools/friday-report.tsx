"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FileText, Copy } from "lucide-react";
import { Modal } from "@/components/data-table";
import { useToast } from "@/components/toast";
import { totals, weekStart, GOAL } from "@/lib/metrics";
import { eur, pct, shortDate } from "@/lib/format";

type S = { date: string; amount: number | string; cost: number | string };
type E = { date: string; amount: number | string; category?: string | null };

/** One click → this week's profit report as text, ready to paste in the group chat. */
export function FridayReport({ sales, expenses }: { sales: S[]; expenses: E[] }) {
  const t = useTranslations("tools.report");
  const tc = useTranslations("tools.categories");
  const locale = useLocale();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  const week = weekStart(Date.now());
  const ws = sales.filter((s) => weekStart(s.date) === week);
  const we = expenses.filter((e) => weekStart(e.date) === week);
  const w = totals(ws, we);
  const all = totals(sales, expenses);
  const byCat = new Map<string, number>();
  we.forEach((e) => byCat.set(e.category ?? "other", (byCat.get(e.category ?? "other") ?? 0) + Number(e.amount)));
  const topCats = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  const text = [
    `📊 ${t("heading", { date: shortDate(week, locale) })}`,
    "",
    `${t("revenue")}: ${eur(w.revenue, locale)} (${t("sales", { count: ws.length })})`,
    `${t("costs")}: ${eur(w.cogs + w.expenses, locale)}`,
    `${t("profit")}: ${eur(w.profit, locale)} · ${t("margin")} ${pct(w.margin, locale)} ${w.margin !== null && w.margin < GOAL.minMargin ? "⚠️" : "✅"}`,
    topCats.length ? `${t("topExpenses")}: ${topCats.map(([c, v]) => `${tc.has(c) ? tc(c) : c} ${eur(v, locale)}`).join(", ")}` : "",
    "",
    `${t("sinceStart")}: ${eur(all.revenue, locale)} / ${eur(GOAL.revenue, locale)} ${t("revenueLower")} · ${eur(all.profit, locale)} / ${eur(GOAL.profit, locale)} ${t("profitLower")}`,
  ].filter((l, i, arr) => l !== "" || arr[i - 1] !== "").join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast("ok", t("copied"));
    } catch {
      toast("error", t("copyFailed"));
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-2">
        <FileText size={15} /> {t("button")}
      </button>
      {open && (
        <Modal title={t("title")} onClose={() => setOpen(false)}>
          <pre className="whitespace-pre-wrap rounded-xl bg-surface-2 p-4 font-sans text-sm leading-relaxed">{text}</pre>
          <button onClick={copy} className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand py-2.5 text-sm font-medium text-brand-contrast">
            <Copy size={15} /> {t("copy")}
          </button>
        </Modal>
      )}
    </>
  );
}
