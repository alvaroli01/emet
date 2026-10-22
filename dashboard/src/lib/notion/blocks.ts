/**
 * Notion content ⇄ emet (pure, tested).
 *  - toRender: Notion blocks (with their children attached as `children`) → a small render model the page view draws as
 *    plain React text (never HTML), so nothing from Notion can run code in the dashboard.
 *  - markdownToBlocks: our notes/docs (Markdown) → Notion blocks for "Save to Notion".
 */
export type Span = { text: string; bold?: boolean; italic?: boolean; strike?: boolean; code?: boolean; underline?: boolean; color?: string; href?: string };
type Base = { id: string };
export type RNode =
  | (Base & { kind: "heading"; level: 1 | 2 | 3; spans: Span[] })
  | (Base & { kind: "paragraph" | "quote" | "callout"; spans: Span[]; icon?: string })
  | (Base & { kind: "bullet" | "number" | "todo" | "toggle"; spans: Span[]; checked?: boolean; children: RNode[] })
  | (Base & { kind: "code"; text: string; language: string })
  | (Base & { kind: "divider" })
  | (Base & { kind: "image" | "file" | "bookmark"; url: string; caption: Span[] })
  | (Base & { kind: "table"; rows: Span[][][]; header: boolean })
  | (Base & { kind: "child"; title: string; target: string; db: boolean })
  | (Base & { kind: "columns"; columns: RNode[][] })
  | (Base & { kind: "unsupported"; type: string });

type Rich = { plain_text?: string; href?: string | null; text?: { content?: string; link?: { url?: string } | null }; annotations?: Record<string, unknown> };
type Block = { id: string; type: string; children?: Block[]; [k: string]: unknown };

const SAFE = /^(https?:\/\/|mailto:)/i;
const safeHref = (u: unknown) => (typeof u === "string" && SAFE.test(u) ? u : undefined);

export function spans(rich: unknown): Span[] {
  if (!Array.isArray(rich)) return [];
  return (rich as Rich[]).map((r) => {
    const a = r.annotations ?? {};
    const s: Span = { text: r.plain_text ?? r.text?.content ?? "" };
    if (a.bold) s.bold = true;
    if (a.italic) s.italic = true;
    if (a.strikethrough) s.strike = true;
    if (a.underline) s.underline = true;
    if (a.code) s.code = true;
    if (typeof a.color === "string" && a.color !== "default") s.color = a.color;
    const href = safeHref(r.href ?? r.text?.link?.url);
    if (href) s.href = href;
    return s;
  });
}

const data = (b: Block) => (b[b.type] ?? {}) as Record<string, unknown>;
const fileUrl = (d: Record<string, unknown>) => {
  const f = (d.type === "external" ? d.external : d.file) as { url?: string } | undefined;
  return safeHref(f?.url ?? d.url) ?? "";
};

export function toRender(blocks: unknown[]): RNode[] {
  return (blocks as Block[]).map((b): RNode => {
    const d = data(b), id = b.id, kids = b.children ?? [];
    switch (b.type) {
      case "heading_1": case "heading_2": case "heading_3":
        return { kind: "heading", level: Number(b.type.slice(-1)) as 1 | 2 | 3, spans: spans(d.rich_text), id };
      case "paragraph": case "quote":
        return { kind: b.type, spans: spans(d.rich_text), id };
      case "callout": {
        const icon = d.icon as { type?: string; emoji?: string } | undefined;
        return { kind: "callout", spans: spans(d.rich_text), id, ...(icon?.type === "emoji" && icon.emoji ? { icon: icon.emoji } : {}) };
      }
      case "bulleted_list_item": case "numbered_list_item": case "to_do": case "toggle": {
        const kind = b.type === "bulleted_list_item" ? "bullet" : b.type === "numbered_list_item" ? "number" : b.type === "to_do" ? "todo" : "toggle";
        return { kind, spans: spans(d.rich_text), id, children: toRender(kids), ...(b.type === "to_do" ? { checked: !!d.checked } : {}) };
      }
      case "code":
        return { kind: "code", text: spans(d.rich_text).map((s) => s.text).join(""), language: String(d.language ?? "plain text"), id };
      case "divider":
        return { kind: "divider", id };
      case "image": case "file": case "pdf": case "video": case "audio":
        return { kind: b.type === "image" ? "image" : "file", url: fileUrl(d), caption: spans(d.caption), id };
      case "bookmark": case "link_preview": case "embed":
        return { kind: "bookmark", url: safeHref(d.url) ?? "", caption: spans(d.caption), id };
      case "table":
        return { kind: "table", header: !!d.has_column_header, rows: kids.map((r) => ((data(r).cells as unknown[]) ?? []).map((c) => spans(c))), id };
      case "child_page": case "child_database":
        return { kind: "child", title: String(d.title ?? ""), target: id, db: b.type === "child_database", id };
      case "column_list":
        return { kind: "columns", columns: kids.map((c) => toRender(c.children ?? [])), id };
      default:
        return { kind: "unsupported", type: b.type, id };
    }
  });
}

