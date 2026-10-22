/** Notion database columns (page properties) → plain values the dashboard shows (pure, tested). */
export type PropValue = { type: string; text: string; date?: { start: string; end: string | null }; checked?: boolean; url?: string };

type Rich = { plain_text?: string };
const plain = (r: unknown) => (Array.isArray(r) ? (r as Rich[]).map((x) => x.plain_text ?? "").join("") : "");
const names = (xs: unknown) => (Array.isArray(xs) ? (xs as { name?: string }[]).map((x) => x.name ?? "").filter(Boolean).join(", ") : "");
const safeUrl = (u: unknown) => (typeof u === "string" && /^(https?:\/\/|mailto:)/i.test(u) ? u : undefined);

export function readProp(p: unknown): PropValue {
  const v = (p ?? {}) as Record<string, unknown> & { type?: string };
  const type = v.type ?? "unknown", d = v[type];
  switch (type) {
    case "title": case "rich_text": return { type, text: plain(d) };
    case "number": return { type, text: d === null || d === undefined ? "" : String(d) };
    case "select": case "status": return { type, text: (d as { name?: string } | null)?.name ?? "" };
    case "multi_select": case "people": return { type, text: names(d) };
    case "date": {
      const x = d as { start?: string; end?: string | null } | null;
      return x?.start ? { type, text: x.end ? `${x.start} → ${x.end}` : x.start, date: { start: x.start, end: x.end ?? null } } : { type, text: "" };
    }
    case "checkbox": return { type, text: d ? "✓" : "", checked: !!d };
    case "url": { const url = safeUrl(d); return { type, text: url ?? "", ...(url ? { url } : {}) }; }
    case "email": case "phone_number": case "created_time": case "last_edited_time": return { type, text: typeof d === "string" ? d : "" };
    case "formula": {
      const f = (d ?? {}) as { type?: string; [k: string]: unknown };
      const val = f.type ? f[f.type] : null;
      if (f.type === "date") return readProp({ type: "date", date: val });
      return { type, text: val === null || val === undefined ? "" : String(val) };
    }
    default: return { type, text: "" };
  }
}

export function titleOf(page: unknown): string {
  const props = ((page as { properties?: Record<string, unknown> })?.properties ?? {}) as Record<string, { type?: string }>;
  const t = Object.values(props).find((p) => p?.type === "title");
  return (t ? readProp(t).text : "").trim() || "Untitled";
}
