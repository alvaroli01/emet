/** The live "you got a task" pop-up (pure, tested): which notifications pop up, and how their due date reads. */
export const isTaskPopup = (n: { kind: string }) => n.kind === "assigned" || n.kind === "team_task";

export function dueLabel(due: string | undefined | null, locale: string): string | null {
  if (!due) return null;
  const timed = due.length > 10;
  const d = new Date(timed ? due : `${due}T12:00:00Z`);
  return d.toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Madrid",
    ...(timed ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const } : {}) });
}
