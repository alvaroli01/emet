"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Trophy, BarChart3, ExternalLink, Rows3, LayoutGrid } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { Modal } from "@/components/data-table";
import { pct, shortDate } from "@/lib/format";
import { hits, bestMetric, shareSaveRate, TAG_KEYS, type Content, type Metric, type TagKey } from "@/lib/marketing";

const STATUSES = ["idea", "briefed", "production", "scheduled", "posted"] as const;
type Glossary = { tag_type: TagKey; value: string }[];

export function ContentPipeline({ items, metrics, glossary, members, canEdit, me, campaigns }: {
  items: Content[]; metrics: Metric[]; glossary: Glossary; members: { id: string; full_name: string }[]; canEdit: boolean; me: string; campaigns: { id: string; name: string }[];
}) {
  const t = useTranslations("marketing.content");
  const locale = useLocale();
  const [view, setView] = useState<"pipeline" | "leaderboard">("pipeline");
  const [editing, setEditing] = useState<Content | "new" | null>(null);
  const [logging, setLogging] = useState<Content | null>(null);
  const h = useMemo(() => hits(items, metrics), [items, metrics]);
  const ranked = items.filter((c) => c.status === "posted").map((c) => {
    const m = bestMetric(c.id, metrics), x = h.find((y) => y.id === c.id);
    return { c, m, ssr: shareSaveRate(m), ratio: x?.ratio ?? null, hit: x?.hit ?? false };
  }).sort((a, b) => (b.ssr ?? -1) - (a.ssr ?? -1));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl bg-surface-2 p-1 text-sm" role="tablist" aria-label={t("view")}>
          <button role="tab" aria-selected={view === "pipeline"} onClick={() => setView("pipeline")} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 ${view === "pipeline" ? "bg-surface font-medium shadow-sm" : "text-muted"}`}><Rows3 size={14} /> {t("pipeline")}</button>
          <button role="tab" aria-selected={view === "leaderboard"} onClick={() => setView("leaderboard")} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 ${view === "leaderboard" ? "bg-surface font-medium shadow-sm" : "text-muted"}`}><LayoutGrid size={14} /> {t("leaderboard")}</button>
        </div>
        {canEdit && <button onClick={() => setEditing("new")} className="ml-auto flex items-center gap-1.5 rounded-xl bg-ink px-3 py-2 text-sm font-medium text-brand-contrast"><Plus size={15} /> {t("new")}</button>}
      </div>

      {view === "pipeline" ? (
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
          {STATUSES.map((s) => {
            const col = items.filter((c) => c.status === s).sort((a, b) => (a.planned_for ?? "9").localeCompare(b.planned_for ?? "9"));
            return (
              <section key={s} className="w-[78vw] max-w-[280px] shrink-0 snap-start rounded-[14px] bg-surface-2/60 p-2 lg:w-auto lg:max-w-none">
                <h3 className="flex items-center justify-between px-1.5 pt-1 pb-2 text-sm font-semibold">{t(`status.${s}`)} <span className="text-xs font-normal text-muted">{col.length}</span></h3>
                <ul className="space-y-2">
                  {col.map((c) => {
                    const m = bestMetric(c.id, metrics), x = h.find((y) => y.id === c.id);
                    return (
                      <li key={c.id}>
                        <button onClick={() => (canEdit ? setEditing(c) : undefined)} className="panel panel-lift w-full p-3 text-left text-sm">
                          <span className="block font-medium leading-snug">{c.title}</span>
                          <span className="mt-1 flex flex-wrap gap-1">{(["format", "hook_message"] as TagKey[]).filter((k) => c.tags?.[k]).map((k) => <span key={k} className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">{c.tags[k]}</span>)}</span>
                          <span className="mt-1.5 flex items-center gap-2 text-xs text-muted">
                            {c.posted_at ? shortDate(c.posted_at, locale) : c.planned_for ? shortDate(c.planned_for, locale) : ""}
                            {x?.hit && <span className="inline-flex items-center gap-0.5 text-ok-text"><Trophy size={11} /> {t("hit")}</span>}
                            {m && <span className="ml-auto tabular-nums">{m.views ?? "—"} 👁</span>}
                          </span>
                        </button>
                        {canEdit && c.status === "posted" && <button onClick={() => setLogging(c)} className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg py-1 text-[11px] text-muted hover:bg-surface hover:text-ink"><BarChart3 size={11} /> {t("logNumbers")}</button>}
                      </li>
                    );
                  })}
                  {!col.length && <li className="px-2 py-4 text-center text-xs text-muted">—</li>}
                </ul>
              </section>
            );
          })}
        </div>
      ) : ranked.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ranked.map(({ c, m, ssr, ratio, hit }, i) => (
            <li key={c.id} className="panel p-4">
              <div className="flex items-start gap-3">
                <span className={`readout grid size-9 shrink-0 place-items-center rounded-xl text-sm ${i < 3 ? "bg-ink text-brand-contrast" : "bg-surface-2"}`}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.title}</p>
                  <p className="text-xs text-muted">{c.tags?.format ?? c.platform}{c.tags?.hook_message ? ` · ${c.tags.hook_message}` : ""}</p>
                </div>
                {hit && <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--ok)_15%,transparent)] px-2 py-0.5 text-[11px] font-medium text-ok-text"><Trophy size={11} /> {t("winner")}</span>}
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div><dt className="text-muted">{t("views")}</dt><dd className="readout text-base">{m?.views ?? "—"}</dd></div>
                <div><dt className="text-muted">{t("vsMedian")}</dt><dd className={`readout text-base ${ratio !== null && ratio >= 2 ? "text-ok-text" : ""}`}>{ratio === null ? "—" : `${ratio.toFixed(1)}×`}</dd></div>
                <div><dt className="text-muted">{t("shareSave")}</dt><dd className="readout text-base">{ssr === null ? "—" : pct(ssr, locale)}</dd></div>
              </dl>
              {c.decision && <p className="mt-2 text-xs"><span className="rounded bg-surface-2 px-1.5 py-0.5 font-medium">{t(`decision.${c.decision}`)}</span></p>}
              {c.permalink && <a href={c.permalink} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-muted hover:text-ink"><ExternalLink size={11} /> {t("open")}</a>}
            </li>
          ))}
        </ul>
      ) : <p className="panel p-8 text-center text-sm text-muted">{t("noPosted")}</p>}

      {editing && <ContentForm item={editing === "new" ? null : editing} glossary={glossary} members={members} campaigns={campaigns} me={me} onClose={() => setEditing(null)} />}
      {logging && <MetricsForm item={logging} existing={metrics.filter((m) => m.content_id === logging.id)} onClose={() => setLogging(null)} />}
    </div>
  );
}

