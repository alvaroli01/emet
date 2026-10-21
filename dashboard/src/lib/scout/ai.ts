import "server-only";
import { call, CONTEXT, LANG, type Fail } from "@/lib/lab/ai";
import { CRITERIA, normalizeJudgement, parseRelevance, keepRealLinks, verifyWebPlaces, type Judgement } from "./core";
import type { KeyRing } from "@/lib/ai/pool";
import { PLAN_MODELS, FIND_MODELS, WEB_MODELS, RELEVANCE_MODELS, JUDGE_MODELS } from "./models";
import { PLAYBOOKS, PLAYBOOK_KEYS, type PlaybookKey } from "./playbooks";

/** Scout's AI steps, run on the team key pool (own key first, then lent keys, then the Mistral backup). */

export type Project = { title: string; offer: string; niche: string; ideal_client: string | null; must_have: string[]; deal_breakers: string[]; avg_deal_value: number | null };
export type Plan = { osm_tags: string[]; web_queries: string[]; signals: string[]; deal_breakers: string[]; playbook: PlaybookKey; summary: string };

const project = (p: Project) => `PROJECT "${p.title}"
What we sell: ${p.offer}
Kind of business we target: ${p.niche}
Ideal client: ${p.ideal_client || "(not described)"}
Must have: ${p.must_have.join("; ") || "(none)"}
Deal-breakers: ${p.deal_breakers.join("; ") || "(none)"}
Average deal value: ${p.avg_deal_value ? `€${p.avg_deal_value}` : "(unknown)"}`;

const json = (r: { message: Record<string, unknown> }) => { try { return JSON.parse(String(r.message.content ?? "{}")); } catch { return null; } };

/** Step A: understand the project once (cached on the project): what to search for and what makes a good client. */
export async function planProject(key: string | KeyRing, p: Project, country: string, locale: string): Promise<Plan | Fail> {
  const r = await call(key, {
    reasoning_effort: "low", temperature: 0.2, response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "You are a B2B sales strategist who knows every kind of local business and OpenStreetMap tagging. Reply with JSON only." },
      { role: "user", content: `${CONTEXT}

${project(p)}
Country of the search: ${country}

Return JSON:
{
  "osm_tags": ["2-8 OpenStreetMap key=value tags for WHAT the target businesses are, using only these keys: shop, amenity, craft, office, leisure, tourism, healthcare, club, sport. e.g. amenity=cafe, shop=hairdresser, leisure=fitness_centre. No descriptive tags like cuisine= or outdoor_seating"],
  "web_queries": ["2-4 short web search queries in the local language of ${country} to find these businesses in a city; use {city} as placeholder"],
  "signals": ["5-8 visible signs that a business NEEDS this offer (things we can check on their website/Instagram/reviews)"],
  "deal_breakers": ["2-5 signs it is NOT worth it (add the user's own)"],
  "playbook": "one of: ${PLAYBOOK_KEYS.join(", ")}",
  "summary": "one sentence in ${LANG[locale] ?? "English"}: who we're looking for and why"
}` },
    ],
  }, PLAN_MODELS);
  if (!("ok" in r)) return r;
  const j = json(r);
  if (!j) return { error: "failed" };
  const arr = (v: unknown, n: number) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").map((x: string) => x.trim()).filter(Boolean).slice(0, n) : []);
  return {
    osm_tags: arr(j.osm_tags, 10).filter((t) => /^(shop|amenity|craft|office|leisure|tourism|healthcare|club|sport)=([a-z0-9_;:-]+|\*)$/i.test(t)),
    web_queries: arr(j.web_queries, 4), signals: arr(j.signals, 8), deal_breakers: [...p.deal_breakers, ...arr(j.deal_breakers, 5)].slice(0, 8),
    playbook: PLAYBOOK_KEYS.includes(j.playbook) ? j.playbook : "b2b_service", summary: String(j.summary ?? "").slice(0, 300),
  };
}

