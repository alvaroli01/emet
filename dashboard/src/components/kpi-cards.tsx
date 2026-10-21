"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { StatusPill } from "@/components/status";
import { METRICS, kpiStatus } from "@/lib/kpis";
import { eur, num } from "@/lib/format";
import type { KpiWithValue } from "@/lib/kpi-data";

export function formatKpi(v: number | null, unit: string | null, locale: string) {
  if (v === null) return "—";
  if (unit === "€") return eur(v, locale);
  if (unit === "%") return `${Math.round(v)}%`;
  if (unit === "/5") return `${v.toFixed(1)}/5`;
  if (unit === "h") return `${num(Math.round(v), locale)} h`;
  return num(Math.round(v * 10) / 10, locale);
}

export function useMetricName() {
  const t = useTranslations("kpi.metrics");
  return (metric: string) => (METRICS[metric] ? t(METRICS[metric].key) : metric);
}

/** KPI cards for one group: current value vs target. Targets are editable by the group. */
export function KpiCards({ kpis, canEdit, inline = false }: { kpis: KpiWithValue[]; canEdit: boolean; inline?: boolean }) {
  const t = useTranslations("kpi");
  const locale = useLocale();
  const name = useMetricName();
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");

  async function saveTarget(id: string) {
    const target = value.trim() === "" ? null : Number(value);
    const { error } = await createClient().from("kpi_targets").update({ target }).eq("id", id);
    setEditing(null);
    if (error) return toast("error", t("saveError"));
    toast("ok", t("saved"));
    router.refresh();
  }

  if (!kpis.length) return null;
  return (
    <div className={inline ? "grid grid-cols-2 gap-x-4 gap-y-5 max-sm:grid-cols-1 max-sm:divide-y max-sm:divide-line max-sm:gap-y-0 max-sm:[&>*]:py-3 max-sm:[&>*:first-child]:pt-0 lg:flex lg:gap-0 lg:divide-x lg:divide-line" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"}>
      {kpis.map((k) => {
        const status = kpiStatus(k.metric, k.current, k.target);
        return (
          <div key={k.id} className={inline ? "min-w-0 lg:min-w-[210px] lg:px-6 lg:first:pl-0" : "panel panel-lift p-4"}>
            <p className="text-sm text-muted">{name(k.metric)}</p>
            {k.role_title && <p className="text-[11px] text-muted">{k.role_title} · {t(`period.${k.period}`)}</p>}
            <p className="readout mt-1.5 text-2xl">{formatKpi(k.current, k.unit, locale)}</p>
            <div className="mt-2 flex items-center justify-between gap-2 text-sm">
              {editing === k.id ? (
                <form className="flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); saveTarget(k.id); }}>
                  <span className="text-muted">{t("target")}</span>
                  <input autoFocus type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)}
                         onBlur={() => saveTarget(k.id)} className="input w-24 py-1" aria-label={t("target")} />
                </form>
              ) : (
                <span className="inline-flex items-center gap-1 text-muted tabular-nums">
                  {t("target")}: {k.target === null ? t("tbd") : formatKpi(k.target, k.unit, locale)}
                  {canEdit && (
                    <button onClick={() => { setEditing(k.id); setValue(k.target === null ? "" : String(k.target)); }}
                            aria-label={t("editTarget")} className="rounded p-0.5 hover:text-ink"><Pencil size={12} /></button>
                  )}
                </span>
              )}
              {status ? <StatusPill status={status} /> : <span className="text-xs text-muted">{k.current === null ? t("noData") : ""}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
