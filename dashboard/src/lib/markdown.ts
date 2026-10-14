/**
 * A deliberately small Markdown dialect for Base camp docs: # headings, **bold**, _italic_,
 * - lists, 1. lists, - [ ] checkboxes and [links](https://…). Everything is HTML-escaped first,
 * so a shared doc can never inject markup or scripts.
 */
export type Run = { text: string; bold?: boolean; italic?: boolean };
export type Block =
  | { type: "h1" | "h2" | "h3" | "p" | "bullet" | "number"; runs: Run[]; done?: undefined }
  | { type: "check"; runs: Run[]; done: boolean };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(s: string) {
  return esc(s)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])_([^_]+)_(?=$|[\s).,!?])/g, "$1<em>$2</em>");
}

function lineType(line: string): { type: Block["type"]; text: string; done?: boolean } {
  let m;
  if ((m = /^(#{1,3})\s+(.*)$/.exec(line))) return { type: (`h${m[1].length}` as "h1"), text: m[2] };
  if ((m = /^[-*]\s+\[( |x|X)\]\s+(.*)$/.exec(line))) return { type: "check", text: m[2], done: m[1] !== " " };
  if ((m = /^[-*]\s+(.*)$/.exec(line))) return { type: "bullet", text: m[1] };
  if ((m = /^\d+[.)]\s+(.*)$/.exec(line))) return { type: "number", text: m[1] };
  return { type: "p", text: line };
}

export function mdToHtml(md: string): string {
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of md.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) { close(); continue; }
    const { type, text, done } = lineType(line);
    const want = type === "bullet" || type === "check" ? "ul" : type === "number" ? "ol" : null;
    if (want !== list) { close(); if (want) { out.push(`<${want}>`); list = want; } }
    if (type === "check") out.push(`<li class="check" data-done="${done}">${inline(text)}</li>`);
    else if (want) out.push(`<li>${inline(text)}</li>`);
    else if (type === "p") out.push(`<p>${inline(text)}</p>`);
    else out.push(`<${type}>${inline(text)}</${type}>`);
  }
  close();
  return out.join("");
}

function runs(s: string): Run[] {
  const out: Run[] = [];
  const re = /\*\*([^*]+)\*\*|(^|[\s(])_([^_]+)_(?=$|[\s).,!?])/g;
  let last = 0, m;
  while ((m = re.exec(s))) {
    const lead = m[2] ?? "";
    if (m.index + lead.length > last) out.push({ text: s.slice(last, m.index + lead.length) });
    out.push(m[1] !== undefined ? { text: m[1], bold: true } : { text: m[3], italic: true });
    last = re.lastIndex;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out.map((r) => ({ ...r, text: r.text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1 ($2)") }));
}

export function mdBlocks(md: string): Block[] {
  return md.replace(/\r/g, "").split("\n").filter((l) => l.trim()).map((l) => {
    const { type, text, done } = lineType(l.trimEnd());
    return type === "check" ? { type, runs: runs(text), done: !!done } : { type, runs: runs(text) } as Block;
  });
}