/** Web search for businesses OpenStreetMap is missing. Returns name + website/Instagram found in real search results. */
export async function webFind(key: string | KeyRing, queries: string[], city: string, country: string): Promise<{ name: string; website: string | null; instagram: string | null; address: string | null }[] | Fail> {
  const r = await call(key, {
    reasoning_effort: "low", tools: [{ type: "browser_search" }],
    messages: [{ role: "user", content: `Search the web for local businesses in ${city} (${country}) using these searches: ${queries.map((q) => `"${q.replace("{city}", city)}"`).join(", ")}.
List up to 15 real, currently open businesses you actually found (no chains' head offices, no directories). Reply ONLY with JSON:
{"places":[{"name":"","website":"https://… or null","instagram":"https://instagram.com/… or null","address":"street, city or null"}]}` }],
  }, FIND_MODELS);
  if (!("ok" in r)) return r;
  const text = String(r.message.content ?? "");
  const m = text.match(/\{[\s\S]*\}/);
  // What the search really returned: places not backed by these results are dropped (the AI can invent bars)
  const msg = r.message as { executed_tools?: { search_results?: { results?: { title?: string; url?: string }[] } }[] };
  const results = (msg.executed_tools ?? []).flatMap((t) => t.search_results?.results ?? []).filter((x) => x.url).map((x) => ({ title: String(x.title ?? ""), url: String(x.url) }));
  try {
    const j = JSON.parse(m?.[0] ?? "{}") as { places?: { name?: string; website?: string | null; instagram?: string | null; address?: string | null }[] };
    const ok = (u?: string | null) => (u && /^https?:\/\//.test(u) ? u.slice(0, 300) : null);
    const found = (j.places ?? []).filter((p) => p.name).slice(0, 15).map((p) => ({ name: String(p.name).slice(0, 160), website: ok(p.website), instagram: ok(p.instagram), address: p.address ? String(p.address).slice(0, 200) : null }));
    return verifyWebPlaces(found, results);
  } catch { return []; }
}

/** Before any research: one fast call says which candidates are the right KIND of place for this project. */
export async function relevance(key: string | KeyRing, p: Project, plan: Plan | null, places: { name: string; category: string | null }[]): Promise<{ keep: Set<number>; reasons: Map<number, string> } | Fail> {
  if (!places.length) return { keep: new Set(), reasons: new Map() };
  const r = await call(key, {
    reasoning_effort: "low", temperature: 0, response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "You sort local businesses for a sales team. Judge only by name and category whether each one is the kind of business described. When unsure, keep it. Reply with JSON only." },
      { role: "user", content: `We look for: ${p.niche}. Ideal client: ${p.ideal_client || "(any)"}. Deal-breakers: ${[...(plan?.deal_breakers ?? []), ...p.deal_breakers].join("; ") || "(none)"}.
Candidates:
${places.map((x, i) => `${i}. ${x.name}${x.category ? ` [${x.category}]` : ""}`).join("\n")}
Return {"match":[numbers that ARE this kind of business],"not_match":[{"n":number,"why":"short reason"}]}` },
    ],
  }, RELEVANCE_MODELS);
  if (!("ok" in r)) return r;
  return parseRelevance(json(r), places.length);
}

export type Evidence = { place: { name: string; category: string | null; address: string | null; website: string | null; instagram: string | null; phone: string | null; opening_hours: string | null };
  pages: { url: string; text: string }[]; webNotes: string; webSources: { title: string; url: string }[] };

