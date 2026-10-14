import { CRITERIA, normalize, type Analysis } from "./score";

/**
 * Idea lab AI, run with the member's own free Groq key. Two short calls (each fits Vercel's time limit):
 *  1. research — gpt-oss with Groq's built-in web search, returns notes + the real source links;
 *  2. analysis — a strict JSON verdict against emet's goal, scored by the app (score.ts).
 */
const API = "https://api.groq.com/openai/v1/chat/completions";
const MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];
export type Source = { title: string; url: string };
export type Research = { notes: string; sources: Source[] };
type Fail = { error: "limit" | "bad-key" | "failed"; retryAfter?: number };

const LANG: Record<string, string> = { en: "English", es: "Spanish", de: "German", fr: "French", fi: "Finnish", "pt-BR": "Brazilian Portuguese", ru: "Russian" };

const CONTEXT = `Team: emet, 15 university students (LEINN Internacional, Mondragon University, Spain), 5 groups (leaders, finance, customer, marketing, communications).
Goal: €30,000 revenue and €15,000 profit by 30 June 2027 (about 8 months from October 2026), minimum 50% margin.
Budget to start: €0 (they can reinvest profits). They can sell on campus, at events, online and via Instagram/TikTok. Nothing is decided yet.`;

async function call(key: string, body: Record<string, unknown>, models = MODELS): Promise<{ ok: true; message: Record<string, unknown> } | Fail> {
  let limited: Fail | null = null;
  for (const model of models) {
    const res = await fetch(API, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, ...body }) });
    if (res.ok) {
      const data = (await res.json()) as { choices?: { message?: Record<string, unknown> }[] };
      return { ok: true, message: data.choices?.[0]?.message ?? {} };
    }
    if (res.status === 401 || res.status === 403) return { error: "bad-key" };
    // Each model has its own free per-minute allowance: if one is busy, try the next before waiting
    if (res.status === 429 || res.status === 413) { limited = { error: "limit", retryAfter: Math.ceil(Number(res.headers.get("retry-after")) || 60) }; continue; }
    if (res.status !== 404 && res.status !== 400) return { error: "failed" };
  }
  return limited ?? { error: "failed" };
}

export async function research(key: string, idea: { title: string; pitch: string; kind: string }, locale: string): Promise<Research | Fail> {
  const r = await call(key, {
    reasoning_effort: "low",
    tools: [{ type: "browser_search" }],
    messages: [{ role: "user", content: `${CONTEXT}

Research this business idea on the web, focused on Spain (and the team's campus where relevant):
"${idea.title}" (${idea.kind}). ${idea.pitch}

Find facts that decide if it can work for them: real demand and who buys, typical prices and costs in Spain, competitors and
what they charge, legal/permit requirements, seasonality, and examples of similar student or small ventures.
Write compact research notes (bullet points with numbers) in ${LANG[locale] ?? "English"}. Do not give a verdict.` }],
  });
  if (!("ok" in r)) return r;
  const m = r.message as { content?: string; executed_tools?: { search_results?: { results?: { title?: string; url?: string }[] } }[] };
  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const t of m.executed_tools ?? []) for (const s of t.search_results?.results ?? []) {
    if (s.url && /^https?:\/\//.test(s.url) && !seen.has(s.url) && sources.length < 12) { seen.add(s.url); sources.push({ title: (s.title ?? s.url).slice(0, 140), url: s.url }); }
  }
  // Groq marks citations like 【3†L45-L48】; they don't map to our list, so remove them from the text
  const notes = String(m.content ?? "").replace(/【[^】]*】/g, "").trim();
  return { notes, sources };
}

export async function analyze(key: string, idea: { title: string; pitch: string; kind: string }, research: Research | null, locale: string): Promise<Analysis | Fail> {
  const r = await call(key, {
    reasoning_effort: "medium",
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: `You are a sharp, honest startup advisor for a student team. Judge ideas against the team's real situation, using the research notes as evidence. Be specific and blunt: say clearly if an idea is weak and why. Never invent statistics; when you estimate, say it is an estimate. Write every text field in ${LANG[locale] ?? "English"}. Reply with JSON only.` },
      { role: "user", content: `${CONTEXT}

IDEA: "${idea.title}" (type: ${idea.kind})
${idea.pitch || "(no extra description)"}

RESEARCH NOTES:
${research?.notes?.slice(0, 9000) || "(no web research available — rely on general knowledge and say so)"}

Return JSON with exactly these keys:
{
  "summary": "2-3 sentences: what this really is and the honest bottom line",
  "criteria": [${CRITERIA.map((c) => `{"key":"${c.key}","score":1-10,"why":"one concrete sentence"}`).join(", ")}],
  "strengths": ["3-5 items"],
  "weaknesses": ["3-5 items"],
  "risks": ["2-4 items incl. legal/permits if relevant"],
  "numbers": {"price":"SHORT value only, e.g. €2.30 or €25/ticket","unit_cost":"SHORT value only, e.g. €0.65","margin":"SHORT, e.g. 65%","units_for_goal":"how many sales/tickets/clients to reach €30,000 revenue, with the arithmetic","assumptions":"what these numbers assume and how they were estimated"},
  "test_in_7_days": ["3-6 cheap concrete steps to validate it within a week with €0"],
  "variations": [{"title":"short name","pitch":"1-2 sentences","why_better":"what it fixes"} ... 3 items that make the idea stronger],
  "questions": ["2-4 questions the team must answer before committing"]
}
Criteria meaning: demand = enough paying customers near them now; margin = can keep ≥50%; startup_cost = can start with ~€0 (10 = free to start);
time_to_cash = first sales within weeks (10 = this month); scale_to_goal = can realistically reach €30K by June 2027; team_fit = 15 students can run it beside classes; low_risk = 10 means very safe.` },
    ],
  });
  if (!("ok" in r)) return r;
  try {
    const parsed = normalize(JSON.parse(String((r.message as { content?: string }).content ?? "{}")));
    return parsed ?? { error: "failed" };
  } catch {
    return { error: "failed" };
  }
}
