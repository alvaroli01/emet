import "server-only";
import type { KeyRing } from "@/lib/ai/pool";
import { call, CONTEXT, LANG, type Fail, type Research } from "./ai";
import type { Analysis } from "./score";

/**
 * The LLM Council (method from Alvaro's "llm-council" skill, after Karpathy): five advisors judge the idea independently
 * from different angles, then review each other anonymously, then a chairman writes the verdict.
 * Free-tier friendly: advisors on the small model, one call for all reviews, the chairman on the big one.
 * The app's score stays the official number; the council is a second opinion shown next to it.
 */

export const ADVISORS = [
  { key: "contrarian", lens: "The Contrarian: assume the idea has a fatal flaw and hunt for it. Ask the questions the team is avoiding. Not a pessimist — the friend who saves them from a bad deal." },
  { key: "first_principles", lens: "The First-Principles Thinker: ignore the surface question and ask what they are actually trying to solve. Strip the assumptions and rebuild from the ground up: who exactly pays, and why? You may say they are asking the wrong question." },
  { key: "expansionist", lens: "The Expansionist: hunt for the upside everyone else misses. What could be bigger? What adjacent opportunity is hiding? Ignore risk entirely." },
  { key: "outsider", lens: "The Outsider: you have zero context about the team or the field. React only to what is on the page, like a normal customer or investor would. Catch the curse of knowledge: what is obvious to them but confusing or unconvincing to everyone else?" },
  { key: "executor", lens: "The Executor: only care whether this can be done and the fastest path. 'OK, but what do you do Monday morning?' Call out an idea with no clear first step or no one who would pay." },
] as const;
export type AdvisorKey = (typeof ADVISORS)[number]["key"];
export type AdvisorTake = { key: AdvisorKey; headline: string; analysis: string; recommendation: "go" | "test" | "drop" };
export type Reviews = { strongest: string; weakest: string; missed: string; notes: { letter: string; comment: string }[] };
export type Chairman = { verdict: "go" | "test" | "drop"; summary: string; agree: string[]; clash: string[]; blind_spots: string[]; recommendation?: string; first_step: string };

type Idea = { title: string; pitch: string; kind: string; research: Research | null; analysis: Analysis | null };
const json = (m: Record<string, unknown>) => { try { return JSON.parse(String(m.content ?? "{}")); } catch { return null; } };
const s = (v: unknown, n = 1200) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const list = (v: unknown, n = 5) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").map((x: string) => x.trim().slice(0, 300)).filter(Boolean).slice(0, n) : []);
const rec = (v: unknown): "go" | "test" | "drop" => (v === "go" || v === "drop" ? v : "test");

