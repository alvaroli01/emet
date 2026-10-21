import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { scoutRing } from "@/lib/ai/ring-server";
import { parseMapsLink, type FoundPlace } from "@/lib/scout/core";
import { osmLookup, resolveMapsLink } from "@/lib/scout/web";
import { planProject, type Plan, type Project } from "@/lib/scout/ai";
import { upsertPlaces, researchAndJudge } from "@/lib/scout/run";

export const maxDuration = 60;

/** "Check a place": a pasted Google Maps link, website or Instagram profile → the same verdict as a search, remembered. */
export async function POST(request: NextRequest) {
  const { project_id, input, city = "", country = "" } = (await request.json().catch(() => ({}))) as { project_id?: string; input?: string; city?: string; country?: string };
  const raw = input?.trim();
  if (!project_id || !raw || raw.length > 2000) return NextResponse.json({ error: "bad-request" }, { status: 400 });
  const sb = await createClient();
  const [{ data: project }, { data: canScout }, { data: keyRow }] = await Promise.all([
    sb.from("scout_projects").select("*").eq("id", project_id).maybeSingle(),
    sb.rpc("can_scout"),
    sb.from("ai_keys").select("key_iv, key_data").maybeSingle(),
  ]);
  if (!project) return NextResponse.json({ error: "not-found" }, { status: 404 });
  if (!canScout) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // Team key pool: my key first, then keys members lend to Scout (only after the can_scout check above)
  const { data: meId } = await sb.rpc("my_profile_id");
  const key = await scoutRing(meId as string, keyRow);
  if (!key) return NextResponse.json({ error: "no-key" }, { status: 400 });
  const locale = await getLocale();

  const url = /^https?:\/\//i.test(raw) ? raw : /^[\w-]+(\.[\w-]+)+(\/|$)/.test(raw) ? `https://${raw}` : null;
  let found: FoundPlace | null = null;
  const blank: FoundPlace = { name: "", category: null, address: null, lat: null, lng: null, website: null, phone: null, instagram: null, email_public: null, opening_hours: null, osm_id: null };
  const maps = url ? parseMapsLink(await resolveMapsLink(url)) : null;
  if (maps) {
    if (!maps.name && maps.lat == null) return NextResponse.json({ error: "unreadable-link" }, { status: 400 });
    found = (maps.name ? await osmLookup(maps.name, maps.lat, maps.lng) : null) ?? { ...blank, name: maps.name ?? `${maps.lat},${maps.lng}`, lat: maps.lat, lng: maps.lng };
  } else if (url && /instagram\.com\//i.test(url)) {
    const handle = url.replace(/\/$/, "").split("/").pop() ?? "instagram";
    found = { ...blank, name: `@${handle}`, instagram: url };
  } else if (url) {
    found = { ...blank, name: new URL(url).hostname.replace(/^www\./, ""), website: url };
  } else {
    // Plain name: look it up on the map
    found = (await osmLookup(raw, null, null)) ?? { ...blank, name: raw.slice(0, 160) };
  }

  const [place] = await upsertPlaces(sb, [found], city, country.toUpperCase().slice(0, 2), "manual");
  if (!place) return NextResponse.json({ error: "save" }, { status: 500 });
  if (place.forgotten) return NextResponse.json({ error: "forgotten" }, { status: 409 });
  let plan = project.plan as Plan | null;
  if (!plan) {
    const p = await planProject(key, project as Project, country || "ES", locale);
    if (!("error" in p)) { plan = p; await sb.from("scout_projects").update({ plan }).eq("id", project.id); }
  }
  const r = await researchAndJudge(sb, key, { place, project: project as Project & { id: string }, plan, searchId: null, locale });
  if ("error" in r) return NextResponse.json(r, { status: r.error === "limit" ? 429 : 502 });
  return NextResponse.json({ ok: true, lead: r.lead });
}