function ContentForm({ item, glossary, members, campaigns, me, onClose }: { item: Content | null; glossary: Glossary; members: { id: string; full_name: string }[]; campaigns: { id: string; name: string }[]; me: string; onClose: () => void }) {
  const t = useTranslations("marketing.content");
  const tt = useTranslations("marketing.tags");
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [v, setV] = useState({
    title: item?.title ?? "", platform: item?.platform ?? "instagram", status: item?.status ?? "idea", planned_for: item?.planned_for ?? "",
    permalink: item?.permalink ?? "", owner_id: item?.owner_id ?? me, campaign_id: item?.campaign_id ?? "", decision: item?.decision ?? "",
    decision_why: (item as unknown as { decision_why?: string })?.decision_why ?? "", tags: { ...(item?.tags ?? {}) } as Partial<Record<TagKey, string>>,
  });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (v.status === "posted" && (!v.tags.format || !v.tags.hook_message || !v.tags.channel)) return toast("error", t("needTags"));
    const row = { title: v.title.trim(), platform: v.platform, status: v.status, planned_for: v.planned_for || null, permalink: v.permalink.trim() || null,
      owner_id: v.owner_id || null, campaign_id: v.campaign_id || null, decision: v.decision || null, decision_why: v.decision_why.trim() || null, tags: v.tags,
      posted_at: v.status === "posted" ? ((item?.posted_at as string | null) ?? new Date().toISOString()) : null };
    const { error } = item ? await supabase.from("content_items").update(row).eq("id", item.id) : await supabase.from("content_items").insert(row);
    if (error) return toast("error", t("saveError"));
    toast("ok", t("saved")); onClose(); router.refresh();
  }
  const sel = "input";
  return (
    <Modal title={item ? t("edit") : t("new")} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <input autoFocus required value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder={t("titlePlaceholder")} aria-label={t("title")} className="input" />
        <div className="grid grid-cols-2 gap-2">
          <select value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })} className={sel} aria-label={t("statusLabel")}>{STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}</select>
          <input type="date" value={v.planned_for} onChange={(e) => setV({ ...v, planned_for: e.target.value })} className={sel} aria-label={t("planned")} />
          <select value={v.platform} onChange={(e) => setV({ ...v, platform: e.target.value })} className={sel} aria-label={t("platform")}>{["instagram", "tiktok", "other"].map((p) => <option key={p}>{p}</option>)}</select>
          <select value={v.owner_id} onChange={(e) => setV({ ...v, owner_id: e.target.value })} className={sel} aria-label={t("owner")}>{members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select>
        </div>
        <fieldset className="rounded-xl bg-surface-2/50 p-3">
          <legend className="px-1 text-xs font-medium text-muted">{t("tagsTitle")}</legend>
          <div className="grid grid-cols-2 gap-2">
            {TAG_KEYS.map((k) => (
              <label key={k} className="block"><span className="mb-0.5 block text-[11px] text-muted">{tt(k)}{["format", "hook_message", "channel"].includes(k) ? " *" : ""}</span>
                <select value={v.tags[k] ?? ""} onChange={(e) => setV({ ...v, tags: { ...v.tags, [k]: e.target.value || undefined } })} className="input py-1.5 text-sm">
                  <option value="">—</option>{glossary.filter((g) => g.tag_type === k).map((g) => <option key={g.value} value={g.value}>{g.value}</option>)}
                </select></label>
            ))}
          </div>
        </fieldset>
        <select value={v.campaign_id} onChange={(e) => setV({ ...v, campaign_id: e.target.value })} className={sel} aria-label={t("campaign")}><option value="">{t("noCampaign")}</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        {v.status === "posted" && <>
          <input value={v.permalink} onChange={(e) => setV({ ...v, permalink: e.target.value })} placeholder={t("permalink")} aria-label={t("permalink")} className="input" />
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <select value={v.decision} onChange={(e) => setV({ ...v, decision: e.target.value })} className={sel} aria-label={t("decisionLabel")}><option value="">{t("decisionNone")}</option>{["scale", "iterate", "kill"].map((d) => <option key={d} value={d}>{t(`decision.${d}`)}</option>)}</select>
            <input value={v.decision_why} onChange={(e) => setV({ ...v, decision_why: e.target.value })} placeholder={t("why")} aria-label={t("why")} className="input" />
          </div>
        </>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-muted">{t("cancel")}</button>
          <button className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-contrast">{t("save")}</button>
        </div>
      </form>
    </Modal>
  );
}

