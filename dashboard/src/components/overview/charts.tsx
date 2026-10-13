"use client";

import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { WeekPoint } from "@/lib/metrics";

const eur = (v: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const eurShort = (v: number) =>
  Math.abs(v) >= 1000 ? `€${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `€${v}`;
const weekLabel = (w: string) =>
  new Date(w + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

const axis = { stroke: "var(--muted)", fontSize: 12, tickLine: false, axisLine: false } as const;

function TipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string; dashed?: boolean }[] }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2 tabular-nums">
          {r.color && (
            <span className="inline-block h-0.5 w-3" style={{ background: r.dashed ? "transparent" : r.color, borderTop: r.dashed ? `2px dashed ${r.color}` : undefined }} />
          )}
          <span className="text-muted">{r.label}</span>
          <span className="ml-auto font-medium">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean; square?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          {i.square ? (
            <span className="inline-block size-2.5 rounded-sm" style={{ background: i.color }} />
          ) : (
            <span className="inline-block w-4" style={{ borderTop: `2px ${i.dashed ? "dashed" : "solid"} ${i.color}` }} />
          )}
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/** Weekly revenue and profit (grouped bars, one axis). */
export function WeeklyChart({ data }: { data: WeekPoint[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={data} barGap={2} barCategoryGap="25%" margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="week" tickFormatter={weekLabel} {...axis} minTickGap={16} />
          <YAxis tickFormatter={eurShort} {...axis} width={44} />
          <ReferenceLine y={0} stroke="var(--muted)" strokeOpacity={0.4} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TipBox title={`Week of ${weekLabel(String(label))}`} rows={[
                  { label: "Revenue", value: eur(Number(payload[0]?.payload.revenue)), color: "var(--series-1)" },
                  { label: "Profit", value: eur(Number(payload[0]?.payload.profit)), color: "var(--series-2)" },
                ]} />
              ) : null}
          />
          <Bar dataKey="revenue" name="Revenue" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          <Bar dataKey="profit" name="Profit" fill="var(--series-2)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Running totals since the start, with an even-pace reference line (information only, not a target). */
export function CumulativeChart({ data }: { data: WeekPoint[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="week" tickFormatter={weekLabel} {...axis} minTickGap={16} />
          <YAxis tickFormatter={eurShort} {...axis} width={44} />
          <Tooltip
            cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TipBox title={`By week of ${weekLabel(String(label))}`} rows={[
                  { label: "Revenue", value: eur(Number(payload[0]?.payload.cumRevenue)), color: "var(--series-1)" },
                  { label: "Profit", value: eur(Number(payload[0]?.payload.cumProfit)), color: "var(--series-2)" },
                  { label: "Even pace", value: eur(Number(payload[0]?.payload.evenPace)), color: "var(--muted)", dashed: true },
                ]} />
              ) : null}
          />
          <Line dataKey="evenPace" stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
          <Line dataKey="cumRevenue" stroke="var(--series-1)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} isAnimationActive={false} />
          <Line dataKey="cumProfit" stroke="var(--series-2)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
