// Signals and outreach rules for Scout (pure, tested), adapted for local businesses approached in person / by phone /
// Instagram from Harvey's sales playbooks (skills/signal_playbook.md, lead_qualification.md, objection_handling.md).
// Harvey — https://github.com/ethanplusai/harvey — MIT License, Copyright (c) 2026 Ethan Rogers.
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
// documentation files, to deal in the Software without restriction, subject to the above copyright notice and this
// permission notice being included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED
// "AS IS", WITHOUT WARRANTY OF ANY KIND.

/** A reason to contact a business TODAY, strongest (most recent, most actionable) first. */
export const SIGNAL_KINDS = [
  "hiring",          // a job post: they are growing and stretched right now
  "new_opening",     // just opened, or a new location
  "change",          // renovation, new owner, rebrand, new menu/service/product
  "unhappy_reviews", // reviews complaining about exactly what we solve
  "weak_online",     // no/outdated website, no booking, Instagram gone quiet
  "events",          // upcoming season, event or campaign they are preparing
  "none",            // nothing specific: fall back to an honest industry observation
] as const;
export type SignalKind = (typeof SIGNAL_KINDS)[number];
export type Hook = { kind: SignalKind; text: string; url?: string; date?: string };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Check the AI's chosen hook: a known kind, an http(s) source or none, a text that says something. */
export function normalizeHook(raw: unknown): Hook | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const text = str(r.text, 240);
  if (!text) return null;
  const kind = (SIGNAL_KINDS as readonly string[]).includes(String(r.kind)) ? (r.kind as SignalKind) : "none";
  const url = /^https?:\/\//.test(str(r.url, 500)) ? str(r.url, 500) : undefined;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(str(r.date, 10)) ? str(r.date, 10) : undefined;
  return { kind, text, ...(url ? { url } : {}), ...(date ? { date } : {}) };
}

/** Use ONE signal as the hook — stacking several reads like a dossier. */
export function strongestSignal<T extends { kind: string }>(signals: T[]): T | null {
  const rank = (k: string) => { const i = (SIGNAL_KINDS as readonly string[]).indexOf(k); return i < 0 ? SIGNAL_KINDS.length : i; };
  return [...signals].sort((a, b) => rank(a.kind) - rank(b.kind))[0] ?? null;
}

/** Older than ~60 days, a "new" thing may be filled or done: talk about it as background, not news. */
export function isStale(date: string | undefined, today: string, days = 60): boolean {
  return !!date && (Date.parse(`${today}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`)) / 864e5 > days;
}

const INFO = /about|nosotros|quienes|servic|carta|menu|precio|price|contact|tarifa|empresa/i;
const SIGNAL = /trabaja|empleo|careers|jobs|vacante|unete|únete|noticias|news|novedades|blog$|eventos|events/i;
/** Which same-site pages to read: up to 2 about/services/menu pages, plus 1 hiring/news page (where signals live). */
export function pickLinks(paths: string[]): string[] {
  const uniq = [...new Set(paths)].filter((p) => p !== "/" && p !== "");
  const info = uniq.filter((p) => INFO.test(p) && !SIGNAL.test(p)).slice(0, 2);
  const signal = uniq.find((p) => SIGNAL.test(p));
  return [...info, ...(signal ? [signal] : [])];
}

/** The outreach rules the judge follows when it writes the opener (Harvey's playbook, for local businesses). */
export const OUTREACH_RULES = `Outreach rules (from a proven sales playbook):
- Pick the ONE strongest reason to contact them today ("hook"), in this order: hiring > new_opening > change > unhappy_reviews > weak_online > events > none. Never stack two.
- The opener says the hook plainly in its first sentence, as an observation ("Vi que buscáis camarero…"), then the angle: the pressure behind it, not flattery. Never "I love what you do".
- Never claim more than the evidence proves: no invented numbers, staff counts, revenue, reasons or "I heard". A wrong specific is worse than an honest generic.
- A job post or "new" thing older than ~60 days is background, not news. No date = don't say "just".
- No real signal (kind "none"): say an honest problem businesses like theirs have right now, as an observation.
- Objections: Listen, acknowledge, ask one question to find the real reason (budget / not the right person / no need / bad timing), answer that reason only, confirm. Offer the smallest next step (free sample, 15-minute visit, trial), never pressure. If they say no, accept it.`;
