import { CRITERIA, normalize, type Analysis } from "./score";
import type { KeyRing } from "@/lib/ai/pool";
import { call, type Fail } from "@/lib/ai/call";
export { call, type Fail };

/**
 * Idea lab AI, run with the member's own free Groq key. Two short calls (each fits Vercel's time limit):
 *  1. research — gpt-oss with Groq's built-in web search, returns notes + the real source links;
 *  2. analysis — a strict JSON verdict against emet's goal, scored by the app (score.ts).
 */
export type Source = { title: string; url: string };
export type Research = { notes: string; sources: Source[] };

export const LANG: Record<string, string> = { en: "English", es: "Spanish", de: "German", fr: "French", fi: "Finnish", "pt-BR": "Brazilian Portuguese", ru: "Russian" };

export const CONTEXT = `Team: emet, 15 university students (LEINN Internacional, Mondragon University, Spain), 5 groups (leaders, finance, customer, marketing, communications).
Goal: €30,000 revenue and €15,000 profit by 30 June 2027 (about 8 months from October 2026), minimum 50% margin.
Budget to start: €0 (they can reinvest profits). They can sell on campus, at events, online and via Instagram/TikTok. Nothing is decided yet.`;


export async function research(key: string | KeyRing, idea: { title: string; pitch: string; kind: string }, locale: string): Promise<Research | Fail> {
  const r = await call(key, {
    reasoning_effort: "low",
    tools: [{ type: "browser_search" }],
    messages: [{ role: "user", content: `${CONTEXT}

Research this business idea on the web, focused on Spain (and the team's campus where relevant):
"${idea.title}" (${idea.kind}). ${idea.pitch}

Find facts that decide if it can work for them: real demand and who buys, typical prices and costs in Spain, competitors and
what they charge, legal/permit requirements, seasonality, and examples of similar student or small ventures.
Also look for PROOF THAT IT ALREADY SELLS somewhere (any country): live ads or shops selling the same thing, review counts, sold-out
products, and how long competitors have been running it. List that proof with links; say clearly if you found none.
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

export async function analyze(key: string | KeyRing, idea: { title: string; pitch: string; kind: string }, research: Research | null, locale: string): Promise<Analysis | Fail> {
  const r = await call(key, {
    reasoning_effort: "medium",
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: `You are a sharp, honest startup advisor for a student team, and your job is to protect them from bad ideas.
JUDGE THE IDEA EXACTLY AS WRITTEN. Never quietly replace it with a more sensible idea: if it says "sell lemons to investors", the customer is investors and the product is lemons — judge that. Better versions go ONLY in "variations".
First work out literally who pays, what they get, and why that customer would want it. If the stated customer has no real reason to buy it, the idea does not make sense as written: set makes_sense=false and demand to 1-2.
Be skeptical by default: most student business ideas fail. A score of 7+ needs evidence (research notes or a clear, known market), not optimism. Calibration: 1-3 = fatal problem, 4-5 = serious doubt, 6-7 = plausible with evidence, 8-10 = proven and strong.
Cheap, easy or quick to start never makes up for no customers, no margin or no way to reach the goal.
Never invent statistics; when you estimate, say it is an estimate. Write every text field in ${LANG[locale] ?? "English"}. Reply with JSON only.` },
      { role: "user", content: `${CONTEXT}

IDEA: "${idea.title}" (type: ${idea.kind})
${idea.pitch || "(no extra description)"}

RESEARCH NOTES:
${research?.notes?.slice(0, 9000) || "(no web research available — rely on general knowledge and say so)"}

Return JSON with exactly these keys:
{
  "idea_as_written": {"customer":"exactly who the idea says pays","offer":"exactly what they get","why_they_buy":"the real reason this customer would pay — or 'none'","makes_sense":true or false,"problem":"if it doesn't make sense as written, why; else empty"},
  "summary": "2-3 sentences: the idea as written and the honest bottom line (do not describe a different idea)",
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
