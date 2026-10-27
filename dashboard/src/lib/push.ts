/** Phone notifications (pure, tested): the alert a notification row becomes. */
export type PushNote = { id: string; kind: string; data: Record<string, unknown>; link: string | null };
export type PushPayload = { title: string; body: string; url: string; tag: string };

/** The values every notification text may use, so a missing one shows as empty instead of breaking the message. */
const FIELDS = ["title", "project", "name", "names", "excerpt", "type", "week", "due", "reason", "weight", "total"];

/** Every value a notification text may need, as strings (missing ones empty) — shared by the bell and phone alerts. */
export function noteValues(data: Record<string, unknown>): Record<string, string> {
  return { ...Object.fromEntries(FIELDS.map((f) => [f, ""])), ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v == null ? "" : String(v)])) };
}

export function pushPayload(n: PushNote, t: (key: string, values?: Record<string, unknown>) => string): PushPayload {
  const values = noteValues(n.data);
  return {
    title: t(`push.titles.${n.kind}`),
    body: t(`notifications.kinds.${n.kind}`, values),
    url: n.link && n.link.startsWith("/") && !n.link.startsWith("//") ? n.link : "/",
    tag: n.id,
  };
}
