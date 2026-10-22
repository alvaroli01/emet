/** "Save to Notion": each kind of emet content as a title + Markdown body (pure, tested). Markdown → blocks is blocks.ts. */
export type ExportKind = "meeting" | "doc" | "idea" | "project_update";
type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const TRANSCRIPT_MAX = 40_000; // keeps a page readable and within a few hundred blocks
const dated = (title: string, day?: string | null) => (day ? `${title} — ${day.slice(0, 10)}` : title);
const bullets = (xs: unknown) => (Array.isArray(xs) ? xs.filter((x) => typeof x === "string" && x.trim()).map((x) => `- ${x}`).join("\n") : "");

export function exportMarkdown(kind: ExportKind, x: Any): { title: string; body: string } {
  switch (kind) {
    case "meeting": {
      const transcript = String(x.transcript ?? "").slice(0, TRANSCRIPT_MAX);
      return { title: dated(x.title || "Meeting", x.meeting_date), body: [String(x.notes ?? "").trim(), transcript ? `## Transcript\n\n${transcript}` : ""].filter(Boolean).join("\n\n") };
    }
    case "doc":
      return { title: dated(x.title || "Doc", x.doc_date), body: String(x.body ?? "") };
    case "project_update":
      return { title: dated(`${x.project ?? "Project"} update`, x.created_at), body: String(x.body ?? "") };
    case "idea": {
      const a = (x.analysis ?? {}) as Any, c = x.chairman as Any | null;
      const parts = [
        x.pitch ? `> ${x.pitch}` : "",
        a.verdict ? `**Verdict:** ${a.verdict}${x.score !== null && x.score !== undefined ? ` · **Score:** ${x.score}/100` : ""}` : "",
        a.summary ? `## Summary\n\n${a.summary}` : "",
        Array.isArray(a.criteria) && a.criteria.length ? `## Criteria\n\n${a.criteria.map((k: Any) => `- **${k.key}** ${k.score}/10 — ${k.why}`).join("\n")}` : "",
        bullets(a.strengths) && `## Strengths\n\n${bullets(a.strengths)}`,
        bullets(a.weaknesses) && `## Weaknesses\n\n${bullets(a.weaknesses)}`,
        bullets(a.risks) && `## Risks\n\n${bullets(a.risks)}`,
        bullets(a.test_in_7_days) && `## Test in 7 days\n\n${bullets(a.test_in_7_days)}`,
        c ? `## Council\n\n**${String(c.verdict ?? "").toUpperCase()}** — ${c.summary ?? ""}${c.first_step ? `\n\n**First step:** ${c.first_step}` : ""}` : "",
      ];
      return { title: `${x.title || "Idea"}${x.score !== null && x.score !== undefined ? ` — ${x.score}/100` : ""}`, body: parts.filter(Boolean).join("\n\n") };
    }
  }
}
