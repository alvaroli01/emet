import "server-only";
import { overpassQuery, placesFromOsm, placesFromOpenPlaces, type FoundPlace, type OpenPlace } from "./core";
import { pickLinks } from "./signals";

// Free, legal data sources only: OpenStreetMap (Nominatim + Overpass) and the business's own public website.
// No Google scraping (against Google's terms and blocked from servers). See docs/lead-finder-build-prompt.md §1.

const UA = "emet-hq/1.0 (student team dashboard; https://emet-hq.vercel.app)";
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];

async function timed(url: string, init: RequestInit = {}, ms = 8000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctrl.signal, headers: { "User-Agent": UA, ...(init.headers ?? {}) } }); }
  finally { clearTimeout(id); }
}

/** Overture Maps places via the Open Places API (free 10,000 searches/month; stops at the cap, never bills).
 *  Only used when OPEN_PLACES_API_KEY is set. One request per query, in parallel; null when the service is down. */
export async function openPlaces(queries: string[], lat: number, lng: number, radiusKm: number): Promise<FoundPlace[] | null> {
  const key = process.env.OPEN_PLACES_API_KEY;
  if (!key || !queries.length) return [];
  const radius = Math.min(50, Math.max(0.5, radiusKm * 0.621)).toFixed(1);
  const res = await Promise.all(queries.slice(0, 4).map(async (q) => {
    const p = new URLSearchParams({ q, lat: String(lat), lon: String(lng), radius_mi: radius, limit: "20", min_confidence: "0.6" });
    const r = await timed(`https://api.openplacesapi.com/v1/places?${p}`, { headers: { Authorization: `Bearer ${key}` } }, 7000).catch(() => null);
    if (!r?.ok) return null;
    const j = (await r.json().catch(() => null)) as { results?: OpenPlace[] } | null;
    return placesFromOpenPlaces(j?.results ?? []);
  }));
  if (res.every((x) => x === null)) return null;
  return res.flatMap((x) => x ?? []);
}

export type City = { name: string; country_code: string; lat: number; lng: number; bbox: number[] };

/** City search for the picker (Nominatim, max 1 request/second by policy: the UI debounces and the browser caches). */
export async function findCities(q: string, country?: string, lang = "en"): Promise<City[]> {
  const p = new URLSearchParams({ q, format: "jsonv2", limit: "6", addressdetails: "1", featureType: "city", "accept-language": lang });
  if (country) p.set("countrycodes", country.toLowerCase());
  const res = await timed(`https://nominatim.openstreetmap.org/search?${p}`, {}, 6000).catch(() => null);
  if (!res?.ok) return [];
  const rows = (await res.json()) as { display_name: string; lat: string; lon: string; boundingbox: string[]; address?: { country_code?: string } }[];
  return rows.map((r) => ({ name: r.display_name.split(",").slice(0, 3).join(","), country_code: (r.address?.country_code ?? country ?? "").toUpperCase(), lat: Number(r.lat), lng: Number(r.lon), bbox: r.boundingbox.map(Number) }));
}

/** Businesses around a point from OpenStreetMap. The free public servers are often busy, so all mirrors are asked at once
 *  and the first good answer wins; null = all busy (the search then relies on web search). */
export async function osmPlaces(tags: string[], lat: number, lng: number, radiusKm: number): Promise<FoundPlace[] | null> {
  const data = overpassQuery(tags, lat, lng, radiusKm);
  if (!data.includes("nwr[")) return [];
  try {
    return await Promise.any(OVERPASS.map(async (url) => {
      const res = await timed(url, { method: "POST", body: new URLSearchParams({ data }) }, 14000);
      if (!res.ok) throw new Error(String(res.status));
      return placesFromOsm(((await res.json()) as { elements?: [] }).elements ?? []);
    }));
  } catch { return null; }
}