function MetricsForm({ item, existing, onClose }: { item: Content; existing: Metric[]; onClose: () => void }) {
  const t = useTranslations("marketing.content");
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [age, setAge] = useState<24 | 48 | 168>(existing.some((m) => m.age_hours === 168) ? 168 : existing.some((m) => m.age_hours === 48) ? 168 : existing.some((m) => m.age_hours === 24) ? 48 : 24);
  const cur = existing.find((m) => m.age_hours === age);
  const fields = ["views", "reach", "likes", "comments", "saves", "shares", "profile_visits", "link_clicks"] as const;
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f, cur?.[f] != null ? String(cur[f]) : ""])));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const row = { content_id: item.id, age_hours: age, source: "manual", ...Object.fromEntries(fields.map((f) => [f, v[f] === "" ? null : Number(v[f])])) };
    const { error } = await supabase.from("content_metrics").upsert(row, { onConflict: "content_id,age_hours" });
    if (error) return toast("error", t("saveError"));
    toast("ok", t("saved")); onClose(); router.refresh();
  }
  return (
    <Modal title={t("logNumbersFor", { title: item.title })} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1 text-sm">
          {([24, 48, 168] as const).map((a) => <button key={a} type="button" onClick={() => setAge(a)} aria-pressed={age === a} className={`rounded-lg py-1.5 ${age === a ? "bg-surface font-medium shadow-sm" : "text-muted"}`}>{t(`age.${a}`)}</button>)}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {fields.map((f) => <label key={f} className="block"><span className="mb-0.5 block text-xs text-muted">{t(`m.${f}`)}</span>
            <input type="number" min="0" inputMode="numeric" value={v[f]} onChange={(e) => setV({ ...v, [f]: e.target.value })} className="input" /></label>)}
        </div>
        <p className="text-xs text-muted">{t("whereNumbers")}</p>
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-muted">{t("cancel")}</button>
          <button className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-contrast">{t("save")}</button></div>
      </form>
    </Modal>
  );
}
