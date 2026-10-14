import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { decryptKey } from "@/lib/ai/keys";
import { researchOrder, type FoundPlace } from "@/lib/scout/core";
import { findCities, osmPlaces } from "@/lib/scout/web";
import { planProject, webFind, type Plan, type Project } from "@/lib/scout/ai";
import { line, upsertPlaces, researchAndJudge, type LogLine, type PlaceRow } from "@/lib/scout/run";

export const maxDuration = 60;

/**
 * Advances a Scout search by ONE step and saves it (Vercel Hobby time limits): queued → plan + locate,
 * finding → collect places, researching → judge the next place. The page calls this again until "done".
 * Runs with the caller's own Groq key and the caller's permissions (RLS).
 */
export async function POST(request: NextRequest) {
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "bad-request" }, { status: 400 });
  const sb = await createClient();
  const [{ data: s }, { data: canScout }, { data: keyRow }] = await Promise.all([
    sb.from("scout_searches").select("*").eq("id", id).maybeSingle(),
    sb.rpc("can_scout"),
    sb.from("ai_keys").select("key_iv, key_data").maybeSingle(),
  ]);
  if (!s) return NextResponse.json({ error: "not-found" }, { status: 404 });
  if (!canScout) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!keyRow) return NextResponse.json({ error: "no-key" }, { status: 400 });
  if (s.status === "done" || s.status === "failed") return NextResponse.json({ status: s.status });
  const key = decryptKey(keyRow);
  const locale = await getLocale();
  const { data: project } = await sb.from("scout_projects").select("*").eq("id", s.project_id).single();
  const log: LogLine[] = Array.isArray(s.log) ? s.log : [];
  const save = (patch: Record<string, unknown>) => sb.from("scout_searches").update({ ...patch, log: log.slice(-80) }).eq("id", id);
  const limit = (r: { error: string; retryAfter?: number }) => NextResponse.json(r, { status: r.error === "limit" ? 429 : 502 });

  // ── 1. Understand the project (cached on it) and find the city ──
  if (s.status === "queued") {
    let plan = project.plan as Plan | null;
    if (!plan) {
      const r = await planProject(key, project as Project, s.country_code, locale);
      if ("error" in r) return limit(r);
      plan = r;
      await sb.from("scout_projects").update({ plan }).eq("id", project.id);
    }
    log.push(line("plan", { summary: plan.summary || project.niche }));
    let { lat, lng, bbox } = s;
    if (lat == null) {
      const [c] = await findCities(s.city, s.country_code, locale.slice(0, 2));
      if (!c) { log.push(line("noCity", { city: s.city })); await save({ status: "failed" }); return NextResponse.json({ status: "failed" }); }
      ({ lat, lng, bbox } = c);
    }
    log.push(line("located", { city: s.city }));
    await save({ status: "finding", lat, lng, bbox, osm_tags: s.osm_tags.length ? s.osm_tags : plan.osm_tags, web_queries: s.web_queries.length ? s.web_queries : plan.web_queries });
    return NextResponse.json({ status: "finding" });
  }

  // ── 2. Collect places: OpenStreetMap + web search, skip ones already judged for this project ──
  if (s.status === "finding") {
    const osm = s.osm_tags.length ? await osmPlaces(s.osm_tags, s.lat, s.lng, Number(s.radius_km)) : [];
    log.push(line(osm === null ? "osmDown" : "osm", { n: osm?.length ?? 0, km: Number(s.radius_km), city: s.city }));
    let web: FoundPlace[] = [];
    if (s.web_queries.length) {
      const w = await webFind(key, s.web_queries, s.city, s.country_code);
      if (!("error" in w)) {
        web = w.map((x) => ({ name: x.name, category: null, address: x.address, lat: null, lng: null, website: x.website, phone: null, instagram: x.instagram, email_public: null, opening_hours: null, osm_id: null }));
        log.push(line("web", { n: web.length }));
      }
    }
    const rows = [...(await upsertPlaces(sb, osm ?? [], s.city, s.country_code, "osm")), ...(await upsertPlaces(sb, web, s.city, s.country_code, "web"))];
    const unique = [...new Map(rows.filter((r) => !r.forgotten).map((r) => [r.id, r])).values()];
    const { data: judged } = await sb.from("scout_leads").select("place_id").eq("project_id", s.project_id).in("place_id", unique.map((r) => r.id));
    const known = new Set((judged ?? []).map((j) => j.place_id));
    const fresh = researchOrder(unique.filter((r) => !known.has(r.id)), s.lat, s.lng).slice(0, s.max_places);
    log.push(line("known", { known: known.size, todo: fresh.length }));
    if (!fresh.length) { log.push(line("done", { strong: 0, good: 0, skip: 0 })); await save({ status: "done", found: unique.length, known: known.size }); return NextResponse.json({ status: "done" }); }
    await save({ status: "researching", found: unique.length, known: known.size, queue: fresh.map((r) => r.id) });
    return NextResponse.json({ status: "researching", places: fresh.map((r) => ({ id: r.id, lat: r.lat, lng: r.lng })) });
  }

  // ── 3. Research + judge the next place ──
  const [next, ...rest] = s.queue as string[];
  if (!next) return finish();
  const { data: place } = await sb.from("scout_places").select("*").eq("id", next).single();
  if (place && !place.forgotten) {
    const r = await researchAndJudge(sb, key, { place: place as PlaceRow, project: project as Project & { id: string }, plan: project.plan as Plan | null, searchId: id, locale });
    if ("error" in r) {
      if (r.error === "limit") { log.push(line("waiting", { s: r.retryAfter ?? 60 })); await save({}); return limit(r); }
      log.push(line("failedPlace", { name: place.name }, { place_id: place.id }));
    } else {
      if (r.pages) log.push(line("read", { name: place.name, n: r.pages }, { url: place.website ?? undefined, place_id: place.id }));
      log.push(line("scored", { name: place.name, fit: r.lead.fit, score: r.lead.score }, { place_id: place.id }));
    }
  }
  await save({ queue: rest, researched: s.researched + 1 });
  if (!rest.length) return finish();
  return NextResponse.json({ status: "researching", left: rest.length });

  async function finish() {
    const { data: leads } = await sb.from("scout_leads").select("fit").eq("search_id", id);
    const n = (f: string) => (leads ?? []).filter((l) => l.fit === f).length;
    log.push(line("done", { strong: n("strong"), good: n("good"), skip: n("skip") + n("maybe") }));
    await save({ status: "done", queue: [] });
    return NextResponse.json({ status: "done" });
  }
}
