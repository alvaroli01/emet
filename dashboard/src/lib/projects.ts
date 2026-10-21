/** My Projects: pure helpers shared by the project pages and tests. */
export type LinkKind = "doc" | "sheet" | "slides" | "drive" | "form" | "canva" | "notion" | "figma" | "other";

export function linkKind(url: string): LinkKind {
  const u = url.toLowerCase();
  if (/docs\.google\.com\/document|\.docx?(\?|$)|:w:\//.test(u)) return "doc";
  if (/docs\.google\.com\/spreadsheets|\.xlsx?(\?|$)|:x:\//.test(u)) return "sheet";
  if (/docs\.google\.com\/presentation|\.pptx?(\?|$)|:p:\//.test(u)) return "slides";
  if (/docs\.google\.com\/forms|forms\.gle/.test(u)) return "form";
  if (/drive\.google\.com/.test(u)) return "drive";
  if (/canva\.com/.test(u)) return "canva";
  if (/notion\.(so|site)/.test(u)) return "notion";
  if (/figma\.com/.test(u)) return "figma";
  return "other";
}

export function cleanUrl(raw: string): string | null {
  let s = raw.trim();
  if (!s || /\s/.test(s)) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s}`;
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (!u.hostname.includes(".")) return null;
  u.protocol = "https:";
  return u.toString();
}

export const progress = (revenue: number, goal: number | null) => (goal && goal > 0 ? Math.min(1, Math.round((revenue / goal) * 100) / 100) : null);

export function daysLeft(endsOn: string | null, today: string): number | null {
  return endsOn ? Math.round((Date.parse(endsOn) - Date.parse(today)) / 864e5) : null;
}

export function cardHref(card: { id: string; boards?: { group_id: string | null; project_id?: string | null } | null }, slugOf: (gid: string) => string | undefined): string {
  const b = card.boards;
  if (b?.project_id) return `/projects/${b.project_id}?tab=tasks&card=${card.id}`;
  const slug = b?.group_id ? slugOf(b.group_id) : undefined;
  return slug ? `/g/${slug}?card=${card.id}` : `/board?card=${card.id}`;
}
