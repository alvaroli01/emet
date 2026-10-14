"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Plus, ClipboardCheck, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { Modal } from "@/components/data-table";
import { eur, pct, shortDate } from "@/lib/format";
import { bestMetric, hits, shareSaveRate, type Content, type Metric } from "@/lib/marketing";

type Person = { id: string; full_name: string };
export type Campaign = {
  id: string; name: string; product: string | null; status: string; starts_on: string | null; ends_on: string | null; owner_id: string | null; notes: string | null;
  objective: string | null; target_metric: string | null; target_value: number | null; budget: number | null; postmortem: { worked?: string; didnt?: string; next?: string; result?: number | null } | null;
};

/** Campaigns with an objective + target, and a post-mortem prefilled from the campaign's own content numbers. */
export function Campaigns({ title, campaigns, items, metrics, members, canEdit, me }: {
  title: string; campaigns: Campaign[]; items: Content[]; metrics: Metric[]; members: Person[]; canEdit: boolean; me: string;
}) {
  const t = useTranslations("marketing.campaigns");
  const locale = useLocale();
  const [editing, setEditing] = useState<Campaign | "new" | null>(null);
  const [review, setReview] = useState<Campaign | null>(null);
  const h = useMemo(() => hits(items, metrics), [items, metrics]);
  const stats = (c: Campaign) => {
    const own = items.filter((x) => x.campaign_id === c.id);
    const posted = own.filter((x) => x.status === "posted");
    const views = posted.reduce((a, x) => a + (bestMetric(x.id, metrics)?.views ?? 0), 0);
    return { posts: posted.length, planned: own.length, views, hits: posted.filter((x) => h.find((y) => y.id === x.id)?.hit).length };
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">{title}</h3>{canEdit && <button onClick={() => setEditing("new")} className="flex items-center gap-1.5 rounded-xl bg-ink px-3 py-2 text-sm font-medium text-brand-contrast"><Plus size={15} /> {t("new")}</button>}</div>
      {campaigns.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {campaigns.map((c) => {
            const s = stats(c);
            return (
              <li key={c.id} className="panel p-4">
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => canEdit && setEditing(c)} className="min-w-0 text-left"><p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted">{c.starts_on ? shortDate(c.starts_on, locale) : "—"} → {c.ends_on ? shortDate(c.ends_on, locale) : "—"}{c.budget ? ` · ${eur(Number(c.budget), locale)}` : ""}</p></button>
                  <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium">{t(`status.${c.status}`)}</span>
                </div>
                {c.objective && <p className="mt-2 flex items-start gap-1.5 text-sm"><Target size={14} className="mt-0.5 shrink-0 text-muted" />{c.objective}{c.target_metric && <span className="text-muted"> · {c.target_metric}{c.target_value != null ? ` ≥ ${c.target_value}` : ""}</span>}</p>}
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div><dt className="text-muted">{t("posts")}</dt><dd className="readout text-base">{s.posts}/{s.planned}</dd></div>
                  <div><dt className="text-muted">{t("views")}</dt><dd className="readout text-base">{s.views}</dd></div>
                  <div><dt className="text-muted">{t("hits")}</dt><dd className="readout text-base">{s.hits}</dd></div>
                </dl>
                {c.postmortem ? <p className="mt-2 text-xs text-muted"><ClipboardCheck size={12} className="mr-1 inline" />{t("reviewed")}{c.postmortem.next ? ` — ${c.postmortem.next}` : ""}</p>
                  : canEdit && c.status === "done" && <button onClick={() => setReview(c)} className="mt-3 flex items-center gap-1 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs font-medium"><ClipboardCheck size={13} /> {t("writeReview")}</button>}
              </li>
            );
          })}
        </ul>
      ) : <p className="panel p-8 text-center text-sm text-muted">{t("empty")}</p>}
      {editing && <CampaignForm c={editing === "new" ? null : editing} members={members} me={me} onClose={() => setEditing(null)} />}
      {review && <Postmortem c={review} s={stats(review)} items={items.filter((x) => x.campaign_id === review.id)} metrics={metrics} onClose={() => setReview(null)} />}
    </div>
  );
}