/** robots.txt check for a path (simple: the "*" group's Disallow rules). Unreachable robots.txt = allowed. */
async function robotsAllows(u: URL): Promise<boolean> {
  const res = await timed(`${u.origin}/robots.txt`, {}, 3000).catch(() => null);
  if (!res?.ok) return true;
  const lines = (await res.text()).split(/\r?\n/).map((l) => l.replace(/#.*/, "").trim());
  let inStar = false; const rules: string[] = [];
  for (const l of lines) {
    const [k, ...rest] = l.split(":"); const v = rest.join(":").trim();
    if (/^user-agent$/i.test(k)) inStar = v === "*";
    else if (inStar && /^disallow$/i.test(k) && v) rules.push(v);
  }
  return !rules.some((r) => u.pathname.startsWith(r));
}

const strip = (html: string) => html
  .replace(/<(script|style|noscript|svg|iframe)[\s\S]*?<\/\1>/gi, " ")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#\d+;|&[a-z]+;/gi, " ")
  .replace(/\s+/g, " ").trim();

export type Page = { url: string; text: string; robots_ok: boolean };

/** Read up to 3 pages of a business's own site (home + about/services + contact), 500 KB each, text only. */
export async function readSite(website: string): Promise<Page[]> {
  let home: URL;
  try { home = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`); } catch { return []; }
  if (!(await robotsAllows(home))) return [{ url: home.href, text: "", robots_ok: false }];
  const out: Page[] = [];
  const get = async (u: string) => {
    const res = await timed(u, { headers: { Accept: "text/html" }, redirect: "follow" }, 7000).catch(() => null);
    if (!res?.ok || !(res.headers.get("content-type") ?? "").includes("html")) return null;
    const raw = (await res.text()).slice(0, 500_000);
    return raw;
  };
  const raw = await get(home.href);
  if (!raw) return [];
  out.push({ url: home.href, text: strip(raw).slice(0, 4000), robots_ok: true });
  // Follow up to two about/services/menu pages and one hiring/news page (where "reasons to contact today" live)
  const links = [...raw.matchAll(/href=["']([^"'#]+)["']/gi)].map((m) => { try { return new URL(m[1], home); } catch { return null; } })
    .filter((u): u is URL => !!u && u.hostname === home.hostname);
  const byPath = new Map(links.map((u) => [u.pathname, u]));
  const picked = pickLinks([...byPath.keys()]).map((p) => byPath.get(p)!);
  for (const u of picked) {
    if (!(await robotsAllows(u))) continue;
    const r = await get(u.href);
    if (r) out.push({ url: u.href, text: strip(r).slice(0, 3000), robots_ok: true });
  }
  return out;
}

/** Expand a short Google Maps link (maps.app.goo.gl) by following its redirect header only — Google's page is never read. */
export async function resolveMapsLink(link: string): Promise<string> {
  if (!/^https?:\/\/(maps\.app\.goo\.gl|goo\.gl)\//i.test(link)) return link;
  let current = link;
  for (let i = 0; i < 4; i++) {
    const res = await timed(current, { redirect: "manual" }, 5000).catch(() => null);
    const next = res?.headers.get("location");
    if (!next) break;
    current = new URL(next, current).href;
    if (/google\.[a-z.]+\/maps/.test(current)) break;
  }
  return current;
}

/** Look up one place on OpenStreetMap by name near a point (for pasted links). */
export async function osmLookup(name: string, lat: number | null, lng: number | null): Promise<FoundPlace | null> {
  const p = new URLSearchParams({ q: name, format: "jsonv2", limit: "1", extratags: "1", addressdetails: "1" });
  if (lat != null && lng != null) { p.set("viewbox", `${lng - 0.01},${lat + 0.01},${lng + 0.01},${lat - 0.01}`); p.set("bounded", "1"); }
  const res = await timed(`https://nominatim.openstreetmap.org/search?${p}`, {}, 6000).catch(() => null);
  if (!res?.ok) return null;
  const [r] = (await res.json()) as { osm_type: string; osm_id: number; lat: string; lon: string; name?: string; category?: string; type?: string; extratags?: Record<string, string>; address?: Record<string, string> }[];
  if (!r) return null;
  const [place] = placesFromOsm([{ type: r.osm_type, id: r.osm_id, lat: Number(r.lat), lon: Number(r.lon), tags: { name: r.name || name, [r.category ?? "amenity"]: r.type ?? "yes", ...(r.extratags ?? {}),
    ...(r.address?.road ? { "addr:street": r.address.road, "addr:housenumber": r.address.house_number ?? "", "addr:postcode": r.address.postcode ?? "", "addr:city": r.address.city ?? r.address.town ?? "" } : {}) } }]);
  return place ?? null;
}
