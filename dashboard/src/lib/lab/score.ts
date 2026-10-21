/**
 * Idea lab scoring. The AI rates 7 criteria from 1–10 with reasons; the app — not the AI — turns them into one
 * score out of 100 and a verdict, so every idea is judged by the same weights and ideas can be compared fairly.
 * Weights reflect emet's situation: €30K revenue / €15K profit by June 2027, ≥50% margin, €0 to start, 15 students.
 */
export const CRITERIA = [
  { key: "demand", weight: 20 },        // do enough people want it, near us, now?
  { key: "margin", weight: 20 },        // can it keep ≥50% margin?
  { key: "startup_cost", weight: 15 },  // can it start with ~€0?
  { key: "time_to_cash", weight: 15 },  // first sale within weeks, not months?
  { key: "scale_to_goal", weight: 15 }, // can it realistically reach €30K by June 2027?
  { key: "team_fit", weight: 10 },      // can 15 students run it next to classes?
  { key: "low_risk", weight: 5 },       // legal, reputational, operational risk (10 = very safe)
] as const;
export type CriterionKey = (typeof CRITERIA)[number]["key"];
export type Verdict = "strong" | "promising" | "weak" | "not_recommended";

export type Analysis = {
  summary: string;
  criteria: { key: CriterionKey; score: number; why: string }[];
  strengths: string[];
  weaknesses: string[];
  risks: string[];
  numbers: { price: string; unit_cost: string; margin: string; units_for_goal: string; assumptions: string };
  test_in_7_days: string[];
  variations: { title: string; pitch: string; why_better: string }[];
  questions: string[];
  verdict: Verdict;
  score: number;
  /** The idea exactly as written: who pays, what, why — judged literally, never swapped for a better idea */
  as_written?: { customer: string; offer: string; why_they_buy: string; makes_sense: boolean; problem: string };
};

/** A fatal flaw can't be averaged away: no customers, no margin or no way to €30K caps the idea at "not recommended". */
export const FATAL: CriterionKey[] = ["demand", "margin", "scale_to_goal"];
export const FATAL_CAP = 44;

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const strs = (v: unknown, max = 8) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()).slice(0, max) : []);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function scoreOf(criteria: { key: string; score: number }[]): number {
  let total = 0, weights = 0;
  for (const c of CRITERIA) {
    const found = criteria.find((x) => x.key === c.key);
    if (!found) continue;
    total += clamp(found.score, 1, 10) * c.weight;
    weights += c.weight;
  }
  const score = weights ? Math.round((total / weights) * 10) : 0;
  const fatal = criteria.some((c) => FATAL.includes(c.key as CriterionKey) && c.score <= 3);
  return fatal ? Math.min(score, FATAL_CAP) : score;
}

const RANK: Verdict[] = ["not_recommended", "weak", "promising", "strong"];
/** The council's chairman can only make the verdict harsher: drop → not recommended, test → at most promising. */
export function finalVerdict(v: Verdict, chairman: "go" | "test" | "drop" | null | undefined): Verdict {
  const cap: Verdict = chairman === "drop" ? "not_recommended" : chairman === "test" ? "promising" : "strong";
  return RANK[Math.min(RANK.indexOf(v), RANK.indexOf(cap))];
}

export function verdictOf(score: number): Verdict {
  return score >= 75 ? "strong" : score >= 60 ? "promising" : score >= 45 ? "weak" : "not_recommended";
}

/** Turns whatever the model returned into a clean, complete Analysis (missing parts become empty, never crash the UI). */
export function normalize(raw: unknown): Analysis | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const criteria = (Array.isArray(r.criteria) ? r.criteria : [])
    .map((c) => c as Record<string, unknown>)
    .filter((c) => CRITERIA.some((k) => k.key === c.key) && Number.isFinite(Number(c.score)))
    .map((c) => ({ key: c.key as CriterionKey, score: clamp(Math.round(Number(c.score)), 1, 10), why: str(c.why) }));
  if (criteria.length < 5) return null; // not a usable verdict
  const n = (r.numbers ?? {}) as Record<string, unknown>;
  const w = (r.idea_as_written ?? null) as Record<string, unknown> | null;
  const as_written = w ? { customer: str(w.customer), offer: str(w.offer), why_they_buy: str(w.why_they_buy), makes_sense: w.makes_sense !== false, problem: str(w.problem) } : undefined;
  const score = as_written && !as_written.makes_sense ? Math.min(scoreOf(criteria), FATAL_CAP) : scoreOf(criteria);
  return {
    summary: str(r.summary),
    criteria: CRITERIA.map((k) => criteria.find((c) => c.key === k.key)).filter(Boolean) as Analysis["criteria"],
    strengths: strs(r.strengths), weaknesses: strs(r.weaknesses), risks: strs(r.risks),
    numbers: { price: str(n.price), unit_cost: str(n.unit_cost), margin: str(n.margin), units_for_goal: str(n.units_for_goal), assumptions: str(n.assumptions) },
    test_in_7_days: strs(r.test_in_7_days, 7),
    variations: (Array.isArray(r.variations) ? r.variations : []).slice(0, 4).map((v) => v as Record<string, unknown>)
      .map((v) => ({ title: str(v.title), pitch: str(v.pitch), why_better: str(v.why_better) })).filter((v) => v.title),
    questions: strs(r.questions, 6),
    score,
    verdict: verdictOf(score),
    ...(as_written ? { as_written } : {}),
  };
}
