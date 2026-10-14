"use client";

import { useLocale, useTranslations } from "next-intl";
import { Copy } from "lucide-react";
import { useToast } from "@/components/toast";
import { StatusPill } from "@/components/status";
import { formatKpi, useMetricName } from "@/components/kpi-cards";
import { kpiStatus } from "@/lib/kpis";
import { longDate } from "@/lib/format";
import type { KpiWithValue } from "@/lib/kpi-data";
import type { Group } from "@/lib/session";

/** Friday scorecard: every KPI vs its target, filled in automatically from the other tabs. */
export function Scorecard({ kpis, groups }: { kpis: KpiWithValue[]; groups: Group[] }) {
  const t = useTranslations("tools.scorecard");
  const tg = useTranslations("group.names");
  const ts = useTranslations("status");
  const locale = useLocale();
  const name = useMetricName();
  const toast = useToast();

  const rows = groups.map((g) => ({ g, items: kpis.filter((k) => k.group_id === g.id) })).filter((x) => x.items.length);

  async function copy() {
    const lines = [`📋 ${t("heading", { date: longDate(new Date(), locale) })}`];
    for (const { g, items } of rows) {
      lines.push("", `${g.emoji} ${tg(g.slug)}`);
      for (const k of items) {
        const st = kpiStatus(k.metric, k.current, k.target);
        const icon = st === "good" ? "✅" : st === "warning" ? "⚠️" : st === "critical" ? "❌" : "·";
        lines.push(`${icon} ${name(k.metric)}: ${formatKpi(k.current, k.unit, locale)} / ${k.target === null ? t("tbd") : formatKpi(k.target, k.unit, locale)}`);
      }
    }
    try { await navigator.clipboard.writeText(lines.join("\n")); toast("ok", t("copied")); }
    catch { toast("error", t("copyFailed")); }
  }

  return (
    <div className="panel">
      <header className="flex flex-wrap items-center gap-2 px-5 pt-4 pb-3">
        <div className="flex-1">
          <h3 className="font-semibold">{t("title")}</h3>
          <p className="text-xs text-muted">{t("subtitle")}</p>
        </div>
        <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-sm hover:bg-surface-2">
          <Copy size={14} /> {t("copy")}
        </button>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-line text-left text-xs text-muted">
              <th className="px-5 py-2 font-medium">{t("kpi")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("now")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("target")}</th>
              <th className="px-5 py-2 font-medium">{t("status")}</th>
            </tr>
          </thead>
          {rows.map(({ g, items }) => (
            <tbody key={g.id} className="divide-y divide-line">
              <tr><td colSpan={4} className="bg-surface-2/60 px-5 py-1.5 text-xs font-medium">{g.emoji} {tg(g.slug)}</td></tr>
              {items.map((k) => {
                const st = kpiStatus(k.metric, k.current, k.target);
                return (
                  <tr key={k.id}>
                    <td className="px-5 py-2">{name(k.metric)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatKpi(k.current, k.unit, locale)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">{k.target === null ? t("tbd") : formatKpi(k.target, k.unit, locale)}</td>
                    <td className="px-5 py-2">{st ? <StatusPill status={st} /> : <span className="text-xs text-muted">{ts("noData")}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}
