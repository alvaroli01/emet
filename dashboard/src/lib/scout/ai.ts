import "server-only";
import { call, CONTEXT, LANG, type Fail } from "@/lib/lab/ai";
import { CRITERIA, normalizeJudgement, type Judgement } from "./core";
import { PLAYBOOKS, PLAYBOOK_KEYS, type PlaybookKey } from "./playbooks";

/** Scout's AI steps, run with the member's own free Groq key (same helper and fallbacks as the Idea lab). */

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
export async function planProject(key: string, p: Project, country: string, locale: string): Promise<Plan | Fail> {
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
  });
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
export async function webFind(key: string, queries: string[], city: string, country: string): Promise<{ name: string; website: string | null; instagram: string | null; address: string | null }[] | Fail> {
  const r = await call(key, {
    reasoning_effort: "low", tools: [{ type: "browser_search" }],
    messages: [{ role: "user", content: `Search the web for local businesses in ${city} (${country}) using these searches: ${queries.map((q) => `"${q.replace("{city}", city)}"`).join(", ")}.
List up to 15 real, currently open businesses you actually found (no chains' head offices, no directories). Reply ONLY with JSON:
{"places":[{"name":"","website":"https://… or null","instagram":"https://instagram.com/… or null","address":"street, city or null"}]}` }],
  }, ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]);
  if (!("ok" in r)) return r;
  const text = String(r.message.content ?? "");
  const m = text.match(/\{[\s\S]*\}/);
  try {
    const j = JSON.parse(m?.[0] ?? "{}") as { places?: { name?: string; website?: string | null; instagram?: string | null; address?: string | null }[] };
    const ok = (u?: string | null) => (u && /^https?:\/\//.test(u) ? u.slice(0, 300) : null);
    return (j.places ?? []).filter((p) => p.name).slice(0, 15).map((p) => ({ name: String(p.name).slice(0, 160), website: ok(p.website), instagram: ok(p.instagram), address: p.address ? String(p.address).slice(0, 200) : null }));
  } catch { return []; }
}

export type Evidence = { place: { name: string; category: string | null; address: string | null; website: string | null; instagram: string | null; phone: string | null; opening_hours: string | null };
  pages: { url: string; text: string }[]; webNotes: string; webSources: { title: string; url: string }[] };

/** Short web check of one place (reviews, Instagram activity, news) — real search results only. */
export async function webCheck(key: string, name: string, city: string): Promise<{ notes: string; sources: { title: string; url: string }[] } | Fail> {
  const r = await call(key, {
    reasoning_effort: "low", tools: [{ type: "browser_search" }],
    messages: [{ role: "user", content: `Look up the business "${name}" in ${city}. In 5-8 short bullet points with facts only: what they sell, price level, reviews (rating, count, recurring complaints/praise), Instagram/online activity, size (staff, branches, chain or independent), anything new (opening, renovation, hiring). Say "unknown" when not found. No advice.` }],
  }, ["openai/gpt-oss-20b", "openai/gpt-oss-120b"]);
  if (!("ok" in r)) return r;
  const m = r.message as { content?: string; executed_tools?: { search_results?: { results?: { title?: string; url?: string }[] } }[] };
  const sources: { title: string; url: string }[] = [];
  for (const t of m.executed_tools ?? []) for (const s of t.search_results?.results ?? []) if (s.url && /^https?:\/\//.test(s.url) && sources.length < 6 && !sources.some((x) => x.url === s.url)) sources.push({ title: (s.title ?? s.url).slice(0, 120), url: s.url });
  return { notes: String(m.content ?? "").replace(/【[^】]*】/g, "").slice(0, 2500), sources };
}

/** Steps C+D in one call: judge the place for this project and, if it's a fit, plan how to approach it. */
export async function judge(key: string, p: Project, plan: Plan | null, ev: Evidence, locale: string): Promise<Judgement | Fail> {
  const lang = LANG[locale] ?? "English";
  const evidence = [
    `PLACE: ${ev.place.name} · ${ev.place.category ?? "?"} · ${ev.place.address ?? "address unknown"}`,
    `Website: ${ev.place.website ?? "none"} · Instagram: ${ev.place.instagram ?? "none"} · Phone: ${ev.place.phone ? "yes" : "none"} · Opening hours: ${ev.place.opening_hours ?? "unknown"}`,
    ...ev.pages.map((pg) => `--- ${pg.url}\n${pg.text.slice(0, 2500)}`),
    ev.webNotes ? `--- WEB SEARCH NOTES\n${ev.webNotes}` : "",
    ev.webSources.length ? `Sources: ${ev.webSources.map((s) => s.url).join(" ")}` : "",
  ].filter(Boolean).join("\n").slice(0, 9000);
  const r = await call(key, {
    reasoning_effort: "medium", temperature: 0.2, response_format: { type: "json_object" },
    messages: [
      { role: "system", content: `You qualify sales leads for a student startup. Judge ONLY from the evidence given; if something is not in the evidence, say "unknown" and score it 5. Never invent facts, reviews or numbers. Be blunt: most places are NOT worth it. Every "source" must be one of the URLs in the evidence. Write all text in ${lang}; write "opener" in the local language of the business. Reply with JSON only.` },
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
  });
  if (!("ok" in r)) return r;
  const j = normalizeJudgement(json(r));
  return j ?? { error: "failed" };
}
