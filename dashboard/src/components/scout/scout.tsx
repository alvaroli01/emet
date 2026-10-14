"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Search, Loader2, Link2, X, MapPin, Pencil, Radar } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { Modal } from "@/components/data-table";
import { KeyNotice } from "@/components/lab/idea-lab";
import { GlobeLazy } from "./globe-lazy";
import type { GlobePin } from "./globe";
import { Leads } from "./leads";

export type ScoutProject = { id: string; title: string; idea_id: string | null; offer: string; niche: string; ideal_client: string | null; must_have: string[]; deal_breakers: string[]; avg_deal_value: number | null;
  plan: { osm_tags: string[]; web_queries: string[]; signals: string[]; deal_breakers: string[]; playbook: string; summary: string } | null; created_at: string };
export type LogLine = { at: string; k: string; p?: Record<string, string | number>; url?: string; place_id?: string };
export type ScoutSearch = { id: string; project_id: string; city: string; country_code: string; lat: number | null; lng: number | null; radius_km: number; status: string; found: number; known: number; researched: number; max_places: number; log: LogLine[]; queue: string[]; created_by: string | null; created_at: string };
export type ScoutPlace = { id: string; name: string; category: string | null; address: string | null; city: string | null; country_code: string | null; lat: number | null; lng: number | null; website: string | null; phone: string | null; instagram: string | null; email_public: string | null; opening_hours: string | null; source: string; forgotten: boolean };
export type ScoutLead = { id: string; project_id: string; place_id: string; search_id: string | null; score: number | null; fit: string | null; worth_it: boolean | null; why: string | null; attack_with: string | null;
  approach: { channel: string; opener: string; best_time: string; who_to_ask_for: string; objections: { objection: string; answer: string }[] } | null;
  criteria: { key: string; score: number; why: string; source?: string }[] | null; signals: { text: string; url?: string }[]; status: string; owner_id: string | null; next_step_at: string | null; prospect_id: string | null; created_at: string; place: ScoutPlace };
type Person = { id: string; full_name: string };

