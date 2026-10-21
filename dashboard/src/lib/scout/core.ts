// Scout's pure logic: no network, no database, so it can be unit-tested.
// The AI collects evidence and sub-scores; the app does the maths (same rule as the Idea lab).

export const CRITERIA = [
  { key: "need", weight: 0.25 },          // do they visibly have the problem we solve?
  { key: "fit", weight: 0.2 },            // match the ideal client, no deal-breakers
  { key: "ability_to_pay", weight: 0.15 },
  { key: "reachability", weight: 0.15 },  // can we reach a decision-maker?
  { key: "timing", weight: 0.1 },         // new opening, season, recent change
  { key: "value_vs_effort", weight: 0.1 },
  { key: "low_risk", weight: 0.05 },      // 10 = safe (not a chain run from HQ, open, friendly)
] as const;
export type CriterionKey = (typeof CRITERIA)[number]["key"];
export type Fit = "strong" | "good" | "maybe" | "skip";
export type Criterion = { key: CriterionKey; score: number; why: string; source?: string };
export type Approach = { channel: string; opener: string; best_time: string; who_to_ask_for: string; objections: { objection: string; answer: string }[] };
export type Judgement = {
  criteria: Criterion[]; dealBreaker: string | null; why: string; attack_with: string; approach: Approach | null; signals: { text: string; url?: string }[];
  score: number; fit: Fit; worth_it: boolean;
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Weighted 0–100 from 0–10 sub-scores. Missing criteria count as 3: what we can't show counts against the lead. */
export const UNKNOWN = 3;
export function scoreOf(criteria: { key: string; score: number }[]): number {
  let total = 0;
  for (const c of CRITERIA) {
    const s = criteria.find((x) => x.key === c.key)?.score;
    total += c.weight * (typeof s === "number" && Number.isFinite(s) ? clamp(s, 0, 10) : UNKNOWN);
  }
  return Math.round(total * 10);
}

export function fitOf(score: number, dealBreaker: boolean): Fit {
  if (dealBreaker) return "skip";
  return score >= 75 ? "strong" : score >= 60 ? "good" : score >= 45 ? "maybe" : "skip";
}

const str = (v: unknown, max = 600) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const url = (v: unknown) => { const s = str(v, 500); return /^https?:\/\//.test(s) ? s : undefined; };

/** Validate the AI's JSON verdict; the score, fit and "worth it" are always computed here. */
export function normalizeJudgement(raw: unknown): Judgement | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const crit = Array.isArray(r.criteria) ? r.criteria : [];
  const criteria: Criterion[] = CRITERIA.map(({ key }) => {
    const c = crit.find((x) => x && typeof x === "object" && (x as { key?: unknown }).key === key) as Record<string, unknown> | undefined;
    const n = Number(c?.score);
    return { key, score: Number.isFinite(n) ? clamp(Math.round(n), 0, 10) : UNKNOWN, why: str(c?.why, 300) || "—", source: url(c?.source) };
  });
  if (!crit.length) return null;
  const db = str(r.deal_breaker, 200);
  const dealBreaker = db && !/^(null|none|no|n\/a|unknown|ninguno|-|—)\.?$/i.test(db) ? db : null;
  const score = scoreOf(criteria);
  const fit = fitOf(score, !!dealBreaker);
  const a = r.approach as Record<string, unknown> | undefined;
  const approach: Approach | null = a && typeof a === "object" && str(a.opener) ? {
    channel: str(a.channel, 60), opener: str(a.opener, 800), best_time: str(a.best_time, 120), who_to_ask_for: str(a.who_to_ask_for, 120),
    objections: (Array.isArray(a.objections) ? a.objections : []).slice(0, 3).map((o) => ({ objection: str((o as Record<string, unknown>)?.objection, 200), answer: str((o as Record<string, unknown>)?.answer, 300) })).filter((o) => o.objection),
  } : null;
  const signals = (Array.isArray(r.signals) ? r.signals : []).slice(0, 8).map((s) => ({ text: str((s as Record<string, unknown>)?.text, 240), url: url((s as Record<string, unknown>)?.url) })).filter((s) => s.text);
  return { criteria, dealBreaker, why: str(r.why, 700), attack_with: str(r.attack_with, 500), approach: fit === "strong" || fit === "good" ? approach : null, signals, score, fit, worth_it: score >= 60 && !dealBreaker };
}

/** One key per real-world place, so the same business is never collected or researched twice. */
export function fingerprint(p: { name: string; lat?: number | null; lng?: number | null; website?: string | null }): string {
  const domain = domainOf(p.website);
  if (domain) return `d:${domain}`;
  const name = p.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  // ~110 m grid: the same shop found twice on the map lands in the same cell
  const pos = p.lat != null && p.lng != null ? `${p.lat.toFixed(3)},${p.lng.toFixed(3)}` : "?";
  return `n:${name}|${pos}`;
}

export function domainOf(website?: string | null): string | null {
  if (!website) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
    const h = u.hostname.toLowerCase().replace(/^www\./, "");
    // Social profiles and link-in-bio pages are not the business's own domain
    if (/(^|\.)(instagram|facebook|tiktok|linktr|google|goo|wa|whatsapp|booksy|treatwell|tripadvisor|thefork)\./.test(h + ".")) return null;
    return h.includes(".") ? h : null;
  } catch { return null; }
}

