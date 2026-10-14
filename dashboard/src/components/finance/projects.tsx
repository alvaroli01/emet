"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Plus, Mountain, Trophy, Wallet, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { Modal } from "@/components/data-table";
import { eur, pct, shortDate } from "@/lib/format";
import { summary, roi, sumBy, type SaleRow, type ExpenseRow, type Project } from "@/lib/finance";
import { MetricCard, Panel, Empty, HBars } from "./overview";

const COLORS = ["#2f7d4f", "#2b6ca3", "#c9502e", "#5b4ba8", "#b7791f", "#8a5a7a"];

export function FinanceProjects({ projects, sales, expenses, names, canEdit }: {
  projects: Project[]; sales: SaleRow[]; expenses: ExpenseRow[]; names: Record<string, string>; canEdit: boolean;
}) {
  const t = useTranslations("finance.projects");
  const tf = useTranslations("finance");
  const tc = useTranslations("tools.categories");
  const locale = useLocale();
  const [selected, setSelected] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  // "General" = everything not tied to a project
  const views = useMemo(() => [
    ...projects.map((p) => ({ id: p.id, name: p.name, color: p.color, budget: Number(p.budget) || 0, status: p.status, project: p })),
    { id: "general", name: t("general"), color: "#59625b", budget: 0, status: "live" as const, project: null },
  ].map((v) => {
    const s = sales.filter((x) => (x.project_id ?? "general") === v.id);
    const e = expenses.filter((x) => (x.project_id ?? "general") === v.id);
    const sum = summary(s, e);
    return { ...v, s, e, sum, roi: roi(sum.net, sum.cogs, sum.expenses) };
  }), [projects, sales, expenses, t]);

  const ranked = [...views].filter((v) => v.s.length || v.e.length || v.project).sort((a, b) => b.sum.net - a.sum.net);
  const bestRoi = ranked.filter((v) => v.roi !== null).sort((a, b) => (b.roi ?? 0) - (a.roi ?? 0))[0];
  const biggest = [...ranked].sort((a, b) => b.sum.cogs + b.sum.expenses - (a.sum.cogs + a.sum.expenses))[0];
  const topNet = Math.max(...ranked.map((v) => v.sum.net), 1);
  const view = views.find((v) => v.id === selected);
  const matches = views.filter((v) => v.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input list="project-list" value={query} onChange={(e) => { setQuery(e.target.value); const hit = views.find((v) => v.name === e.target.value); if (hit) setSelected(hit.id); }}
                 placeholder={t("search")} className="input pl-9" aria-label={t("search")} />
          <datalist id="project-list">{views.map((v) => <option key={v.id} value={v.name} />)}</datalist>
        </label>
        <select value={selected} onChange={(e) => { setSelected(e.target.value); setQuery(""); }} className="input w-auto" aria-label={t("picker")}>
          <option value="all">{t("all")}</option>
          {matches.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        {canEdit && (
          <button onClick={() => setCreating(true)} className="ml-auto flex items-center gap-1.5 rounded-xl bg-ink px-3 py-2 text-sm font-medium text-brand-contrast"><Plus size={15} /> {t("new")}</button>
        )}
      </div>

      {selected === "all" || !view ? (
        ranked.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {ranked.map((v, i) => (
              <li key={v.id}>
                <button onClick={() => setSelected(v.id)} className="panel panel-lift relative w-full overflow-hidden p-4 text-left">
                  {/* Expedition altitude: net profit relative to the best project */}
                  <span aria-hidden className="absolute inset-x-0 bottom-0 opacity-15" style={{ height: `${Math.max(6, (Math.max(0, v.sum.net) / topNet) * 100)}%`, background: v.color }} />
                  <span className="relative flex items-start gap-3">
                    <span className="readout grid size-9 shrink-0 place-items-center rounded-xl text-sm text-white" style={{ background: v.color }}>{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{v.name}</span>
                      <span className="block text-xs text-muted">{t(`status.${v.status}`)}{v.project?.owner_id && names[v.project.owner_id] ? ` · ${names[v.project.owner_id]}` : ""}</span>
                    </span>
                    {bestRoi?.id === v.id && <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--ok)_15%,transparent)] px-2 py-0.5 text-[11px] font-medium text-ok-text"><Trophy size={11} /> {t("bestRoi")}</span>}
                    {biggest?.id === v.id && bestRoi?.id !== v.id && <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium"><Wallet size={11} /> {t("biggestSpend")}</span>}
                  </span>
                  <span className="relative mt-3 grid grid-cols-3 gap-2 text-xs">
                    <span><span className="block text-muted">{tf("cards.net")}</span><span className={`readout block text-base ${v.sum.net < 0 ? "text-bad-text" : ""}`}>{eur(v.sum.net, locale)}</span></span>
                    <span><span className="block text-muted">ROI</span><span className="readout block text-base">{v.roi === null ? "—" : `${v.roi}%`}</span></span>
                    <span><span className="block text-muted">{tf("cards.revenue")}</span><span className="readout block text-base">{eur(v.sum.revenue, locale)}</span></span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : <div className="panel p-8 text-center"><Mountain size={26} className="mx-auto mb-2 text-muted" /><p className="font-medium">{t("empty")}</p><p className="mt-1 text-sm text-muted">{t("emptyHint")}</p></div>
      ) : (
        <ProjectView v={view} names={names} />
      )}

      {creating && <ProjectForm onClose={() => setCreating(false)} />}
    </div>
  );

  function ProjectView({ v, names: nm }: { v: (typeof views)[number]; names: Record<string, string> }) {
    const spend = v.sum.cogs + v.sum.expenses;
    const timeline = [...new Set([...v.s, ...v.e].map((x) => x.date.slice(0, 7)))].sort().map((m) => {
      const s = v.s.filter((x) => x.date.startsWith(m)), e = v.e.filter((x) => x.date.startsWith(m));
      const r = summary(s, e);
      return { month: new Date(m + "-15").toLocaleDateString(locale, { month: "short", year: "2-digit" }), revenue: r.revenue, spend: r.cogs + r.expenses };
    });
    const donut = sumBy(v.e, (x) => x.category ?? "other", (x) => Number(x.amount)).filter((x) => x.value > 0);
    const entries = [...v.s.map((x) => ({ ...x, kind: "sale" as const })), ...v.e.map((x) => ({ ...x, kind: "expense" as const }))].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="size-3 rounded-full" style={{ background: v.color }} />
          <h3 className="text-xl font-semibold tracking-tight">{v.name}</h3>
          <span className="text-sm text-muted">{t(`status.${v.status}`)}</span>
        </div>
        {v.project?.description && <p className="text-sm text-muted">{v.project.description}</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <MetricCard label={tf("cards.revenue")} value={eur(v.sum.revenue, locale)} explain={tf("explain.revenue")} />
          <MetricCard label={tf("wf.cogs")} value={eur(v.sum.cogs, locale)} explain={tf("explain.cogs")} />
          <MetricCard label={tf("wf.expenses")} value={eur(v.sum.expenses, locale)} explain={tf("explain.expenses")} />
          <MetricCard label={tf("cards.net")} value={eur(v.sum.net, locale)} explain={tf("explain.net")} tone={v.sum.net < 0 ? "bad" : undefined} />
          <MetricCard label={tf("cards.netMargin")} value={pct(v.sum.netMargin, locale)} explain={tf("explain.netMargin")} />
          <MetricCard label="ROI" value={v.roi === null ? "—" : `${v.roi}%`} explain={t("roiExplain")} tone={v.roi === null ? undefined : v.roi >= 0 ? "ok" : "bad"} />
        </div>
        {v.budget > 0 && (
          <div className="panel p-4">
            <div className="mb-1.5 flex justify-between text-sm"><span className="font-medium">{t("budget")}</span><span className="tabular-nums">{eur(spend, locale)} / {eur(v.budget, locale)}</span></div>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface-2"><div className={`h-full rounded-full ${spend > v.budget ? "bg-bad" : "bg-climbed"}`} style={{ width: `${Math.min(100, (spend / v.budget) * 100)}%` }} /></div>
            {spend > v.budget && <p className="mt-1.5 text-xs text-bad-text">{t("overBudget", { amount: eur(spend - v.budget, locale) })}</p>}
          </div>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title={t("timeline")}>
            {timeline.length ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={timeline}><CartesianGrid vertical={false} stroke="var(--grid)" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} width={52} tick={{ fill: "var(--muted)", fontSize: 11 }} tickFormatter={(x) => eur(x, locale)} />
                  <Tooltip formatter={(x) => eur(Number(x), locale)} />
                  <Bar dataKey="revenue" name={tf("cards.revenue")} fill="var(--series-1)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="spend" name={t("spend")} fill="var(--series-2)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty text={t("noEntries")} />}
          </Panel>
          <Panel title={tf("charts.expenses")}>{donut.length ? <HBars rows={donut.map((d) => ({ label: tc.has(d.key) ? tc(d.key) : d.key, value: d.value }))} locale={locale} /> : <Empty text={tf("emptyExpenses")} />}</Panel>
        </div>
        <Panel title={t("entries", { count: v.sum.orders })}>
          {entries.length ? (
            <ul className="divide-y divide-line text-sm">
              {entries.map((x) => (
                <li key={x.id} className="flex items-center gap-3 py-2">
                  <span className="w-14 shrink-0 text-xs text-muted tabular-nums">{shortDate(x.date, locale)}</span>
                  <span className="min-w-0 flex-1 truncate">{x.description}</span>
                  <span className="text-xs text-muted">{x.logged_by ? nm[x.logged_by] : ""}</span>
                  <span className={`w-20 text-right tabular-nums ${x.kind === "expense" ? "text-bad-text" : ""}`}>{x.kind === "expense" ? "−" : ""}{eur(Math.abs(Number(x.amount)), locale)}</span>
                </li>
              ))}
            </ul>
          ) : <Empty text={t("noEntries")} />}
        </Panel>
      </div>
    );
  }
}

function ProjectForm({ onClose }: { onClose: () => void }) {
  const t = useTranslations("finance.projects");
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [v, setV] = useState({ name: "", description: "", status: "planning", starts_on: "", ends_on: "", budget: "", color: COLORS[0] });
  const set = (k: keyof typeof v, x: string) => setV((s) => ({ ...s, [k]: x }));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { data: me } = await supabase.rpc("my_profile_id");
    const { error } = await supabase.from("projects").insert({
      name: v.name.trim(), description: v.description.trim() || null, status: v.status, owner_id: me,
      starts_on: v.starts_on || null, ends_on: v.ends_on || null, budget: v.budget ? Number(v.budget) : null, color: v.color,
    });
    if (error) return toast("error", t("saveError"));
    toast("ok", t("created")); onClose(); router.refresh();
  }
  return (
    <Modal title={t("new")} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <label className="block"><span className="mb-1 block text-sm font-medium">{t("name")} *</span><input required value={v.name} onChange={(e) => set("name", e.target.value)} className="input" /></label>
        <label className="block"><span className="mb-1 block text-sm font-medium">{t("description")}</span><textarea rows={2} value={v.description} onChange={(e) => set("description", e.target.value)} className="input" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="mb-1 block text-sm font-medium">{t("statusLabel")}</span>
            <select value={v.status} onChange={(e) => set("status", e.target.value)} className="input">{["planning", "live", "closed"].map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}</select></label>
          <label className="block"><span className="mb-1 block text-sm font-medium">{t("budget")} (€)</span><input type="number" min="0" step="0.01" value={v.budget} onChange={(e) => set("budget", e.target.value)} className="input" /></label>
          <label className="block"><span className="mb-1 block text-sm font-medium">{t("start")}</span><input type="date" value={v.starts_on} onChange={(e) => set("starts_on", e.target.value)} className="input" /></label>
          <label className="block"><span className="mb-1 block text-sm font-medium">{t("end")}</span><input type="date" value={v.ends_on} onChange={(e) => set("ends_on", e.target.value)} className="input" /></label>
        </div>
        <fieldset><legend className="mb-1 text-sm font-medium">{t("color")}</legend>
          <div className="flex gap-2">{COLORS.map((c) => <button key={c} type="button" onClick={() => set("color", c)} aria-pressed={v.color === c} aria-label={c}
            className={`size-7 rounded-full ring-offset-2 ring-offset-surface ${v.color === c ? "ring-2 ring-ink" : ""}`} style={{ background: c }} />)}</div></fieldset>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-muted">{t("cancel")}</button>
          <button className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-contrast">{t("create")}</button>
        </div>
      </form>
    </Modal>
  );
}