function CampaignForm({ c, members, me, onClose }: { c: Campaign | null; members: Person[]; me: string; onClose: () => void }) {
  const t = useTranslations("marketing.campaigns");
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [v, setV] = useState({ name: c?.name ?? "", product: c?.product ?? "", status: c?.status ?? "planned", starts_on: c?.starts_on ?? "", ends_on: c?.ends_on ?? "",
    owner_id: c?.owner_id ?? me, objective: c?.objective ?? "", target_metric: c?.target_metric ?? "", target_value: c?.target_value != null ? String(c.target_value) : "", budget: c?.budget ? String(c.budget) : "" });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const row = { name: v.name.trim(), product: v.product.trim() || null, status: v.status, starts_on: v.starts_on || null, ends_on: v.ends_on || null, owner_id: v.owner_id || null,
      objective: v.objective.trim() || null, target_metric: v.target_metric.trim() || null, target_value: v.target_value === "" ? null : Number(v.target_value), budget: v.budget === "" ? 0 : Number(v.budget) };
    const { error } = c ? await supabase.from("campaigns").update(row).eq("id", c.id) : await supabase.from("campaigns").insert(row);
    if (error) return toast("error", t("saveError"));
    toast("ok", t("saved")); onClose(); router.refresh();
  }
  const inp = (k: keyof typeof v, type = "text") => <label className="block"><span className="mb-0.5 block text-xs text-muted">{t(`f.${k}`)}</span>
    <input type={type} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} className="input" {...(type === "number" ? { min: 0, step: "any", inputMode: "decimal" as const } : {})} /></label>;
  return (
    <Modal title={c ? t("edit") : t("new")} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <label className="block"><span className="mb-0.5 block text-xs text-muted">{t("f.name")}</span><input autoFocus required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className="input" /></label>
        {inp("objective")}
        <div className="grid grid-cols-2 gap-2">{inp("target_metric")}{inp("target_value", "number")}{inp("starts_on", "date")}{inp("ends_on", "date")}{inp("product")}{inp("budget", "number")}
          <label className="block"><span className="mb-0.5 block text-xs text-muted">{t("f.status")}</span><select value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })} className="input">{["planned", "live", "done"].map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}</select></label>
          <label className="block"><span className="mb-0.5 block text-xs text-muted">{t("f.owner_id")}</span><select value={v.owner_id} onChange={(e) => setV({ ...v, owner_id: e.target.value })} className="input">{members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select></label>
        </div>
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-muted">{t("cancel")}</button>
          <button className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-contrast">{t("save")}</button></div>
      </form>
    </Modal>
  );
}

function Postmortem({ c, s, items, metrics, onClose }: { c: Campaign; s: { posts: number; views: number; hits: number }; items: Content[]; metrics: Metric[]; onClose: () => void }) {
  const t = useTranslations("marketing.campaigns");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const best = items.filter((x) => x.status === "posted").map((x) => ({ x, r: shareSaveRate(bestMetric(x.id, metrics)) })).filter((y) => y.r !== null).sort((a, b) => b.r! - a.r!);
  const [v, setV] = useState({
    worked: best[0] ? t("pm.bestWas", { title: best[0].x.title, rate: pct(best[0].r, locale) }) : "",
    didnt: best.length > 1 ? t("pm.worstWas", { title: best[best.length - 1].x.title, rate: pct(best[best.length - 1].r, locale) }) : "",
    next: "", result: "",
  });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("campaigns").update({ postmortem: { worked: v.worked.trim(), didnt: v.didnt.trim(), next: v.next.trim(), result: v.result === "" ? null : Number(v.result) } }).eq("id", c.id);
    if (error) return toast("error", t("saveError"));
    toast("ok", t("saved")); onClose(); router.refresh();
  }
  return (
    <Modal title={t("reviewOf", { name: c.name })} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <p className="rounded-xl bg-surface-2/60 p-3 text-sm">{t("pm.summary", { posts: s.posts, views: s.views, hits: s.hits })}
          {c.target_metric && <><br /><span className="text-muted">{t("pm.target", { metric: c.target_metric, value: c.target_value ?? "—" })}</span></>}</p>
        {c.target_metric && <label className="block"><span className="mb-0.5 block text-xs text-muted">{t("pm.result")}</span><input type="number" step="any" value={v.result} onChange={(e) => setV({ ...v, result: e.target.value })} className="input" /></label>}
        {(["worked", "didnt", "next"] as const).map((k) => <label key={k} className="block"><span className="mb-0.5 block text-xs text-muted">{t(`pm.${k}`)}</span>
          <textarea required={k === "next"} rows={2} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} className="input" /></label>)}
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-muted">{t("cancel")}</button>
          <button className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-contrast">{t("save")}</button></div>
      </form>
    </Modal>
  );
}