/**
 * Read a pasted Google Maps link without fetching Google: place name and coordinates from the URL.
 * Short links (maps.app.goo.gl) must be expanded first by following the redirect (see resolveMapsLink in web.ts).
 */
export function parseMapsLink(link: string): { name: string | null; lat: number | null; lng: number | null } | null {
  let u: URL;
  try { u = new URL(link.trim()); } catch { return null; }
  if (!/(^|\.)google\.[a-z.]+$/.test(u.hostname) && !/^maps\.app\.goo\.gl$|^goo\.gl$/.test(u.hostname)) return null;
  const path = decodeURIComponent(u.pathname.replace(/\+/g, " "));
  const place = path.match(/\/place\/([^/@]+)/)?.[1]?.trim() || u.searchParams.get("q")?.replace(/\+/g, " ") || u.searchParams.get("query") || null;
  // Exact pin (!3d lat !4d lng) beats the map's centre (@lat,lng)
  const pin = u.href.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/), at = path.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const ll = pin ?? at;
  const isCoords = place && /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(place);
  return { name: place && !isCoords ? place : null, lat: ll ? Number(ll[1]) : isCoords ? Number(place!.split(",")[0]) : null, lng: ll ? Number(ll[2]) : isCoords ? Number(place!.split(",")[1]) : null };
}

/** Main OpenStreetMap keys that identify what a business IS (others like cuisine= or opening_hours= only describe it). */
export const OSM_KEYS = ["shop", "amenity", "craft", "office", "leisure", "tourism", "healthcare", "club", "sport"] as const;

/**
 * Overpass QL for named businesses with any of the given tags (e.g. "amenity=cafe", "shop=*") inside a box of
 * radius_km around a point. One regex filter per key and a bounding box keep it fast on the free public servers.
 */
export function overpassQuery(tags: string[], lat: number, lng: number, radiusKm: number, limit = 150): string {
  const r = clamp(radiusKm, 0.5, 30);
  const dLat = r / 111, dLng = r / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const bbox = [lat - dLat, lng - dLng, lat + dLat, lng + dLng].map((x) => x.toFixed(5)).join(",");
  const byKey = new Map<string, Set<string>>();
  for (const t of tags) {
    const m = t.trim().match(/^([a-z_]+)=([a-z0-9_;:-]+|\*)$/i);
    if (!m || !(OSM_KEYS as readonly string[]).includes(m[1].toLowerCase())) continue;
    const k = m[1].toLowerCase();
    byKey.set(k, (byKey.get(k) ?? new Set()).add(m[2].toLowerCase()));
  }
  const parts = [...byKey].slice(0, 6).map(([k, vals]) => vals.has("*") ? `nwr["${k}"]["name"](${bbox});` : `nwr["${k}"~"^(${[...vals].slice(0, 12).join("|")})$"]["name"](${bbox});`);
  return `[out:json][timeout:20];(${parts.join("")});out center tags ${limit};`;
}

type OsmEl = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };
export type FoundPlace = { name: string; category: string | null; address: string | null; lat: number | null; lng: number | null; website: string | null; phone: string | null; instagram: string | null; email_public: string | null; opening_hours: string | null; osm_id: string | null };