const ACTIVE = ["queued", "finding", "researching"];
// Example searches the idle globe shows to explain what Scout does
const EXAMPLES = [
  { lat: 43.263, lng: -2.935, k: "bilbao" }, { lat: 60.17, lng: 24.94, k: "helsinki" }, { lat: -23.55, lng: -46.63, k: "saopaulo" },
  { lat: 19.43, lng: -99.13, k: "mexico" }, { lat: 35.68, lng: 139.69, k: "tokyo" }, { lat: 55.75, lng: 37.62, k: "moscow" },
];
const COUNTRIES = "ES PT FR DE IT GB IE NL BE LU CH AT DK SE NO FI IS PL CZ SK HU SI HR RO BG GR CY MT EE LV LT RS BA ME MK AL UA MD RU TR US CA MX BR AR CL CO PE UY EC VE BO PY CR PA DO GT CU PR MA DZ TN EG ZA NG KE GH AE SA QA IL JO IN PK BD LK CN JP KR TW HK SG MY TH VN PH ID AU NZ".split(" ");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function Scout({ projects, searches, leads, members, meId, meName, canScout, hasKey: initialKey, ideas, initialProject, fromIdea }: {
  projects: ScoutProject[]; searches: ScoutSearch[]; leads: ScoutLead[]; members: Person[]; meId: string; meName: string; canScout: boolean; hasKey: boolean;
  ideas: { id: string; title: string; pitch: string }[]; initialProject: string | null; fromIdea: { id: string; title: string; pitch: string } | null;
}) {
  const t = useTranslations("scout");
  const router = useRouter();
  const [projectId, setProjectId] = useState<string | null>(initialProject && projects.some((p) => p.id === initialProject) ? initialProject : projects[0]?.id ?? null);
  const [editing, setEditing] = useState<ScoutProject | "new" | null>(fromIdea && canScout ? "new" : null);
  const [hasKey, setHasKey] = useState(initialKey);
  const project = projects.find((p) => p.id === projectId) ?? null;
  const projectLeads = leads.filter((l) => l.project_id === projectId);
  const latest = searches.find((s) => s.project_id === projectId) ?? null;
  const th = useTranslations("hero");
  const today = new Date().toISOString().slice(0, 10);
  const myDue = leads.filter((l) => l.owner_id === meId && l.next_step_at && l.next_step_at <= today && !["won", "lost", "ignored"].includes(l.status)).length;
  const strongNew = projectLeads.filter((l) => l.fit === "strong" && l.status === "new").length;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-sm text-muted"><Radar size={15} /> {t("title")}</p>
          <h1 className="mt-2 text-[clamp(1.6rem,3vw,2.3rem)] leading-[1.08] font-[650] tracking-[-0.02em] text-balance">{th("scout.title", { name: meName })}</h1>
          <p className="mt-1.5 text-[15px] text-muted">{t("intro")}</p>
          {(myDue > 0 || strongNew > 0) && (
            <ul className="mt-3 space-y-1 text-[15px]">
              {myDue > 0 && <li className="flex gap-2.5"><span aria-hidden className="mt-[7px] size-2 rounded-full bg-warn" />{th("scout.due", { count: myDue })}</li>}
              {strongNew > 0 && <li className="flex gap-2.5"><span aria-hidden className="mt-[7px] size-2 rounded-full bg-climbed" />{th("scout.strong", { count: strongNew })}</li>}
            </ul>
          )}
        </div>
        {projects.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="scout-project">{t("project")}</label>
            <select id="scout-project" value={projectId ?? ""} onChange={(e) => setProjectId(e.target.value)} className="input max-w-64 py-2">
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            {canScout && project && <button onClick={() => setEditing(project)} aria-label={t("editProject")} className="rounded-xl p-2.5 text-muted hover:bg-surface-2 hover:text-ink"><Pencil size={16} /></button>}
            {canScout && <button onClick={() => setEditing("new")} className="flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-sm font-medium text-brand-contrast"><Plus size={15} /> {t("newProject")}</button>}
          </div>
        )}
      </header>

      {canScout && !hasKey && <KeyNotice onConnected={() => setHasKey(true)} />}

      {!project ? (
        <section className="panel grid gap-6 overflow-hidden p-6 md:grid-cols-[1fr_minmax(0,420px)] md:items-center">
          <div>
            <h2 className="text-lg font-semibold">{t("emptyTitle")}</h2>
            <p className="mt-2 max-w-prose text-sm text-muted">{t("emptyText")}</p>
            {canScout ? <button onClick={() => setEditing("new")} className="mt-4 flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-brand-contrast"><Plus size={15} /> {t("newProject")}</button>
              : <p className="mt-4 text-sm text-muted">{t("viewOnly")}</p>}
          </div>
          <Hero target={null} pins={[]} radiusKm={3} />
        </section>
      ) : (
        <>
          <Finder key={project.id} project={project} latest={latest} canScout={canScout && hasKey} meId={meId} />
          <Leads leads={projectLeads} members={members} canScout={canScout} meId={meId} project={project} onChecked={() => router.refresh()} hasKey={hasKey} />
        </>
      )}

      {editing && <ProjectForm project={editing === "new" ? null : editing} ideas={ideas} fromIdea={editing === "new" ? fromIdea : null}
                               onClose={() => setEditing(null)} onSaved={(id) => { setProjectId(id); setEditing(null); router.refresh(); }} />}
    </>
  );
}

function Hero({ target, pins, radiusKm }: { target: { lat: number; lng: number } | null; pins: GlobePin[]; radiusKm: number }) {
  const t = useTranslations("scout");
  const examples = useMemo(() => EXAMPLES.map((e) => ({ lat: e.lat, lng: e.lng, label: t(`examples.${e.k}`) })), [t]);
  return <div className="mx-auto aspect-square w-full max-w-[460px]"><GlobeLazy target={target} pins={pins} radiusKm={radiusKm} examples={examples} ariaLabel={t("globeLabel")} className="size-full" /></div>;
}

