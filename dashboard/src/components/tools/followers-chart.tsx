"use client";

import { useLocale, useTranslations } from "next-intl";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Legend } from "@/components/overview/charts";
import { num, shortDate } from "@/lib/format";

// Validated categorical palette, fixed order. Lines use at most 3 colours at once (all-pairs safe);
// a 4th+ platform is still drawn, in grey, and named in the legend and tooltip.
const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)"];

export function FollowersChart({ rows }: { rows: { platform: string; week_start: string; followers: number }[] }) {
  const t = useTranslations("tools.marketing");
  const locale = useLocale();
  if (!rows.length) {
    return <div className="grid h-48 place-items-center rounded-xl border border-dashed border-line text-sm text-muted">{t("chartEmpty")}</div>;
  }
  // Platforms ordered by size so the biggest keep the coloured slots; colour follows the platform, not its rank in a filter
  const latest = new Map<string, number>();
  rows.forEach((r) => latest.set(r.platform, Math.max(latest.get(r.platform) ?? 0, r.followers)));
  const platforms = [...latest.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p);
  const color = (p: string) => SERIES[platforms.indexOf(p)] ?? "var(--muted)";

  const weeks = [...new Set(rows.map((r) => r.week_start))].sort();
  const data = weeks.map((w) => ({
    week: w,
    ...Object.fromEntries(platforms.map((p) => [p, rows.find((r) => r.week_start === w && r.platform === p)?.followers ?? null])),
  }));

  return (
    <div>
      <Legend items={platforms.map((p) => ({ label: p, color: color(p) }))} />
      <div className="mt-2 h-48">
        <ResponsiveContainer initialDimension={{ width: 480, height: 200 }}>
          <LineChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="week" tickFormatter={(w) => shortDate(w, locale)} stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} minTickGap={16} />
            <YAxis tickFormatter={(v) => num(v, locale)} stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} width={48} />
            <Tooltip
              content={({ active, payload, label }) => active && payload?.length ? (
                <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-lg">
                  <p className="mb-1 font-medium">{shortDate(String(label), locale)}</p>
                  {payload.map((p) => (
                    <p key={String(p.dataKey)} className="flex items-center gap-2 tabular-nums">
                      <span className="inline-block w-3" style={{ borderTop: `2px solid ${color(String(p.dataKey))}` }} />
                      <span className="text-muted">{String(p.dataKey)}</span>
                      <span className="ml-auto font-medium">{num(Number(p.value), locale)}</span>
                    </p>
                  ))}
                </div>
              ) : null}
            />
            {platforms.map((p) => (
              <Line key={p} dataKey={p} stroke={color(p)} strokeWidth={2} connectNulls dot={{ r: 3 }} activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--surface)" }} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
