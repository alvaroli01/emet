"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AtSign, Globe2, MapPin, Phone, Radar, Plus, Check, Trash2, Undo2, Store } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { shortDate } from "@/lib/format";
import { mapsLink } from "@/lib/scout/core";
import { byVisit, VISIT_RESULTS, type VisitFilter, type VisitResult } from "@/lib/visits";

type Visit = { visited_on: string | null; visit_result: VisitResult | null; visit_note: string | null };
export type ProjectLead = Visit & { id: string; score: number | null; fit: string | null; status: string; evidence: string | null; why: string | null; scout_project_id: string;
  place: { name: string; address: string | null; city: string | null; lat: number | null; lng: number | null; website: string | null; instagram: string | null; phone: string | null; maps_url: string | null } };
/** A business someone in the project found themselves (not through Scout). */
export type ProjectPlace = Visit & { id: string; name: string; address: string | null; contact: string | null; note: string | null; added_by: string | null; created_at: string };

const FIT = { strong: "bg-ok/15 text-ok-text", good: "bg-[#3b82f6]/20 text-[#93c5fd]", maybe: "bg-warn/15 text-warn-text", skip: "bg-surface-2 text-muted" } as Record<string, string>;
const RESULT = { yes: "bg-ok/15 text-ok-text", maybe: "bg-warn/15 text-warn-text", no: "bg-bad/15 text-bad-text" } as const;

type Item = Visit & { key: string; id: string; kind: "scout" | "own"; name: string; sub: string | null; lead?: ProjectLead; place?: ProjectPlace };

/** A project's leads: places found with Scout and places people found themselves, each marked visited (and how it
 *  went) once someone has been there. */
