"use client";

import { useLocale, useTranslations } from "next-intl";
import { TrendingUp, RefreshCw, XCircle } from "lucide-react";
import { pct } from "@/lib/format";
import { bestMetric, median, shareSaveRate, TAG_KEYS, type Content, type Metric, type TagKey } from "@/lib/marketing";
import { Panel, Empty } from "@/components/finance/overview";

/** The "what works" library: every scale / iterate / kill decision with its reason, and how each tag value performs. */
export function Library({ items, metrics }: { items: Content[]; metrics: Metric[] }) {
  const t = useTranslations("marketing.library");
  const tt = useTranslations("marketing.tags");
  const locale = useLocale();
  const decided = items.filter((c) => c.decision) as (Content & { decision_why?: string | null })[];
  const icon = { scale: <TrendingUp size={15} className="text-ok-text" />, iterate: <RefreshCw size={15} className="text-warn-text" />, kill: <XCircle size={15} className="text-bad-text" /> } as Record<string, React.ReactNode>;

  // Median share+save rate per tag value, all values (the Pulse only shows the top/bottom 3)
  const table: { key: TagKey; rows: { value: string; rate: number; posts: number }[] }[] = TAG_KEYS.map((key) => {
    const g = new Map<string, number[]>();
    for (const c of items) {
      const v = c.tags?.[key], r = shareSaveRate(bestMetric(c.id, metrics));
      if (v && r !== null) g.set(v, [...(g.get(v) ?? []), r]);
    }
    return { key, rows: [...g].map(([value, rs]) => ({ value, rate: median(rs)!, posts: rs.length })).sort((a, b) => b.rate - a.rate) };
  }).filter((x) => x.rows.length);
  const max = Math.max(0.0001, ...table.flatMap((x) => x.rows.map((r) => r.rate)));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title={t("decisions")}>
        {decided.length ? (
          <div className="space-y-4">
            {(["scale", "iterate", "kill"] as const).map((d) => {
              const list = decided.filter((c) => c.decision === d);
              if (!list.length) return null;
              return (
                <div key={d}>
                  <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">{icon[d]} {t(`d.${d}`)} <span className="text-xs font-normal text-muted">{list.length}</span></p>
                  <ul className="space-y-1.5 text-sm">
                    {list.map((c) => <li key={c.id} className="rounded-lg bg-surface-2/60 px-3 py-2"><span className="font-medium">{c.title}</span>
                      <span className="block text-xs text-muted">{TAG_KEYS.filter((k) => c.tags?.[k]).map((k) => c.tags[k]).join(" · ")}</span>
                      {c.decision_why && <span className="mt-0.5 block text-xs">{c.decision_why}</span>}</li>)}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : <Empty text={t("noDecisions")} />}
      </Panel>
      <Panel title={t("byTag")}>
        {table.length ? (
          <div className="space-y-4">
            {table.map(({ key, rows }) => (
              <div key={key}>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{tt(key)}</p>
                <ul className="space-y-1.5">
                  {rows.map((r) => (
                    <li key={r.value} className="text-sm">
                      <div className="flex justify-between gap-2"><span className="truncate">{r.value}</span><span className="tabular-nums text-muted">{pct(r.rate, locale)} · {t("posts", { count: r.posts })}</span></div>
                      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className={`h-full rounded-full ${r.posts < 2 ? "bg-muted/40" : "bg-series-1"}`} style={{ width: `${(r.rate / max) * 100}%` }} /></div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="text-xs text-muted">{t("byTagNote")}</p>
          </div>
        ) : <Empty text={t("noData")} />}
      </Panel>
    </div>
  );
}