/** Search form + live step log, with the globe flying to the city. Drives the server one step at a time. */
function Finder({ project, latest, canScout, meId }: { project: ScoutProject; latest: ScoutSearch | null; canScout: boolean; meId: string }) {
  const t = useTranslations("scout");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const regions = useMemo(() => { try { return new Intl.DisplayNames([locale], { type: "region" }); } catch { return null; } }, [locale]);
  const countries = useMemo(() => COUNTRIES.map((c) => ({ c, name: regions?.of(c) ?? c })).sort((a, b) => a.name.localeCompare(b.name, locale)), [regions, locale]);

  const [country, setCountry] = useState(latest?.country_code ?? "ES");
  const [city, setCity] = useState(latest?.city ?? "");
  const [picked, setPicked] = useState<{ lat: number; lng: number; bbox: number[] } | null>(null);
  const [typed, setTyped] = useState(false); // only suggest cities while the person is typing
  const [suggest, setSuggest] = useState<{ name: string; lat: number; lng: number; bbox: number[]; country_code: string }[]>([]);
  const [radius, setRadius] = useState(Number(latest?.radius_km ?? 3));
  const [max, setMax] = useState(20);
  const [tags, setTags] = useState<string[]>(project.plan?.osm_tags ?? []);
  const [queries, setQueries] = useState<string[]>(project.plan?.web_queries ?? []);
  const [search, setSearch] = useState<ScoutSearch | null>(latest);
  const [pins, setPins] = useState<GlobePin[]>([]);
  const [waiting, setWaiting] = useState(0);
  const driving = useRef(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => { setTags(project.plan?.osm_tags ?? []); setQueries(project.plan?.web_queries ?? []); }, [project.plan]);

  // City suggestions (OpenStreetMap), debounced
  useEffect(() => {
    if (!typed || picked || city.trim().length < 2) { setSuggest([]); return; }
    const id = setTimeout(async () => {
      const res = await fetch(`/api/scout/cities?${new URLSearchParams({ q: city, country, lang: locale })}`).catch(() => null);
      if (res?.ok) setSuggest(await res.json());
    }, 450);
    return () => clearTimeout(id);
  }, [city, country, picked, locale, typed]);

  async function refresh(id: string) {
    const [{ data: s }, { data: ls }] = await Promise.all([
      supabase.from("scout_searches").select("*").eq("id", id).single(),
      supabase.from("scout_leads").select("place_id, fit, place:scout_places(lat, lng)").eq("search_id", id),
    ]);
    if (!s || !alive.current) return;
    setSearch(s as ScoutSearch);
    const judged = new Map((ls ?? []).map((l) => [l.place_id, l]));
    const queue = (s.queue as string[]) ?? [];
    const { data: qp } = queue.length ? await supabase.from("scout_places").select("id, lat, lng").in("id", queue) : { data: [] };
    setPins([
      ...[...judged.values()].map((l) => { const pl = l.place as unknown as { lat: number | null; lng: number | null }; return { id: l.place_id, lat: pl?.lat ?? NaN, lng: pl?.lng ?? NaN, fit: l.fit }; }),
      ...(qp ?? []).map((p) => ({ id: p.id, lat: p.lat ?? NaN, lng: p.lng ?? NaN, fit: null })),
    ]);
  }

  async function drive(id: string) {
    if (driving.current) return;
    driving.current = true;
    try {
      for (let i = 0; i < 200 && alive.current; i++) {
        const res = await fetch("/api/scout/step", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => null);
        if (!res) { await sleep(3000); continue; }
        const j = await res.json().catch(() => ({}));
        await refresh(id);
        if (res.status === 429) {
          // Free Groq allowance used up for the minute: wait it out visibly, then continue where we left off
          for (let s = Math.min(90, j.retryAfter ?? 60); s > 0 && alive.current; s--) { setWaiting(s); await sleep(1000); }
          setWaiting(0); continue;
        }
        if (!res.ok) { toast("error", t(j.error === "no-key" ? "needKey" : "stepError")); break; }
        if (j.status === "done" || j.status === "failed") break;
        if (j.status === "researching" && j.left !== undefined) router.refresh(); // show each new lead as soon as it is judged
      }
    } finally { driving.current = false; setWaiting(0); router.refresh(); }
  }

  // Resume my own unfinished search when the page opens; show others' searches as they run
  useEffect(() => {
    if (latest) refresh(latest.id);
    if (latest && ACTIVE.includes(latest.status) && latest.created_by === meId && canScout) drive(latest.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (!city.trim()) return;
    const { data, error } = await supabase.from("scout_searches").insert({
      project_id: project.id, country_code: country, city: city.split(",")[0].trim(), radius_km: radius, max_places: max,
      lat: picked?.lat ?? null, lng: picked?.lng ?? null, bbox: picked?.bbox ?? null, osm_tags: tags, web_queries: queries,
      log: [{ at: new Date().toISOString(), k: "start", p: { city: city.split(",")[0].trim() } }],
    }).select("*").single();
    if (error || !data) return toast("error", t("stepError"));
    setSearch(data as ScoutSearch); setPins([]);
    drive(data.id);
  }

  const running = !!search && ACTIVE.includes(search.status);
  const target = search?.lat != null && search?.lng != null ? { lat: search.lat, lng: search.lng } : null;
  const tf = useTranslations("scout.fit");
  const logRef = useRef<HTMLOListElement>(null);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }); }, [search?.log?.length]);

  return (
    <section className="panel grid gap-6 overflow-hidden p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
      <div className="relative order-2 lg:order-1">
        <Hero target={target} pins={pins} radiusKm={Number(search?.radius_km ?? radius)} />
        {search && target && (
          <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-surface/90 px-3 py-1 text-xs shadow-sm">
            <MapPin size={12} className="mr-1 inline text-[var(--trail)]" />{search.city} · {t("radius", { km: Number(search.radius_km) })}
          </p>
        )}
      </div>

      <div className="order-1 flex min-w-0 flex-col gap-4 lg:order-2">
        <form onSubmit={start} className="space-y-3">
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
            <label className="block"><span className="mb-0.5 block text-xs text-muted">{t("country")}</span>
              <select value={country} onChange={(e) => { setCountry(e.target.value); setPicked(null); }} className="input" disabled={!canScout || running}>
                {countries.map(({ c, name }) => <option key={c} value={c}>{name}</option>)}
              </select></label>
            <label className="relative block"><span className="mb-0.5 block text-xs text-muted">{t("city")}</span>
              <input value={city} onChange={(e) => { setCity(e.target.value); setPicked(null); setTyped(true); }} onBlur={() => setTimeout(() => setSuggest([]), 150)} placeholder={t("cityPlaceholder")} className="input" disabled={!canScout || running} autoComplete="off" required />
              {suggest.length > 0 && (
                <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-line bg-solid shadow-lg" role="listbox">
                  {suggest.map((s) => (
                    <li key={`${s.lat},${s.lng}`}><button type="button" role="option" aria-selected={false} onClick={() => { setCity(s.name); setPicked(s); setSuggest([]); setTyped(false); if (s.country_code) setCountry(s.country_code); }}
                      className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-surface-2">{s.name}</button></li>
                  ))}
                </ul>
              )}</label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="mb-0.5 block text-xs text-muted">{t("radiusLabel")}</span>
              <select value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="input" disabled={!canScout || running}>{[1, 3, 5, 10, 20].map((k) => <option key={k} value={k}>{t("radius", { km: k })}</option>)}</select></label>
            <label className="block"><span className="mb-0.5 block text-xs text-muted">{t("maxLabel")}</span>
              <select value={max} onChange={(e) => setMax(Number(e.target.value))} className="input" disabled={!canScout || running}>{[10, 20, 40].map((k) => <option key={k} value={k}>{t("maxPlaces", { n: k })}</option>)}</select></label>
          </div>
          {project.plan ? (
            <details className="rounded-xl bg-surface-2/60 p-3 text-sm">
              <summary className="cursor-pointer text-muted">{t("lookingFor")} <span className="text-ink">{project.plan.summary}</span></summary>
              <Chips label={t("mapTags")} items={tags} onChange={setTags} disabled={!canScout || running} placeholder="amenity=cafe" />
              <Chips label={t("webQueries")} items={queries} onChange={setQueries} disabled={!canScout || running} placeholder={t("queryPlaceholder")} />
            </details>
          ) : <p className="text-xs text-muted">{t("firstRunNote")}</p>}
          {canScout ? (
            <button disabled={running || !city.trim()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-brand-contrast disabled:opacity-60">
              {running ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} {running ? t("searching") : t("find")}
            </button>
          ) : <p className="text-xs text-muted">{t("viewOnly")}</p>}
        </form>

        <div className="min-h-0 flex-1">
          <h2 className="mb-1.5 text-sm font-semibold">{t("logTitle")}</h2>
          {search?.log?.length ? (
            <ol ref={logRef} className="max-h-72 space-y-1.5 overflow-y-auto pr-1 text-sm" aria-live="polite">
              {search.log.map((l, i) => {
                const p = { ...(l.p ?? {}), ...(l.p?.fit ? { fit: tf(String(l.p.fit)) } : {}) };
                const last = i === search.log.length - 1 && running;
                return (
                  <li key={l.at + i} className={`flex gap-2 ${last ? "" : "text-muted"}`}>
                    <span aria-hidden className={`mt-1.5 size-1.5 shrink-0 rounded-full ${last ? "animate-pulse bg-[var(--trail)]" : l.k === "scored" && ["strong", "good"].includes(String(l.p?.fit)) ? "bg-climbed" : "bg-border"}`} />
                    <span className="min-w-0">{t.has(`log.${l.k}`) ? t(`log.${l.k}`, p) : l.k}{l.url && <a href={l.url} target="_blank" rel="noopener noreferrer" className="ml-1 text-climbed underline-offset-2 hover:underline"><Link2 size={11} className="inline" /></a>}</span>
                  </li>
                );
              })}
              {waiting > 0 && <li className="flex gap-2 text-warn-text"><Loader2 size={12} className="mt-1 animate-spin" />{t("log.waitingLive", { s: waiting })}</li>}
            </ol>
          ) : <p className="text-sm text-muted">{t("logEmpty")}</p>}
        </div>
      </div>
    </section>
  );
}