export function ProjectLeads({ leads, places, projectId, meId, names, today }: {
  leads: ProjectLead[]; places: ProjectPlace[]; projectId: string; meId: string; names: Record<string, string>; today: string;
}) {
  const t = useTranslations("projects.leads");
  const tf = useTranslations("scout.fit");
  const ts = useTranslations("scout.status");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [filter, setFilter] = useState<VisitFilter>("all");
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: "", address: "", contact: "", note: "" });
  const [visiting, setVisiting] = useState<string | null>(null);
  const [v, setV] = useState({ on: today, result: "yes" as VisitResult, note: "", point: true });
  const chip = "inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-xs hover:bg-line";

  const items: Item[] = [
    ...places.map((p) => ({ key: `own:${p.id}`, id: p.id, kind: "own" as const, name: p.name, sub: p.address, visited_on: p.visited_on, visit_result: p.visit_result, visit_note: p.visit_note, place: p })),
    ...leads.map((l) => ({ key: `scout:${l.id}`, id: l.id, kind: "scout" as const, name: l.place.name, sub: l.place.address ?? l.place.city, visited_on: l.visited_on, visit_result: l.visit_result, visit_note: l.visit_note, lead: l })),
  ];
  const shown = byVisit(items, filter);
  const count = (x: VisitFilter) => byVisit(items, x).length;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("project_places").insert({ project_id: projectId, name: f.name.trim(), address: f.address.trim() || null, contact: f.contact.trim() || null, note: f.note.trim() || null });
    if (error) return toast("error", t("saveError"));
    toast("ok", t("added", { name: f.name.trim() }));
    setF({ name: "", address: "", contact: "", note: "" }); setAdding(false); router.refresh();
  }
  async function saveVisit(x: Item, visit: { on: string | null; result: VisitResult | null; note: string | null }) {
    const { error } = x.kind === "own"
      ? await supabase.from("project_places").update({ visited_on: visit.on, visit_result: visit.result, visit_note: visit.note }).eq("id", x.id)
      : await supabase.rpc("mark_lead_visit", { p_lead: x.id, p_on: visit.on, p_result: visit.result, p_note: visit.note });
    if (error) { toast("error", t("saveError")); return false; }
    return true;
  }
  async function markVisited(x: Item) {
    if (!(await saveVisit(x, { on: v.on, result: v.result, note: v.note.trim() || null }))) return;
    // Counts toward my Customer Visits goal (Points on my profile)
    if (v.point) await supabase.from("member_points").insert({ kind: "visit", amount: 1, happened_on: v.on, note: x.name.slice(0, 300) });
    toast("ok", v.point ? t("visitedPoint", { name: x.name }) : t("visited", { name: x.name }));
    setVisiting(null); setV({ on: today, result: "yes", note: "", point: true }); router.refresh();
  }
  async function undo(x: Item) {
    if (await saveVisit(x, { on: null, result: null, note: null })) router.refresh();
  }
  async function remove(p: ProjectPlace) {
    if (!window.confirm(t("confirmDelete", { name: p.name }))) return;
    const { error } = await supabase.from("project_places").delete().eq("id", p.id);
    if (error) return toast("error", t("saveError"));
    router.refresh();
  }

  return (
    <section className="panel space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{t("hint2")}</p>
        <div className="flex gap-2">
          <button onClick={() => setAdding((a) => !a)} className="flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-sm font-medium text-brand-contrast"><Plus size={15} /> {t("addPlace")}</button>
          <Link href="/scout" className="flex items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-line"><Radar size={15} /> {t("openScout")}</Link>
        </div>
      </div>

      {adding && (
        <form onSubmit={add} className="grid gap-3 rounded-2xl p-4 ring-1 ring-line sm:grid-cols-2">
          <label className="block text-sm font-medium">{t("placeName")} *<input required maxLength={120} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={t("placeNamePh")} className="input mt-1.5" /></label>
          <label className="block text-sm font-medium">{t("address")}<input maxLength={300} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder={t("addressPh")} className="input mt-1.5" /></label>
          <label className="block text-sm font-medium">{t("contact")}<input maxLength={300} value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} placeholder={t("contactPh")} className="input mt-1.5" /></label>
          <label className="block text-sm font-medium">{t("note")}<input maxLength={1000} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder={t("notePh")} className="input mt-1.5" /></label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" onClick={() => setAdding(false)} className="rounded-xl px-4 py-2 text-sm text-muted">{t("cancel")}</button>
            <button disabled={!f.name.trim()} className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-contrast disabled:opacity-40">{t("save")}</button>
          </div>
        </form>
      )}

      <div role="tablist" aria-label={t("filter")} className="flex w-fit gap-1 rounded-full bg-surface-2 p-1 text-sm">
        {(["todo", "visited", "all"] as const).map((x) => (
          <button key={x} role="tab" aria-selected={filter === x} onClick={() => setFilter(x)}
                  className={`rounded-full px-3.5 py-1.5 ${filter === x ? "bg-ink font-medium text-bg" : "text-muted"}`}>{t(`filters.${x}`)} <span className="tabular-nums opacity-70">{count(x)}</span></button>
        ))}
      </div>

      <ul className="divide-y divide-line/60 rounded-2xl bg-surface-2/40 ring-1 ring-line">
        {shown.map((x) => (
          <li key={x.key} className="space-y-1.5 p-3">
            <div className="flex flex-wrap items-center gap-2">
              {x.lead ? <span className="readout w-9 text-lg font-semibold">{x.lead.score ?? "—"}</span>
                : <span className="grid size-9 place-items-center rounded-full bg-surface-2" title={t("foundBy", { name: names[x.place?.added_by ?? ""] ?? "—" })}><Store size={15} /></span>}
              <span className="min-w-0 flex-1">
                {x.lead ? <Link href={`/scout?p=${x.lead.scout_project_id}`} className="block truncate font-medium hover:text-link">{x.name}</Link> : <span className="block truncate font-medium">{x.name}</span>}
                <span className="block truncate text-xs text-muted">{x.sub ?? ""}{x.place ? `${x.sub ? " · " : ""}${t("foundBy", { name: names[x.place.added_by ?? ""] ?? "—" })}` : ""}</span>
              </span>
              {x.lead?.fit && <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${FIT[x.lead.fit] ?? ""}`}>{tf(x.lead.fit)}</span>}
              {x.lead && x.lead.status !== "new" && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px]">{ts(x.lead.status)}</span>}
              {x.visited_on ? (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${x.visit_result ? RESULT[x.visit_result] : "bg-surface-2"}`}>
                  {t("visitedOn", { date: shortDate(x.visited_on, locale) })}{x.visit_result ? ` · ${t(`results.${x.visit_result}`)}` : ""}
                </span>
              ) : <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">{t("notVisited")}</span>}
            </div>
            {x.lead?.why && <p className="line-clamp-2 text-xs text-muted">{x.lead.why}</p>}
            {x.place?.note && <p className="text-xs text-muted">{x.place.note}</p>}
            {x.visit_note && <p className="text-xs"><span className="text-muted">{t("visitNote")}:</span> {x.visit_note}</p>}
            <div className="flex flex-wrap gap-1.5">
              {x.lead && <a href={mapsLink({ ...x.lead.place })} target="_blank" rel="noopener noreferrer" className={chip}><MapPin size={12} /> Maps</a>}
              {x.place?.address && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${x.place.name} ${x.place.address}`)}`} target="_blank" rel="noopener noreferrer" className={chip}><MapPin size={12} /> Maps</a>}
              {x.lead?.place.website && <a href={x.lead.place.website} target="_blank" rel="noopener noreferrer" className={chip}><Globe2 size={12} /> Web</a>}
              {x.lead?.place.instagram && <a href={x.lead.place.instagram} target="_blank" rel="noopener noreferrer" className={chip}><AtSign size={12} /> Instagram</a>}
              {x.lead?.place.phone && <a href={`tel:${x.lead.place.phone.replace(/\s/g, "")}`} className={chip}><Phone size={12} /> {x.lead.place.phone}</a>}
              {x.place?.contact && <span className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-xs"><Phone size={12} /> {x.place.contact}</span>}
              <span className="flex-1" />
              {x.visited_on
                ? <button onClick={() => undo(x)} className={chip}><Undo2 size={12} /> {t("undoVisit")}</button>
                : <button onClick={() => { setVisiting(visiting === x.key ? null : x.key); setV({ on: today, result: "yes", note: "", point: true }); }} className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1 text-xs font-medium text-brand-contrast"><Check size={12} /> {t("markVisited")}</button>}
              {x.place && x.place.added_by === meId && <button onClick={() => remove(x.place!)} aria-label={t("delete")} className={`${chip} hover:text-bad-text`}><Trash2 size={12} /></button>}
            </div>
            {visiting === x.key && (
              <div className="mt-2 grid gap-3 rounded-xl bg-surface p-3 ring-1 ring-line sm:grid-cols-[auto_auto_1fr] sm:items-end">
                <label className="block text-xs font-medium">{t("when")}<input type="date" max={today} value={v.on} onChange={(e) => setV({ ...v, on: e.target.value })} className="input mt-1 h-9 py-0" /></label>
                <fieldset><legend className="text-xs font-medium">{t("howWasIt")}</legend>
                  <div className="mt-1 flex gap-1">{VISIT_RESULTS.map((r) => (
                    <button key={r} type="button" aria-pressed={v.result === r} onClick={() => setV({ ...v, result: r })}
                            className={`h-9 rounded-lg px-3 text-xs font-medium ${v.result === r ? RESULT[r] + " ring-2 ring-current" : "bg-surface-2"}`}>{t(`results.${r}`)}</button>
                  ))}</div></fieldset>
                <label className="block text-xs font-medium">{t("visitNote")}<input maxLength={1000} value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} placeholder={t("visitNotePh")} className="input mt-1 h-9 py-0" /></label>
                <label className="flex items-center gap-2 text-xs sm:col-span-2"><input type="checkbox" checked={v.point} onChange={(e) => setV({ ...v, point: e.target.checked })} className="size-4 accent-[var(--brand)]" /> {t("addPoint")}</label>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setVisiting(null)} className="rounded-lg px-3 py-1.5 text-xs text-muted">{t("cancel")}</button>
                  <button type="button" onClick={() => markVisited(x)} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-brand-contrast">{t("saveVisit")}</button>
                </div>
              </div>
            )}
          </li>
        ))}
        {!shown.length && <li className="p-6 text-center text-sm text-muted">{items.length ? t("noneHere") : t("empty2")}</li>}
      </ul>
    </section>
  );
}
