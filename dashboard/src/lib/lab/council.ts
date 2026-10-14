import "server-only";
import { call, CONTEXT, LANG, type Fail, type Research } from "./ai";
import type { Analysis } from "./score";

/**
 * The LLM Council (method from Alvaro's "llm-council" skill, after Karpathy): five advisors judge the idea independently
 * from different angles, then review each other anonymously, then a chairman writes the verdict.
 * Free-tier friendly: advisors on the small model, one call for all reviews, the chairman on the big one.
 * The app's score stays the official number; the council is a second opinion shown next to it.
 */

export const ADVISORS = [
  { key: "contrarian", lens: "The Contrarian: hunt for the fatal flaw. Assume it fails and explain the most likely reason. Attack the weakest assumption." },
  { key: "first_principles", lens: "The First-Principles Thinker: ignore how others do it. Rebuild the problem from basics: who exactly pays, why, and what is the simplest thing that delivers it?" },
  { key: "expansionist", lens: "The Expansionist: look for the upside others miss: bigger markets, adjacent products, ways this could beat €30K, partnerships and leverage." },
  { key: "outsider", lens: "The Outsider: you know nothing about this industry. React like a normal customer would: is it clear, would you pay, what confuses or worries you?" },
  { key: "executor", lens: "The Executor: only care about doing it. What would the team do on Monday morning, in what order, with which people, and what will break first?" },
] as const;
export type AdvisorKey = (typeof ADVISORS)[number]["key"];
export type AdvisorTake = { key: AdvisorKey; headline: string; analysis: string; recommendation: "go" | "test" | "drop" };
export type Reviews = { strongest: string; weakest: string; missed: string; notes: { letter: string; comment: string }[] };
export type Chairman = { verdict: "go" | "test" | "drop"; summary: string; agree: string[]; clash: string[]; blind_spots: string[]; first_step: string };

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
${a ? `\nFIRST ANALYSIS: ${a.summary}\nNumbers: price ${a.numbers.price || "?"}, unit cost ${a.numbers.unit_cost || "?"}, margin ${a.numbers.margin || "?"}. To reach €30K: ${a.numbers.units_for_goal || "?"}` : ""}`;
}

export async function advisor(key: string, idea: Idea, i: number, locale: string): Promise<AdvisorTake | Fail> {
  const a = ADVISORS[i];
  const r = await call(key, {
    reasoning_effort: "low", temperature: 0.6, response_format: { type: "json_object" },
    messages: [
      { role: "system", content: `You are one advisor on a council judging a business idea. ${a.lens} Stay in your lens; be concrete and blunt; don't hedge. Never invent statistics. Write in ${LANG[locale] ?? "English"}. Reply with JSON only.` },
      { role: "user", content: `${brief(idea)}\n\nReturn JSON: {"headline":"your view in one sentence","analysis":"120-220 words from your lens","recommendation":"go | test | drop"}` },
    ],
  }, ["openai/gpt-oss-20b", "openai/gpt-oss-120b"]);
  if (!("ok" in r)) return r;
  const j = json(r.message);
  if (!j || !s(j.analysis)) return { error: "failed" };
  return { key: a.key, headline: s(j.headline, 240), analysis: s(j.analysis, 2000), recommendation: rec(j.recommendation) };
}

/** Anonymous peer review: advisors' answers are shuffled behind letters A–E so no lens gets favoured by name. */
export async function review(key: string, idea: Idea, takes: AdvisorTake[], order: number[], locale: string): Promise<Reviews | Fail> {
  const letters = "ABCDE";
  const block = order.map((idx, n) => `RESPONSE ${letters[n]}:\n${takes[idx].headline}\n${takes[idx].analysis}`).join("\n\n");
  const r = await call(key, {
    reasoning_effort: "low", temperature: 0.3, response_format: { type: "json_object" },
    messages: [
      { role: "system", content: `You review anonymous advice on a business idea. Judge the reasoning, not the style. Write in ${LANG[locale] ?? "English"}. Reply with JSON only.` },
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

export async function chairman(key: string, idea: Idea, takes: AdvisorTake[], reviews: Reviews | null, locale: string): Promise<Chairman | Fail> {
  const r = await call(key, {
    reasoning_effort: "medium", temperature: 0.3, response_format: { type: "json_object" },
    messages: [
      { role: "system", content: `You chair a council of five advisors for a student startup. Synthesize honestly: where they agree, where they clash and who is right, what everyone missed, and the single next action. Write in ${LANG[locale] ?? "English"}. Reply with JSON only.` },
      { role: "user", content: `${brief(idea)}

ADVISORS:
${takes.map((t) => `${t.key} (${t.recommendation}): ${t.headline}\n${t.analysis}`).join("\n\n")}

PEER REVIEW: strongest = ${reviews?.strongest || "?"}, weakest = ${reviews?.weakest || "?"}. Missed by all: ${reviews?.missed || "?"}

Return JSON: {"verdict":"go | test | drop","summary":"3-4 sentences","agree":["2-4 points"],"clash":["1-3 points: the disagreement and who is right"],"blind_spots":["1-3"],"first_step":"the one thing to do this week, concrete"}` },
    ],
  });
  if (!("ok" in r)) return r;
  const j = json(r.message);
  if (!j || !s(j.summary)) return { error: "failed" };
  return { verdict: rec(j.verdict), summary: s(j.summary, 1200), agree: list(j.agree), clash: list(j.clash, 3), blind_spots: list(j.blind_spots, 3), first_step: s(j.first_step, 400) };
}
