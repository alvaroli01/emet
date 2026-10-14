"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Copy, Download, ExternalLink, Globe2, AtSign, Loader2, MapPin, Phone, Search, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { Modal } from "@/components/data-table";
import { shortDate } from "@/lib/format";
import type { ScoutLead, ScoutProject } from "./scout";

type Person = { id: string; full_name: string };
const STATUSES = ["new", "contacted", "meeting", "won", "lost", "ignored"] as const;
const FITS = ["strong", "good", "maybe", "skip"] as const;
const fitTone: Record<string, string> = { strong: "bg-climbed text-brand-contrast", good: "bg-[color-mix(in_srgb,var(--climbed)_18%,transparent)] text-ink", maybe: "bg-surface-2 text-muted", skip: "bg-surface-2 text-muted line-through decoration-1" };

export function Leads({ leads, members, canScout, meId, project, onChecked, hasKey }: { leads: ScoutLead[]; members: Person[]; canScout: boolean; meId: string; project: ScoutProject; onChecked: () => void; hasKey: boolean }) {
  const t = useTranslations("scout.leads");
  const tf = useTranslations("scout.fit");
  const ts = useTranslations("scout.status");
  const [fit, setFit] = useState<"worth" | "all" | "skip">("worth");
  const [status, setStatus] = useState<string>("");
  const [mine, setMine] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const shown = leads.filter((l) => (fit === "all" ? true : fit === "worth" ? l.fit === "strong" || l.fit === "good" : l.fit === "maybe" || l.fit === "skip"))
    .filter((l) => !status || l.status === status).filter((l) => !mine || l.owner_id === meId);
  const counts = Object.fromEntries(FITS.map((f) => [f, leads.filter((l) => l.fit === f).length]));
  const lead = leads.find((l) => l.id === open) ?? null;

  function exportCsv() {
    const head = ["name", "score", "fit", "worth_it", "status", "owner", "address", "website", "instagram", "phone", "attack_with", "channel", "opener", "why"];
    const q = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const rows = shown.map((l) => [l.place.name, l.score, l.fit, l.worth_it, l.status, members.find((m) => m.id === l.owner_id)?.full_name, l.place.address, l.place.website, l.place.instagram, l.place.phone, l.attack_with, l.approach?.channel, l.approach?.opener, l.why].map(q).join(","));
    const blob = new Blob(["﻿" + [head.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `scout-${project.title.replace(/\W+/g, "-").toLowerCase()}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }

  return (
    <section className="space-y-3">
      {canScout && <CheckPlace project={project} onDone={(id) => { onChecked(); setOpen(id); }} hasKey={hasKey} />}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-lg font-semibold">{t("title")} <span className="text-sm font-normal text-muted">{t("summary", { strong: counts.strong, good: counts.good, rest: counts.maybe + counts.skip })}</span></h2>
        <div className="flex rounded-xl bg-surface-2 p-1 text-sm" role="tablist" aria-label={t("filter")}>
          {(["worth", "all", "skip"] as const).map((f) => <button key={f} role="tab" aria-selected={fit === f} onClick={() => setFit(f)} className={`rounded-lg px-3 py-1.5 ${fit === f ? "bg-surface font-medium shadow-sm" : "text-muted"}`}>{t(`f.${f}`)}</button>)}
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input w-auto py-2 text-sm" aria-label={t("statusFilter")}>
          <option value="">{t("anyStatus")}</option>{STATUSES.map((s) => <option key={s} value={s}>{ts(s)}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-muted"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> {t("mine")}</label>
        {shown.length > 0 && <button onClick={exportCsv} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-ink"><Download size={15} /> CSV</button>}
      </div>

      {shown.length ? (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((l) => (
            <li key={l.id}>
              <button onClick={() => setOpen(l.id)} className="panel panel-lift flex h-full w-full flex-col gap-2 p-4 text-left">
                <div className="flex items-start gap-3">
                  <Dial score={l.score ?? 0} fit={l.fit ?? "maybe"} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{l.place.name}</p>
                    <p className="truncate text-xs text-muted">{[l.place.category?.split("=")[1]?.replace(/_/g, " "), l.place.address].filter(Boolean).join(" · ") || l.place.city}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className={`rounded-full px-2 py-0.5 font-medium ${fitTone[l.fit ?? "maybe"]}`}>{tf(l.fit ?? "maybe")}</span>
                      {l.status !== "new" && <span className="rounded-full bg-surface-2 px-2 py-0.5">{ts(l.status)}</span>}
                      {l.owner_id && <span className="text-muted">{members.find((m) => m.id === l.owner_id)?.full_name}</span>}
                    </p>
                  </div>
                </div>
                {l.attack_with && (l.fit === "strong" || l.fit === "good") ? <p className="text-sm"><span className="text-muted">{t("offer")}</span> {l.attack_with}</p> : l.why && <p className="line-clamp-2 text-sm text-muted">{l.why}</p>}
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="panel p-8 text-center text-sm text-muted">{leads.length ? t("noneFiltered") : t("none")}</p>}

      {lead && <LeadDetail lead={lead} members={members} canEdit={canScout || lead.owner_id === meId} canScout={canScout} meId={meId} onClose={() => setOpen(null)} />}
    </section>
  );
}

/** Score as a small arc dial — the number is what matters, the arc makes the list scannable. */
function Dial({ score, fit }: { score: number; fit: string }) {
  const r = 17, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, score / 100));
  const stroke = fit === "strong" || fit === "good" ? "var(--climbed)" : "var(--muted)";
  return (
    <span className="relative grid size-11 shrink-0 place-items-center">
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="20" cy="20" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="3.5" />
        <circle cx="20" cy="20" r={r} fill="none" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${c * f} ${c}`} />
      </svg>
      <span className="readout text-sm">{score}</span>
    </span>
  );
}

function CheckPlace({ project, onDone, hasKey }: { project: ScoutProject; onDone: (leadId: string) => void; hasKey: boolean }) {
  const tk = useTranslations("scout.check");
  const toast = useToast();
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  async function check(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch("/api/scout/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project_id: project.id, input: v }) }).catch(() => null);
      const j = await res?.json().catch(() => ({}));
      if (res?.status === 429) { toast("ok", tk("waiting", { s: j.retryAfter ?? 60 })); await new Promise((r) => setTimeout(r, Math.min(90, j.retryAfter ?? 60) * 1000)); continue; }
      setBusy(false);
      if (!res?.ok) return toast("error", tk(j?.error === "unreadable-link" ? "unreadable" : j?.error === "forgotten" ? "forgotten" : j?.error === "no-key" ? "needKey" : "error"));
      setV(""); toast("ok", tk("done")); return onDone(j.lead.id);
    }
    setBusy(false);
  }
  return (
    <form onSubmit={check} className="panel flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
      <label htmlFor="scout-check" className="shrink-0 text-sm font-medium">{tk("label")}</label>
      <input id="scout-check" value={v} onChange={(e) => setV(e.target.value)} placeholder={tk("placeholder")} className="input min-w-0 flex-1" disabled={busy || !hasKey} required />
      <button disabled={busy || !v.trim() || !hasKey} className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-brand-contrast disabled:opacity-60">
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} {busy ? tk("checking") : tk("button")}
      </button>
    </form>
  );
}

function LeadDetail({ lead, members, canEdit, canScout, meId, onClose }: { lead: ScoutLead; members: Person[]; canEdit: boolean; canScout: boolean; meId: string; onClose: () => void }) {
  const t = useTranslations("scout.leads");
  const tc = useTranslations("scout.criteria");
  const tf = useTranslations("scout.fit");
  const ts = useTranslations("scout.status");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const p = lead.place;
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([p.name, p.address ?? p.city].filter(Boolean).join(" "))}`;

  async function patch(row: Record<string, unknown>) {
    const { error } = await supabase.from("scout_leads").update(row).eq("id", lead.id);
    if (error) return toast("error", t("saveError"));
    router.refresh();
  }
  async function setStatus(s: string) {
    // First contact also puts the place into the Customer pipeline, so selling continues in one place
    if (s === "contacted" && !lead.prospect_id) {
      const { data } = await supabase.from("prospects").insert({ name: p.name, contact: [p.phone, p.instagram, p.website].filter(Boolean).join(" · ") || null, stage: "contacted", owner_id: lead.owner_id ?? meId }).select("id").single();
      await patch({ status: s, prospect_id: data?.id ?? null, owner_id: lead.owner_id ?? meId });
      toast("ok", data ? t("toProspect") : t("statusSaved"));
      return;
    }
    await patch({ status: s }); toast("ok", t("statusSaved"));
  }
  async function forget() {
    if (!confirm(t("forgetConfirm"))) return;
    // Keep only the fingerprint so the place never comes back; wipe its data and judgements
    const { error } = await supabase.from("scout_places").update({ forgotten: true, name: "—", address: null, website: null, phone: null, instagram: null, email_public: null, opening_hours: null, lat: null, lng: null }).eq("id", p.id);
    if (error) return toast("error", t("saveError"));
    await supabase.from("scout_research").delete().eq("place_id", p.id);
    await supabase.from("scout_leads").delete().eq("place_id", p.id);
    toast("ok", t("forgotten")); onClose(); router.refresh();
  }

  return (
    <Modal title={p.name} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Dial score={lead.score ?? 0} fit={lead.fit ?? "maybe"} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 font-medium">{lead.worth_it ? <CheckCircle2 size={16} className="text-ok-text" /> : <XCircle size={16} className="text-muted" />}
              {lead.worth_it ? t("worth") : t("notWorth")} <span className={`rounded-full px-2 py-0.5 text-[11px] ${fitTone[lead.fit ?? "maybe"]}`}>{tf(lead.fit ?? "maybe")}</span></p>
            {lead.why && <p className="mt-0.5 text-sm text-muted">{lead.why}</p>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          <a href={maps} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2.5 py-1.5"><MapPin size={14} /> {t("openMaps")}</a>
          {p.website && <a href={p.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2.5 py-1.5"><Globe2 size={14} /> {t("website")}</a>}
          {p.instagram && <a href={p.instagram} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2.5 py-1.5"><AtSign size={14} /> Instagram</a>}
          {p.phone && <a href={`tel:${p.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2.5 py-1.5"><Phone size={14} /> {p.phone}</a>}
          {p.opening_hours && <span className="inline-flex items-center rounded-lg px-2.5 py-1.5 text-muted">{p.opening_hours}</span>}
        </div>

        {lead.approach && (
          <section className="rounded-xl border border-line p-4">
            <h3 className="text-sm font-semibold">{t("howTitle")}</h3>
            <dl className="mt-2 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
              <div><dt className="text-xs text-muted">{t("offerLong")}</dt><dd>{lead.attack_with || "—"}</dd></div>
              <div><dt className="text-xs text-muted">{t("channel")}</dt><dd>{t.has(`channels.${lead.approach.channel}`) ? t(`channels.${lead.approach.channel}`) : lead.approach.channel}</dd></div>
              <div><dt className="text-xs text-muted">{t("whoWhen")}</dt><dd>{[lead.approach.who_to_ask_for, lead.approach.best_time].filter(Boolean).join(" — ")}</dd></div>
            </dl>
            <div className="mt-3 rounded-lg bg-surface-2/60 p-3 text-sm">
              <div className="mb-1 flex items-center justify-between"><span className="text-xs text-muted">{t("opener")}</span>
                <button onClick={() => { navigator.clipboard.writeText(lead.approach!.opener); toast("ok", t("copied")); }} className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"><Copy size={12} /> {t("copy")}</button></div>
              <p className="whitespace-pre-wrap">{lead.approach.opener}</p>
            </div>
            {lead.approach.objections.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-sm">{lead.approach.objections.map((o) => <li key={o.objection}><span className="font-medium">“{o.objection}”</span> <span className="text-muted">— {o.answer}</span></li>)}</ul>
            )}
            {lead.approach.channel === "email" && <p className="mt-2 text-xs text-warn-text">{t("emailWarning")}</p>}
          </section>
        )}

        {lead.criteria && (
          <section>
            <h3 className="mb-2 text-sm font-semibold">{t("whyScore")}</h3>
            <ul className="space-y-2">
              {lead.criteria.map((c) => (
                <li key={c.key} className="grid grid-cols-[7.5rem_1fr] items-start gap-3 text-sm sm:grid-cols-[9rem_4rem_1fr]">
                  <span className="text-muted">{tc(c.key)}</span>
                  <span className="hidden h-1.5 self-center overflow-hidden rounded-full bg-surface-2 sm:block"><span className="block h-full rounded-full bg-series-1" style={{ width: `${c.score * 10}%` }} /></span>
                  <span className="col-start-2 sm:col-start-3"><span className="readout mr-1">{c.score}</span>{c.why}{c.source && <a href={c.source} target="_blank" rel="noopener noreferrer" className="ml-1 text-climbed"><ExternalLink size={11} className="inline" /></a>}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {lead.signals.length > 0 && (
          <section>
            <h3 className="mb-1.5 text-sm font-semibold">{t("evidence")}</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">{lead.signals.map((s) => <li key={s.text}>{s.text}{s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" className="ml-1 text-climbed"><ExternalLink size={11} className="inline" /></a>}</li>)}</ul>
          </section>
        )}

        <section className="grid gap-2 border-t border-line pt-4 sm:grid-cols-3">
          <label className="block"><span className="mb-0.5 block text-xs text-muted">{t("statusLabel")}</span>
            <select value={lead.status} onChange={(e) => setStatus(e.target.value)} disabled={!canEdit} className="input">{STATUSES.map((s) => <option key={s} value={s}>{ts(s)}</option>)}</select></label>
          <label className="block"><span className="mb-0.5 block text-xs text-muted">{t("owner")}</span>
            <select value={lead.owner_id ?? ""} onChange={(e) => patch({ owner_id: e.target.value || null })} disabled={!canScout} className="input"><option value="">—</option>{members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select></label>
          <label className="block"><span className="mb-0.5 block text-xs text-muted">{t("nextStep")}</span>
            <input type="date" value={lead.next_step_at ?? ""} onChange={(e) => patch({ next_step_at: e.target.value || null })} disabled={!canEdit} className="input" /></label>
        </section>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>{t("found", { date: shortDate(lead.created_at, locale), source: t(`sources.${p.source}`) })}</span>
          {canScout && <button onClick={forget} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-surface-2 hover:text-bad-text"><Trash2 size={12} /> {t("forget")}</button>}
        </div>
      </div>
    </Modal>
  );
}