/** Turn Overpass elements into places (business data only: no personal names). */
export function placesFromOsm(elements: OsmEl[]): FoundPlace[] {
  const out: FoundPlace[] = [];
  for (const e of elements) {
    const t = e.tags ?? {};
    if (!t.name || t.disused || t["disused:shop"]) continue;
    const lat = e.lat ?? e.center?.lat ?? null, lng = e.lon ?? e.center?.lon ?? null;
    const insta = t["contact:instagram"] || t.instagram || null;
    out.push({
      name: t.name.slice(0, 160),
      category: t.shop ? `shop=${t.shop}` : t.amenity ? `amenity=${t.amenity}` : t.craft ? `craft=${t.craft}` : t.office ? `office=${t.office}` : t.leisure ? `leisure=${t.leisure}` : t.tourism ? `tourism=${t.tourism}` : t.healthcare ? `healthcare=${t.healthcare}` : null,
      address: [t["addr:street"] && `${t["addr:street"]} ${t["addr:housenumber"] ?? ""}`.trim(), t["addr:postcode"], t["addr:city"]].filter(Boolean).join(", ") || null,
      lat, lng,
      website: t.website || t["contact:website"] || null,
      phone: t.phone || t["contact:phone"] || null,
      instagram: insta ? (insta.startsWith("http") ? insta : `https://instagram.com/${insta.replace(/^@/, "")}`) : null,
      email_public: t.email || t["contact:email"] || null,
      opening_hours: t.opening_hours || null,
      osm_id: `${e.type}/${e.id}`,
    });
  }
  return out;
}

/** Order to research found places: ones with a website/Instagram first (more evidence), then by distance to the centre. */
export function researchOrder<T extends { website: string | null; instagram: string | null; lat: number | null; lng: number | null }>(places: T[], lat: number, lng: number): T[] {
  const d = (p: T) => (p.lat == null || p.lng == null ? 99 : Math.hypot(p.lat - lat, (p.lng - lng) * Math.cos((lat * Math.PI) / 180)));
  return [...places].sort((a, b) => Number(!!(b.website || b.instagram)) - Number(!!(a.website || a.instagram)) || d(a) - d(b));
}

/** Product economics from the Idea lab numbers (from the profit-check method): break-even ROAS and CPA. */
export function unitEconomics(priceText: string, costText: string, feeRate = 0.03) {
  const num = (s: string) => { const m = s.replace(/\s/g, "").replace(/(\d)[.,](\d{3})(?!\d)/g, "$1$2").match(/-?\d+(?:[.,]\d+)?/); return m ? Number(m[0].replace(",", ".")) : NaN; };
  const price = num(priceText), cost = num(costText);
  if (!(price > 0) || !(cost >= 0)) return null;
  const fees = Math.round(price * feeRate * 100) / 100;
  const profit = price - cost - fees;
  return { price, cost, fees, profit: Math.round(profit * 100) / 100, margin: profit / price, breakEvenRoas: profit > 0 ? Math.round((price / profit) * 100) / 100 : null, breakEvenCpa: Math.round(profit * 100) / 100 };
}

// ── Scout v2 phase 1 ──────────────────────────────────────────────────────────

export type Evidence = "strong" | "some" | "little" | "none";
/** How much real evidence a verdict rests on: pages read from their website + sources from the web search. */
export function evidenceLevel(pages: number, sources: number): Evidence {
  if (pages >= 1 && sources >= 3) return "strong";
  if (pages >= 1 || sources >= 2) return "some";
  return "little";
}
/** Little evidence: at most "maybe", never "worth it" — we don't recommend what we couldn't check. */
export function applyEvidence(j: { fit: Fit; worth_it: boolean }, level: Evidence): { fit: Fit; worth_it: boolean } {
  if (level !== "little" && level !== "none") return j;
  return { fit: j.fit === "strong" || j.fit === "good" ? "maybe" : j.fit, worth_it: false };
}

