/** Recordings saved as Base camp docs look like: "_<no notes line>_", "## <Transcript>", the transcript, "_<meta>_".
 *  These helpers find such a doc's transcript so its notes can be written again (pure, tested). */

const italic = (line: string) => /^_.+_$/.test(line.trim());

/** The transcript of a recording whose notes couldn't be written; null for any other doc. */
export function missingNotes(body: string): string | null {
  const lines = body.split("\n");
  const first = lines.findIndex((l) => l.trim());
  const heading = lines.findIndex((l) => l.startsWith("## "));
  if (first < 0 || heading < 0 || !italic(lines[first]) || heading < first) return null;
  const rest = lines.slice(heading + 1);
  while (rest.length && (!rest.at(-1)!.trim() || italic(rest.at(-1)!))) rest.pop();
  const transcript = rest.join("\n").trim();
  return transcript || null;
}

/** The doc with its "couldn't be written" line replaced by the notes (transcript and details kept). */
export function withNotes(body: string, notes: string): string {
  const lines = body.split("\n");
  const heading = lines.findIndex((l) => l.startsWith("## "));
  return `${notes.trim()}\n\n${lines.slice(heading).join("\n")}`;
}