// ── Markdown → Notion blocks ──────────────────────────────────────────────────
const MAX = 2000;
const LANGS: Record<string, string> = { js: "javascript", ts: "typescript", py: "python", sh: "shell", bash: "shell", md: "markdown", yml: "yaml", "": "plain text" };

type RichOut = { type: "text"; text: { content: string; link: { url: string } | null }; annotations?: Record<string, boolean> };

/** Inline Markdown (**bold**, *italic*, `code`, [text](url)) → Notion rich text, each piece ≤ 2000 characters. */
function inline(s: string): RichOut[] {
  const out: RichOut[] = [];
  const push = (content: string, ann?: Record<string, boolean>, url?: string) => {
    for (let i = 0; i < content.length; i += MAX) {
      out.push({ type: "text", text: { content: content.slice(i, i + MAX), link: url ? { url } : null }, ...(ann ? { annotations: ann } : {}) });
    }
  };
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*([^*]+)\*|_([^_]+)_)/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) push(s.slice(last, m.index));
    if (m[2]) push(m[2], { bold: true });
    else if (m[3]) push(m[3], { code: true });
    else if (m[4]) push(m[4], undefined, safeHref(m[5]));
    else push(m[6] ?? m[7], { italic: true });
    last = m.index + m[0].length;
  }
  if (last < s.length) push(s.slice(last));
  return out;
}

const text = (type: string, s: string, extra: Record<string, unknown> = {}) => ({ object: "block", type, [type]: { rich_text: inline(s), ...extra } });
const cells = (line: string) => line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export function markdownToBlocks(md: string): object[] {
  const lines = md.replace(/\r/g, "").split("\n");
  const out: object[] = [];
  let para: string[] = [];
  const flush = () => { if (para.length) { out.push(text("paragraph", para.join(" "))); para = []; } };
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i], line = raw.trim();
    let m: RegExpMatchArray | null;
    if (!line) { flush(); continue; }
    if (line.startsWith("```")) {
      flush();
      const lang = line.slice(3).trim().toLowerCase();
      const body: string[] = [];
      while (++i < lines.length && !lines[i].trim().startsWith("```")) body.push(lines[i]);
      const code = body.join("\n");
      const pieces = Array.from({ length: Math.ceil(code.length / MAX) }, (_, k) => ({ type: "text", text: { content: code.slice(k * MAX, (k + 1) * MAX), link: null } }));
      out.push({ object: "block", type: "code", code: { rich_text: pieces, language: LANGS[lang] ?? lang } });
      continue;
    }
    if (line.startsWith("|") && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1].trim())) {
      flush();
      const header = cells(line);
      const rows = [header];
      i += 1;
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith("|")) rows.push(cells(lines[++i]));
      const width = header.length;
      out.push({ object: "block", type: "table", table: { table_width: width, has_column_header: true, has_row_header: false,
        children: rows.map((r) => ({ object: "block", type: "table_row", table_row: { cells: Array.from({ length: width }, (_, k) => inline(r[k] ?? "")) } })) } });
      continue;
    }
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) { flush(); out.push(text(`heading_${m[1].length}`, m[2])); continue; }
    if ((m = line.match(/^[-*]\s+\[( |x|X)\]\s+(.*)$/))) { flush(); out.push(text("to_do", m[2], { checked: m[1].toLowerCase() === "x" })); continue; }
    if ((m = line.match(/^[-*]\s+(.*)$/))) { flush(); out.push(text("bulleted_list_item", m[1])); continue; }
    if ((m = line.match(/^\d+[.)]\s+(.*)$/))) { flush(); out.push(text("numbered_list_item", m[1])); continue; }
    if ((m = line.match(/^>\s?(.*)$/))) { flush(); out.push(text("quote", m[1])); continue; }
    if (/^(-{3,}|\*{3,})$/.test(line)) { flush(); out.push({ object: "block", type: "divider", divider: {} }); continue; }
    para.push(line);
  }
  flush();
  return out;
}

export function chunk<T>(xs: T[], n = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}