function brief(idea: Idea) {
  const a = idea.analysis;
  return `${CONTEXT}

IDEA: "${idea.title}" (${idea.kind})
${idea.pitch || "(no description)"}

RESEARCH NOTES (from the web):
${idea.research?.notes?.slice(0, 4500) || "(none)"}
${a?.as_written ? `\nTHE IDEA AS WRITTEN: customer = ${a.as_written.customer || "?"}; offer = ${a.as_written.offer || "?"}; why they'd buy = ${a.as_written.why_they_buy || "?"}${a.as_written.makes_sense ? "" : ` — DOES NOT MAKE SENSE AS WRITTEN: ${a.as_written.problem}`}` : ""}
${a ? `Numbers estimated: price ${a.numbers.price || "?"}, unit cost ${a.numbers.unit_cost || "?"}, margin ${a.numbers.margin || "?"}. To reach €30K: ${a.numbers.units_for_goal || "?"}` : ""}

RULE FOR EVERYONE: judge the idea exactly as written — same customer, same product. Do not quietly swap it for a better idea; if you see a better version, name it as a pivot.`;
}

export async function advisor(key: string | KeyRing, idea: Idea, i: number, locale: string): Promise<AdvisorTake | Fail> {
  const a = ADVISORS[i];
  const r = await call(key, {
    reasoning_effort: "low", temperature: 0.6, response_format: { type: "json_object" },
    messages: [
      { role: "system", content: `You are one advisor on an LLM Council judging a business idea. You cannot see the other advisors. ${a.lens} Lean fully into your angle: no hedging, no balance. Be concrete and blunt. Never invent statistics. Write in ${LANG[locale] ?? "English"}. Reply with JSON only.` },
      { role: "user", content: `${brief(idea)}\n\nReturn JSON: {"headline":"your view in one sentence","analysis":"150-300 words from your lens","recommendation":"go | test | drop"}` },
    ],
  }, ["openai/gpt-oss-20b", "openai/gpt-oss-120b"]);
  if (!("ok" in r)) return r;
  const j = json(r.message);
  if (!j || !s(j.analysis)) return { error: "failed" };
  return { key: a.key, headline: s(j.headline, 240), analysis: s(j.analysis, 2000), recommendation: rec(j.recommendation) };
}

/** Anonymous peer review: advisors' answers are shuffled behind letters A–E so no lens gets favoured by name. */
export async function review(key: string | KeyRing, idea: Idea, takes: AdvisorTake[], order: number[], locale: string): Promise<Reviews | Fail> {
  const letters = "ABCDE";
  const block = order.map((idx, n) => `RESPONSE ${letters[n]}:\n${takes[idx].headline}\n${takes[idx].analysis}`).join("\n\n");
  const r = await call(key, {
    reasoning_effort: "low", temperature: 0.3, response_format: { type: "json_object" },
    messages: [
      { role: "system", content: `You run the anonymous peer review of an LLM Council. Judge each response on merit alone — reasoning and evidence, not style or confidence, and don't defer to any thinking style. Answer: which response is strongest and why, which has the biggest blind spot and what it is, and what ALL responses missed. Write in ${LANG[locale] ?? "English"}. Reply with JSON only.` },
      { role: "user", content: `${brief(idea)}\n\n${block}\n\nReturn JSON: {"strongest":"letter","weakest":"letter","missed":"what ALL responses missed (2-3 sentences)","notes":[{"letter":"A","comment":"one sentence"}, … for each letter]}` },
    ],
  }, ["openai/gpt-oss-20b", "openai/gpt-oss-120b"]);
  if (!("ok" in r)) return r;
  const j = json(r.message);
  if (!j) return { error: "failed" };
  // Map letters back to advisor keys so the page can show who said what
  const toKey = (l: unknown) => { const n = letters.indexOf(String(l ?? "").trim().toUpperCase()[0] ?? ""); return n >= 0 && n < order.length ? takes[order[n]].key : ""; };
  return {
    strongest: toKey(j.strongest), weakest: toKey(j.weakest), missed: s(j.missed, 800),
    notes: (Array.isArray(j.notes) ? j.notes : []).map((x: { letter?: string; comment?: string }) => ({ letter: toKey(x?.letter), comment: s(x?.comment, 300) })).filter((x: { letter: string }) => x.letter),
  };
}

export async function chairman(key: string | KeyRing, idea: Idea, takes: AdvisorTake[], reviews: Reviews | null, locale: string): Promise<Chairman | Fail> {
  const r = await call(key, {
    reasoning_effort: "medium", temperature: 0.3, response_format: { type: "json_object" },
    messages: [
      { role: "system", content: `You are the Chairman of an LLM Council for a student startup. Synthesize everything. You may side with a lone dissenter if their reasoning is strongest. Be direct — never "it depends". If the idea as written has no real customer, no margin or no way to the goal, the verdict is "drop", however cheap or easy it is. Write in ${LANG[locale] ?? "English"}. Reply with JSON only.` },
      { role: "user", content: `${brief(idea)}

ADVISORS:
${takes.map((t) => `${t.key} (${t.recommendation}): ${t.headline}\n${t.analysis}`).join("\n\n")}

PEER REVIEW: strongest = ${reviews?.strongest || "?"}, weakest = ${reviews?.weakest || "?"}. Missed by all: ${reviews?.missed || "?"}

Return JSON: {"verdict":"go | test | drop","summary":"3-4 sentences","agree":["2-4 points multiple advisors reached independently"],"clash":["1-3 real disagreements: both sides and who is right"],"blind_spots":["1-3 insights that only surfaced in peer review"],"recommendation":"a clear, actionable answer with reasoning (2-4 sentences)","first_step":"the ONE concrete thing to do first — not a list"}` },
    ],
  });
  if (!("ok" in r)) return r;
  const j = json(r.message);
  if (!j || !s(j.summary)) return { error: "failed" };
  return { verdict: rec(j.verdict), summary: s(j.summary, 1200), agree: list(j.agree), clash: list(j.clash, 3), blind_spots: list(j.blind_spots, 3), recommendation: s(j.recommendation, 1200), first_step: s(j.first_step, 400) };
}
