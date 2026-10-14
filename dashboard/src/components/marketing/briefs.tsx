"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Plus, CheckCircle2, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { Modal } from "@/components/data-table";
import { shortDate } from "@/lib/format";
import type { Campaign } from "./campaigns";

type Person = { id: string; full_name: string };
export type Brief = {
  id: string; title: string; goal: string | null; audience: string | null; hypothesis: string | null; message: string | null; reason_to_believe: string | null;
  hooks: string[]; customer_quote: string | null; refs: string | null; driver_id: string | null; approver_id: string | null; status: string; campaign_id: string | null; created_at: string;
};
const BRIEF_STATUSES = ["draft", "approved", "production", "live", "reviewed"] as const;

/** Briefs: one page per idea, one approver (the marketing leader). Approved briefs turn into content in one click. */
export function Briefs({ briefs, members, campaigns, canEdit, me, leaderId }: { briefs: Brief[]; members: Person[]; campaigns: Campaign[]; canEdit: boolean; me: string; leaderId: string | null }) {
  const t = useTranslations("marketing.briefs");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [editing, setEditing] = useState<Brief | "new" | null>(null);
  const name = (id: string | null) => members.find((m) => m.id === id)?.full_name ?? "—";

  async function approve(b: Brief) {
    const { error } = await supabase.from("briefs").update({ status: "approved", approver_id: me }).eq("id", b.id);
    if (error) return toast("error", t("saveError"));
    toast("ok", t("approved")); router.refresh();
  }
  async function toContent(b: Brief) {
    const { error } = await supabase.from("content_items").insert({ title: b.title, brief_id: b.id, campaign_id: b.campaign_id, status: "briefed", owner_id: b.driver_id ?? me });
    if (error) return toast("error", t("saveError"));
    if (b.status === "approved") await supabase.from("briefs").update({ status: "production" }).eq("id", b.id);
    toast("ok", t("contentCreated")); router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted">{t("intro")}</p>
        {canEdit && <button onClick={() => setEditing("new")} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-ink px-3 py-2 text-sm font-medium text-brand-contrast"><Plus size={15} /> {t("new")}</button>}
      </div>
      {briefs.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {briefs.map((b) => (
            <li key={b.id} className="panel p-4">
              <div className="flex items-start justify-between gap-2">
                <button onClick={() => canEdit && setEditing(b)} className="min-w-0 text-left"><p className="font-medium">{b.title}</p>
                  <p className="text-xs text-muted">{t("driver")}: {name(b.driver_id)} · {shortDate(b.created_at, locale)}</p></button>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${b.status === "draft" ? "bg-surface-2 text-muted" : "bg-[color-mix(in_srgb,var(--ok)_15%,transparent)] text-ok-text"}`}>{t(`status.${b.status}`)}</span>
              </div>
              {b.hypothesis && <p className="mt-2 text-sm"><span className="text-muted">{t("hypothesis")}:</span> {b.hypothesis}</p>}
              {b.message && <p className="mt-1 text-sm"><span className="text-muted">{t("message")}:</span> {b.message}</p>}
              {canEdit && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {b.status === "draft" && (me === leaderId || !leaderId) && <button onClick={() => approve(b)} className="flex items-center gap-1 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs font-medium"><CheckCircle2 size={13} /> {t("approve")}</button>}
                  {b.status === "draft" && leaderId && me !== leaderId && <span className="text-xs text-muted">{t("waiting", { name: name(leaderId) })}</span>}
                  {b.status !== "draft" && <button onClick={() => toContent(b)} className="flex items-center gap-1 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs font-medium"><Sparkles size={13} /> {t("toContent")}</button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : <p className="panel p-8 text-center text-sm text-muted">{t("empty")}</p>}
      {editing && <BriefForm brief={editing === "new" ? null : editing} members={members} campaigns={campaigns} me={me} onClose={() => setEditing(null)} />}
    </div>
  );
}

function BriefForm({ brief, members, campaigns, me, onClose }: { brief: Brief | null; members: Person[]; campaigns: Campaign[]; me: string; onClose: () => void }) {
  const t = useTranslations("marketing.briefs");
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [v, setV] = useState({
    title: brief?.title ?? "", goal: brief?.goal ?? "", audience: brief?.audience ?? "", hypothesis: brief?.hypothesis ?? "", message: brief?.message ?? "",
    reason_to_believe: brief?.reason_to_believe ?? "", hooks: (brief?.hooks ?? []).join("\n"), customer_quote: brief?.customer_quote ?? "", refs: brief?.refs ?? "",
    driver_id: brief?.driver_id ?? me, campaign_id: brief?.campaign_id ?? "", status: brief?.status ?? "draft",
  });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const s = (x: string) => x.trim() || null;
    const row = { title: v.title.trim(), goal: s(v.goal), audience: s(v.audience), hypothesis: s(v.hypothesis), message: s(v.message), reason_to_believe: s(v.reason_to_believe),
      hooks: v.hooks.split("\n").map((h) => h.trim()).filter(Boolean), customer_quote: s(v.customer_quote), refs: s(v.refs), driver_id: v.driver_id || null,
      campaign_id: v.campaign_id || null, ...(brief ? { status: v.status } : {}) };
    const { error } = brief ? await supabase.from("briefs").update(row).eq("id", brief.id) : await supabase.from("briefs").insert(row);
    if (error) return toast("error", t("saveError"));
    toast("ok", t("saved")); onClose(); router.refresh();
  }
  const area = (k: keyof typeof v, rows = 2) => (
    <label className="block"><span className="mb-0.5 block text-xs text-muted">{t(k)}</span>
      <textarea rows={rows} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} placeholder={t(`ph.${k}`)} className="input" /></label>
  );
  return (
    <Modal title={brief ? t("edit") : t("new")} onClose={onClose} wide>
      <form onSubmit={save} className="space-y-3">
        <input autoFocus required value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder={t("ph.title")} aria-label={t("title")} className="input" />
        <div className="grid gap-3 sm:grid-cols-2">{area("goal")}{area("audience")}</div>
        {area("hypothesis")}
        <div className="grid gap-3 sm:grid-cols-2">{area("message")}{area("reason_to_believe")}</div>
        <div className="grid gap-3 sm:grid-cols-2">{area("hooks", 3)}{area("customer_quote", 3)}</div>
        {area("refs")}
        <div className="grid grid-cols-2 gap-2">
          <select value={v.driver_id} onChange={(e) => setV({ ...v, driver_id: e.target.value })} className="input" aria-label={t("driver")}>{members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select>
          <select value={v.campaign_id} onChange={(e) => setV({ ...v, campaign_id: e.target.value })} className="input" aria-label={t("campaign")}><option value="">{t("noCampaign")}</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          {brief && <select value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })} className="input col-span-2" aria-label={t("statusLabel")}>{BRIEF_STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}</select>}
        </div>
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-muted">{t("cancel")}</button>
          <button className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-contrast">{t("save")}</button></div>
      </form>
    </Modal>
  );
}
