import { writeNotes, type NotesReply } from "./notes-steps";

/** Browser side: writes notes for a transcript through /api/notes, step by step. onWait(ms) fires when a free-tier
 *  limit makes it pause (so the screen can show a countdown). Returns null if notes couldn't be written. */
export function writeNotesNow(transcript: string, onWait?: (ms: number) => void): Promise<string | null> {
  return writeNotes(
    transcript,
    async (step) => {
      const res = await fetch("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(step) }).catch(() => null);
      if (!res) return { error: "network" };
      return ((await res.json().catch(() => ({ error: `http-${res.status}` }))) as NotesReply);
    },
    (ms) => { onWait?.(ms); return new Promise((r) => setTimeout(r, ms)); },
  );
}
