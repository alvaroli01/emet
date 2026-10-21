import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { scoutRing } from "@/lib/ai/ring-server";
import { researchOrder, type FoundPlace } from "@/lib/scout/core";
import { findCities, osmPlaces, openPlaces } from "@/lib/scout/web";
import { planProject, webFind, relevance, type Plan, type Project } from "@/lib/scout/ai";
import { line, upsertPlaces, researchAndJudge, type LogLine, type PlaceRow } from "@/lib/scout/run";

export const maxDuration = 60;

/**
 * Advances a Scout search by ONE step and saves it (Vercel Hobby time limits): queued → plan + locate,
 * finding → collect places, researching → judge the next place. The page calls this again until "done".
 * Runs on the team key pool (own key, then lent keys, then the Mistral backup) with the caller's permissions (RLS).
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
  if (s.status === "done" || s.status === "failed") return NextResponse.json({ status: s.status });
  // Team key pool: my key first, then keys members lend to Scout (only after the can_scout check above)
  const { data: meId } = await sb.rpc("my_profile_id");
  const key = await scoutRing(meId as string, keyRow);
  if (!key) return NextResponse.json({ error: "no-key" }, { status: 400 });
  const locale = await getLocale();
  const { data: project } = await sb.from("scout_projects").select("*").eq("id", s.project_id).single();
  const log: LogLine[] = Array.isArray(s.log) ? s.log : [];
  const tokens = () => Math.round(((s.tokens ?? 0) + key.tokens) / 1000);
  const save = (patch: Record<string, unknown>) => {
    if (key.usedLent && !log.some((l) => l.k === "pool")) log.push(line("pool", { n: key.keys.filter((k) => !k.own).length }));
    return sb.from("scout_searches").update({ ...patch, tokens: (s.tokens ?? 0) + key.tokens, log: log.slice(-80) }).eq("id", id);
  };
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
    // All sources at once: OpenStreetMap, Overture (Open Places API, if a key is set) and the web search
    const queries = (s.web_queries as string[]).map((q) => q.replace(/\{city\}/g, "").trim()).filter(Boolean);
    const [osm, ovt, w] = await Promise.all([
      s.osm_tags.length ? osmPlaces(s.osm_tags, s.lat, s.lng, Number(s.radius_km)) : Promise.resolve([]),
      openPlaces(queries, s.lat, s.lng, Number(s.radius_km)),
      s.web_queries.length ? webFind(key, s.web_queries, s.city, s.country_code) : Promise.resolve([]),
    ]);
    log.push(line(osm === null ? "osmDown" : "osm", { n: osm?.length ?? 0, km: Number(s.radius_km), city: s.city }));
    if (ovt?.length) log.push(line("overture", { n: ovt.length }));
    let web: FoundPlace[] = [];
    {
      if (!("error" in w)) {
        web = w.map((x) => ({ name: x.name, category: null, address: x.address, lat: null, lng: null, website: x.website, phone: null, instagram: x.instagram, email_public: null, opening_hours: null, osm_id: null }));
        log.push(line("web", { n: web.length }));
      }
    }
    const rows = [...(await upsertPlaces(sb, osm ?? [], s.city, s.country_code, "osm")), ...(await upsertPlaces(sb, ovt ?? [], s.city, s.country_code, "overture")), ...(await upsertPlaces(sb, web, s.city, s.country_code, "web"))];
    const unique = [...new Map(rows.filter((r) => !r.forgotten).map((r) => [r.id, r])).values()];
    const { data: judged } = await sb.from("scout_leads").select("place_id").eq("project_id", s.project_id).in("place_id", unique.map((r) => r.id));
    const known = new Set((judged ?? []).map((j) => j.place_id));
    // Candidates for the relevance filter: nearest/most reachable first, at most 60 per search
    const fresh = researchOrder(unique.filter((r) => !known.has(r.id)), s.lat, s.lng).slice(0, 60);
    log.push(line("known", { known: known.size, todo: fresh.length }));
    if (unique.length < 10) log.push(line("fewPlaces", { n: unique.length }));
    if (!fresh.length) { log.push(line("done", { strong: 0, good: 0, skip: 0 }), line("tokens", { tokens: tokens() })); await save({ status: "done", found: unique.length, known: known.size }); return NextResponse.json({ status: "done" }); }
    await save({ status: "filtering", found: unique.length, known: known.size, queue: fresh.map((r) => r.id) });
    return NextResponse.json({ status: "filtering", places: fresh.map((r) => ({ id: r.id, lat: r.lat, lng: r.lng })) });
  }

  // ── 2b. One fast call drops the wrong KIND of places before any research ──
  if (s.status === "filtering") {
    const ids = s.queue as string[];
    const { data: cands } = await sb.from("scout_places").select("id, name, category").in("id", ids);
    const list = ids.map((pid) => (cands ?? []).find((c) => c.id === pid)).filter(Boolean) as { id: string; name: string; category: string | null }[];
    const r = await relevance(key, project as Project, project.plan as Plan | null, list);
    if ("error" in r) { if (r.error === "limit") { log.push(line("waiting", { s: r.retryAfter ?? 60 })); await save({}); return limit(r); } }
    const keep = "error" in r ? list : list.filter((_, i) => r.keep.has(i));
    const drop = "error" in r ? [] : list.map((c, i) => ({ c, i })).filter(({ i }) => !r.keep.has(i));
    if (drop.length) await sb.from("scout_leads").upsert(drop.map(({ c, i }) => ({ project_id: s.project_id, place_id: c.id, search_id: id, score: 0, fit: "skip", worth_it: false, evidence: "none", why: `Not a match: ${r && !("error" in r) ? r.reasons.get(i) ?? "not the right kind of place" : ""}` })), { onConflict: "project_id,place_id", ignoreDuplicates: true });
    const queue = keep.slice(0, s.max_places).map((c) => c.id);
    log.push(line("filtered", { keep: keep.length, drop: drop.length }));
    if (!queue.length) return finish();
    await save({ status: "researching", queue });
    return NextResponse.json({ status: "researching", left: queue.length });
  }

  // ── 3. Research + judge the next TWO places in parallel (separate free model quotas, fits the 60 s limit) ──
  const batch = (s.queue as string[]).slice(0, 2), rest = (s.queue as string[]).slice(2);
  if (!batch.length) return finish();
  const { data: places } = await sb.from("scout_places").select("*").in("id", batch);
  const results = await Promise.all((places ?? []).filter((p) => !p.forgotten).map(async (place) => ({ place, r: await researchAndJudge(sb, key, { place: place as PlaceRow, project: project as Project & { id: string }, plan: project.plan as Plan | null, searchId: id, locale }) })));
  const limited = results.find(({ r }) => "error" in r && r.error === "limit");
  const doneIds = results.filter(({ r }) => !("error" in r && r.error === "limit")).map(({ place }) => place.id as string);
  for (const { place, r } of results) {
    if ("error" in r) { if (r.error !== "limit") log.push(line("failedPlace", { name: place.name }, { place_id: place.id })); continue; }
    if (r.pages) log.push(line("read", { name: place.name, n: r.pages }, { url: place.website ?? undefined, place_id: place.id }));
    log.push(line("scored", { name: place.name, fit: r.lead.fit, score: r.lead.score }, { place_id: place.id }));
  }
  const leftover = [...batch.filter((b) => !doneIds.includes(b)), ...rest];
  await save({ queue: leftover, researched: s.researched + doneIds.length });
  if (limited) { const l = (limited.r as { retryAfter?: number }).retryAfter ?? 60; log.push(line("waiting", { s: l })); await save({}); return limit({ error: "limit", retryAfter: l }); }
  const restQueue = leftover;
  if (!restQueue.length) return finish();
  return NextResponse.json({ status: "researching", left: restQueue.length });

  async function finish() {
    const { data: leads } = await sb.from("scout_leads").select("fit").eq("search_id", id);
    const n = (f: string) => (leads ?? []).filter((l) => l.fit === f).length;
    log.push(line("done", { strong: n("strong"), good: n("good"), skip: n("skip") + n("maybe") }), line("tokens", { tokens: tokens() }));
    await save({ status: "done", queue: [] });
    return NextResponse.json({ status: "done" });
  }
}