/** The place in Google Maps: a saved Google link, else the exact spot (Google shows the business there), else a search. */
export function mapsLink(p: { name: string; maps_url: string | null; lat: number | null; lng: number | null; address: string | null; city: string | null }): string {
  if (p.maps_url) return p.maps_url;
  const name = encodeURIComponent(p.name);
  if (p.lat != null && p.lng != null) return `https://www.google.com/maps/place/${name}/@${p.lat},${p.lng},19z`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([p.name, p.address ?? p.city].filter(Boolean).join(", "))}`;
}

/** The relevance filter's reply → which candidates (0..n-1) are the right kind of place. If the reply is unusable, keep all. */
export function parseRelevance(raw: unknown, n: number): { keep: Set<number>; reasons: Map<number, string> } {
  const r = (raw && typeof raw === "object" ? raw : {}) as { match?: unknown; not_match?: unknown };
  const keep = new Set((Array.isArray(r.match) ? r.match : []).map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < n));
  const reasons = new Map<number, string>();
  for (const x of Array.isArray(r.not_match) ? r.not_match : []) {
    const i = Number((x as { n?: unknown })?.n);
    if (Number.isInteger(i) && i >= 0 && i < n && !keep.has(i)) reasons.set(i, str((x as { why?: unknown })?.why, 160) || "not the right kind of place");
  }
  if (!keep.size && !reasons.size) return { keep: new Set(Array.from({ length: n }, (_, i) => i)), reasons };
  return { keep, reasons };
}

const norm = (u: string) => u.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "");
/** Enrichment: keep a link only if the web search really returned it (as that exact page), and a phone only if it's in the notes. */
export function keepRealLinks(c: { official_website?: unknown; instagram?: unknown; google_maps_url?: unknown; phone?: unknown }, resultUrls: string[], notes: string) {
  const found = (v: unknown) => { const s = str(v, 400); if (!/^https?:\/\//.test(s)) return null; return resultUrls.find((u) => norm(u) === norm(s)) ?? null; };
  const phone = str(c.phone, 40);
  const digits = phone.replace(/[^\d+]/g, "");
  return {
    website: found(c.official_website),
    instagram: (() => { const u = found(c.instagram); return u && /instagram\.com\//i.test(u) ? u : null; })(),
    maps_url: (() => { const u = found(c.google_maps_url); return u && /google\.[a-z.]+\/maps|maps\.app\.goo\.gl/i.test(u) ? u : null; })(),
    phone: digits.replace(/\D/g, "").length >= 9 && notes.includes(phone) ? phone : null,
  };
}

/** Open Places API (Overture Maps) results → places. Closed places are skipped. */
export type OpenPlace = { place_id: string; name: string; lat: number; lon: number; distance_mi?: number; categories?: string[]; category?: string;
  address?: { formatted?: string; street?: string; locality?: string }; phone?: string; website?: string; confidence?: number; operating_status?: string };
export function placesFromOpenPlaces(results: OpenPlace[]): FoundPlace[] {
  return results.filter((r) => r?.name && !/closed/i.test(r.operating_status ?? "")).map((r) => ({
    name: r.name.slice(0, 160), category: r.category ?? r.categories?.[0] ?? null,
    address: r.address?.formatted ?? ([r.address?.street, r.address?.locality].filter(Boolean).join(", ") || null),
    lat: Number.isFinite(r.lat) ? r.lat : null, lng: Number.isFinite(r.lon) ? r.lon : null,
    website: r.website && /^https?:\/\//.test(r.website) ? r.website.slice(0, 300) : null, phone: r.phone?.slice(0, 40) ?? null,
    instagram: null, email_public: null, opening_hours: null, osm_id: `ovt:${r.place_id}`,
  }));
}

/** Web-search finds: keep a place only if the search really returned it — its website/Instagram is one of the result
 *  URLs, or its name appears in a result title. Anything else may be invented by the AI and is dropped. */
export function verifyWebPlaces<T extends { name: string; website: string | null; instagram: string | null }>(places: T[], results: { title: string; url: string }[]): T[] {
  const byUrl = (u: string | null) => (u ? results.find((r) => norm(r.url) === norm(u))?.url ?? null : null);
  const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const titles = results.map((r) => ` ${plain(r.title)} `);
  const out: T[] = [];
  for (const p of places) {
    const website = byUrl(p.website), instagram = byUrl(p.instagram);
    const named = plain(p.name).length >= 4 && titles.some((t) => t.includes(` ${plain(p.name)} `));
    if (website || instagram || named) out.push({ ...p, website, instagram });
  }
  return out;
}
