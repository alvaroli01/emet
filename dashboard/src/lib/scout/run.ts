import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Fail } from "@/lib/lab/ai";
import { fingerprint, evidenceLevel, applyEvidence, type FoundPlace } from "./core";
import { readSite } from "./web";
import { judge, webCheck, type Plan, type Project } from "./ai";

/** One line of the plain-language step log next to the globe. The client translates `k` with `p` as values. */
export type LogLine = { at: string; k: string; p?: Record<string, string | number>; url?: string; place_id?: string };
export const line = (k: string, p?: LogLine["p"], extra: Partial<LogLine> = {}): LogLine => ({ at: new Date().toISOString(), k, p, ...extra });

export type PlaceRow = FoundPlace & { id: string; city: string | null; country_code: string | null; forgotten: boolean; maps_url?: string | null };

/** Store places once for everyone (by fingerprint) and return their rows, including ones that already existed. */
export async function upsertPlaces(sb: SupabaseClient, found: FoundPlace[], city: string, country: string, source: "osm" | "web" | "manual" | "overture"): Promise<PlaceRow[]> {
  if (!found.length) return [];
  const rows = [...new Map(found.map((f) => [fingerprint(f), { ...f, fingerprint: fingerprint(f), city, country_code: country, source }])).values()];
  await sb.from("scout_places").upsert(rows, { onConflict: "fingerprint", ignoreDuplicates: true });
  const { data } = await sb.from("scout_places").select("*").in("fingerprint", rows.map((r) => r.fingerprint));
  return (data ?? []) as PlaceRow[];
}

/** Research one place (reusing anything fetched in the last 30 days), judge it for the project and save the lead. */
export async function researchAndJudge(sb: SupabaseClient, key: string, opts: { place: PlaceRow; project: Project & { id: string }; plan: Plan | null; searchId: string | null; locale: string }): Promise<{ ok: true; lead: { id: string; score: number; fit: string; worth_it: boolean }; pages: number } | Fail> {
  const { place, project, plan } = opts;
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data: cached } = await sb.from("scout_research").select("url, text_excerpt, robots_ok").eq("place_id", place.id).gte("fetched_at", since);
  let pages = (cached ?? []).filter((c) => c.url !== "web:search" && c.robots_ok).map((c) => ({ url: c.url, text: c.text_excerpt ?? "" }));
  let web = (cached ?? []).find((c) => c.url === "web:search");
  if (!cached?.length && place.website) {
    const site = await readSite(place.website).catch(() => []);
    pages = site.filter((s) => s.robots_ok && s.text).map((s) => ({ url: s.url, text: s.text }));
    if (site.length) await sb.from("scout_research").upsert(site.map((s) => ({ place_id: place.id, url: s.url, text_excerpt: s.text.slice(0, 4000), robots_ok: s.robots_ok })));
  }
  let webNotes = "", webSources: { title: string; url: string }[] = [];
  if (web) { try { const j = JSON.parse(web.text_excerpt ?? "{}"); webNotes = j.notes ?? ""; webSources = j.sources ?? []; } catch { /* ignore */ } }
  else {
    const w = await webCheck(key, place.name, place.city ?? "");
    if ("error" in w) { if (w.error !== "failed") return w; }
    else {
      webNotes = w.notes; webSources = w.sources;
      // Enrichment: fill the place's empty fields with links the search really returned (never overwrite)
      const fill: Record<string, string> = {};
      if (!place.website && w.links.website) fill.website = place.website = w.links.website;
      if (!place.instagram && w.links.instagram) fill.instagram = place.instagram = w.links.instagram;
      if (!place.phone && w.links.phone) fill.phone = place.phone = w.links.phone;
      if (!place.maps_url && w.links.maps_url) fill.maps_url = place.maps_url = w.links.maps_url;
      if (Object.keys(fill).length) await sb.from("scout_places").update(fill).eq("id", place.id);
      await sb.from("scout_research").upsert({ place_id: place.id, url: "web:search", text_excerpt: JSON.stringify(w).slice(0, 4000) });
      web = { url: "web:search", text_excerpt: "", robots_ok: true };
    }
  }
  const j = await judge(key, project, plan, { place, pages, webNotes, webSources }, opts.locale);
  if ("error" in j) return j;
  // How much real evidence the verdict rests on; with little, never more than "maybe"
  const evidence = evidenceLevel(pages.length, webSources.length);
  const capped = applyEvidence({ fit: j.fit as "strong" | "good" | "maybe" | "skip", worth_it: j.worth_it }, evidence);
  const row = { project_id: project.id, place_id: place.id, search_id: opts.searchId, score: j.score, fit: capped.fit, worth_it: capped.worth_it, evidence, why: j.why, attack_with: j.attack_with, approach: capped.fit === "maybe" || capped.fit === "skip" ? null : j.approach, criteria: j.criteria, signals: j.signals };
  const { data, error } = await sb.from("scout_leads").upsert(row, { onConflict: "project_id,place_id" }).select("id, score, fit, worth_it").single();
  if (error || !data) return { error: "failed" };
  return { ok: true, lead: data as { id: string; score: number; fit: string; worth_it: boolean }, pages: pages.length };
}