function Chips({ label, items, onChange, disabled, placeholder }: { label: string; items: string[]; onChange: (v: string[]) => void; disabled: boolean; placeholder: string }) {
  const [v, setV] = useState("");
  const t = useTranslations("scout");
  return (
    <div className="mt-2">
      <p className="mb-1 text-xs text-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((x) => (
          <span key={x} className="inline-flex items-center gap-1 rounded-lg bg-surface px-2 py-1 text-xs">{x}
            {!disabled && <button type="button" onClick={() => onChange(items.filter((y) => y !== x))} aria-label={t("remove", { item: x })} className="text-muted hover:text-ink"><X size={11} /></button>}</span>
        ))}
        {!disabled && <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && v.trim()) { e.preventDefault(); onChange([...new Set([...items, v.trim()])]); setV(""); } }}
          placeholder={placeholder} aria-label={label} className="min-w-28 flex-1 rounded-lg bg-transparent px-2 py-1 text-xs outline-none focus:bg-surface" />}
      </div>
    </div>
  );
}

function ProjectForm({ project, ideas, fromIdea, onClose, onSaved }: { project: ScoutProject | null; ideas: { id: string; title: string; pitch: string }[]; fromIdea: { id: string; title: string; pitch: string } | null; onClose: () => void; onSaved: (id: string) => void }) {
  const tp = useTranslations("scout.form");
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const src = project ?? (fromIdea ? { title: fromIdea.title, offer: fromIdea.pitch, idea_id: fromIdea.id } : null);
  const [v, setV] = useState({
    title: src?.title ?? "", offer: src?.offer ?? "", niche: project?.niche ?? "", ideal_client: project?.ideal_client ?? "",
    must_have: (project?.must_have ?? []).join("\n"), deal_breakers: (project?.deal_breakers ?? []).join("\n"),
    avg_deal_value: project?.avg_deal_value != null ? String(project.avg_deal_value) : "", idea_id: src?.idea_id ?? "",
  });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 10);
    const row = { title: v.title.trim(), offer: v.offer.trim(), niche: v.niche.trim(), ideal_client: v.ideal_client.trim() || null, must_have: lines(v.must_have), deal_breakers: lines(v.deal_breakers),
      avg_deal_value: v.avg_deal_value === "" ? null : Number(v.avg_deal_value), idea_id: v.idea_id || null,
      // Changing what we sell or to whom means Scout has to re-think what to search for
      ...(project && (project.offer !== v.offer.trim() || project.niche !== v.niche.trim() || (project.ideal_client ?? "") !== v.ideal_client.trim()) ? { plan: null } : {}) };
    const { data, error } = project ? await supabase.from("scout_projects").update(row).eq("id", project.id).select("id").single() : await supabase.from("scout_projects").insert(row).select("id").single();
    if (error || !data) return toast("error", tp("saveError"));
    toast("ok", tp("saved")); onSaved(data.id);
  }
  const area = (k: "offer" | "niche" | "ideal_client" | "must_have" | "deal_breakers", rows = 2, required = false) => (
    <label className="block"><span className="mb-0.5 block text-xs text-muted">{tp(k)}</span>
      <textarea rows={rows} required={required} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} placeholder={tp(`ph.${k}`)} className="input" /></label>
  );
  return (
    <Modal title={project ? tp("edit") : tp("new")} onClose={onClose} wide>
      <form onSubmit={save} className="space-y-3">
        {!project && ideas.length > 0 && (
          <label className="block"><span className="mb-0.5 block text-xs text-muted">{tp("fromIdea")}</span>
            <select value={v.idea_id} onChange={(e) => { const i = ideas.find((x) => x.id === e.target.value); setV({ ...v, idea_id: e.target.value, ...(i ? { title: v.title || i.title, offer: v.offer || i.pitch } : {}) }); }} className="input">
              <option value="">—</option>{ideas.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
            </select></label>
        )}
        <label className="block"><span className="mb-0.5 block text-xs text-muted">{tp("title")}</span>
          <input autoFocus required maxLength={120} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder={tp("ph.title")} className="input" /></label>
        {area("offer", 2, true)}
        <div className="grid gap-3 sm:grid-cols-2">{area("niche", 2, true)}{area("ideal_client", 2)}</div>
        <div className="grid gap-3 sm:grid-cols-2">{area("must_have", 3)}{area("deal_breakers", 3)}</div>
        <label className="block max-w-48"><span className="mb-0.5 block text-xs text-muted">{tp("avg_deal_value")}</span>
          <input type="number" min="0" step="any" inputMode="decimal" value={v.avg_deal_value} onChange={(e) => setV({ ...v, avg_deal_value: e.target.value })} className="input" /></label>
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-muted">{tp("cancel")}</button>
          <button className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-contrast">{tp("save")}</button></div>
      </form>
    </Modal>
  );
}