/** Short web check of one place (reviews, Instagram activity, news) plus its official links — real search results only. */
export type WebCheck = { notes: string; sources: { title: string; url: string }[]; links: { website: string | null; instagram: string | null; maps_url: string | null; phone: string | null } };
export async function webCheck(key: string | KeyRing, name: string, city: string): Promise<WebCheck | Fail> {
  const r = await call(key, {
    reasoning_effort: "low", tools: [{ type: "browser_search" }],
    messages: [{ role: "user", content: `Look up the business "${name}" in ${city}. In 5-8 short bullet points with facts only: what they sell, price level, reviews (rating, count, recurring complaints/praise), Instagram/online activity, size (staff, branches, chain or independent), anything new (opening, renovation, hiring), and their phone number if listed. Say "unknown" when not found. No advice.
Then, on the last line, write exactly one JSON object with links you actually saw in the search results (null if not seen): {"official_website":null,"instagram":null,"google_maps_url":null,"phone":null}` }],
  }, WEB_MODELS);
  if (!("ok" in r)) return r;
  const m = r.message as { content?: string; executed_tools?: { search_results?: { results?: { title?: string; url?: string }[] } }[] };
  const all: { title: string; url: string }[] = [];
  for (const t of m.executed_tools ?? []) for (const x of t.search_results?.results ?? []) if (x.url && /^https?:\/\//.test(x.url) && !all.some((y) => y.url === x.url)) all.push({ title: (x.title ?? x.url).slice(0, 120), url: x.url });
  const text = String(m.content ?? "").replace(/【[^】]*】/g, "");
  const last = text.match(/\{[^{}]*"official_website"[^{}]*\}/);
  let claimed: Record<string, unknown> = {};
  try { claimed = last ? JSON.parse(last[0]) : {}; } catch { /* no links */ }
  const notes = (last ? text.replace(last[0], "") : text).trim().slice(0, 2500);
  return { notes, sources: all.slice(0, 6), links: keepRealLinks(claimed, all.map((x) => x.url), notes) };
}

/** Steps C+D in one call: judge the place for this project and, if it's a fit, plan how to approach it. */
export async function judge(key: string | KeyRing, p: Project, plan: Plan | null, ev: Evidence, locale: string): Promise<Judgement | Fail> {
  const lang = LANG[locale] ?? "English";
  const evidence = [
    `PLACE: ${ev.place.name} · ${ev.place.category ?? "?"} · ${ev.place.address ?? "address unknown"}`,
    `Website: ${ev.place.website ?? "none"} · Instagram: ${ev.place.instagram ?? "none"} · Phone: ${ev.place.phone ? "yes" : "none"} · Opening hours: ${ev.place.opening_hours ?? "unknown"}`,
    ...ev.pages.map((pg) => `--- ${pg.url}\n${pg.text.slice(0, 2500)}`),
    ev.webNotes ? `--- WEB SEARCH NOTES\n${ev.webNotes}` : "",
    ev.webSources.length ? `Sources: ${ev.webSources.map((s) => s.url).join(" ")}` : "",
  ].filter(Boolean).join("\n").slice(0, 6000);
  const r = await call(key, {
    reasoning_effort: "low", temperature: 0.2, response_format: { type: "json_object" },
    messages: [
      { role: "system", content: `You qualify sales leads for a student startup. Judge ONLY from the evidence given; if something is not in the evidence, say "unknown" and score it 3 (what we cannot show counts against the lead). Never invent facts, reviews or numbers. Be blunt: most places are NOT worth it. Every "source" must be one of the URLs in the evidence. Write all text in ${lang}; write "opener" in the local language of the business. Reply with JSON only.` },
      { role: "user", content: `${CONTEXT}

${project(p)}
Signs of need: ${plan?.signals.join("; ") || "(infer)"}
Deal-breakers: ${plan?.deal_breakers.join("; ") || p.deal_breakers.join("; ") || "(none)"}
Sales playbook: ${PLAYBOOKS[plan?.playbook ?? "b2b_service"]}

EVIDENCE
${evidence}

Return JSON:
{
  "criteria": [${CRITERIA.map((c) => `{"key":"${c.key}","score":0-10,"why":"one sentence citing evidence","source":"url or null"}`).join(", ")}],
  "deal_breaker": "the deal-breaker found, or null",
  "why": "2 sentences: the honest verdict for THIS project",
  "attack_with": "the smallest first offer that proves value to them (free sample, pilot, specific package) — concrete",
  "signals": [{"text":"evidence-based fact that matters","url":"source url or null"}],
  "approach": {"channel":"visit | phone | instagram_dm | contact_form | email","opener":"2-3 sentences, specific to them","best_time":"when to go/call, from opening hours","who_to_ask_for":"role","objections":[{"objection":"","answer":""},{"objection":"","answer":""}]}
}
Criteria: need = visibly has the problem we solve; fit = matches ideal client; ability_to_pay; reachability = we can reach a decision-maker; timing = a reason to act now; value_vs_effort = deal value vs effort for students; low_risk = 10 is safe (independent, open, friendly).
Spain rule: unsolicited commercial email is not allowed even to companies, so prefer visit/phone/Instagram DM/contact form.` },
    ],
  }, JUDGE_MODELS);
  if (!("ok" in r)) return r;
  const j = normalizeJudgement(json(r));
  return j ?? { error: "failed" };
}
