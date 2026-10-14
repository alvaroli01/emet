import { mdBlocks, mdToHtml } from "./markdown";

/** Downloads for Base camp docs. Word export loads its library only when someone asks for it. */
type ExportDoc = { title: string; body: string; doc_date: string };

const fileName = (d: ExportDoc, ext: string) =>
  `${d.doc_date} ${d.title || "doc"}`.replace(/[\\/:*?"<>|]+/g, "-").trim() + ext;

function save(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function downloadMarkdown(d: ExportDoc) {
  save(new Blob([`# ${d.title}\n_${d.doc_date}_\n\n${d.body}\n`], { type: "text/markdown" }), fileName(d, ".md"));
}

export async function downloadWord(d: ExportDoc) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
  const heading = { h1: HeadingLevel.HEADING_1, h2: HeadingLevel.HEADING_2, h3: HeadingLevel.HEADING_3 } as const;
  const children = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(d.title)] }),
    new Paragraph({ children: [new TextRun({ text: d.doc_date, italics: true, color: "666666" })] }),
    ...mdBlocks(d.body).map((b) => {
      const runs = b.runs.map((r) => new TextRun({ text: r.text, bold: r.bold, italics: r.italic }));
      if (b.type === "h1" || b.type === "h2" || b.type === "h3") return new Paragraph({ heading: heading[b.type], children: runs });
      if (b.type === "bullet") return new Paragraph({ bullet: { level: 0 }, children: runs });
      if (b.type === "number") return new Paragraph({ children: [new TextRun("• "), ...runs] });
      if (b.type === "check") return new Paragraph({ children: [new TextRun(b.done ? "☑ " : "☐ "), ...runs] });
      return new Paragraph({ children: runs });
    }),
  ];
  const blob = await Packer.toBlob(new Document({ creator: "emet HQ", title: d.title, sections: [{ children }] }));
  save(blob, fileName(d, ".docx"));
}

/** Opens a clean print view; the browser's "Save as PDF" makes the file. */
export function downloadPdf(d: ExportDoc) {
  const w = window.open("", "_blank");
  if (!w) return;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(fileName(d, ""))}</title>
<style>
  body{font:15px/1.6 Archivo,system-ui,sans-serif;color:#1a201c;max-width:680px;margin:48px auto;padding:0 24px}
  h1.t{font-size:28px;margin:0}.date{color:#59625b;margin:4px 0 28px}
  h1,h2,h3{line-height:1.25;margin:1.4em 0 .4em} li.check{list-style:none;margin-left:-1.2em}
  li.check::before{content:"☐ "} li.check[data-done="true"]::before{content:"☑ "}
  a{color:#2b6ca3}
</style></head><body><h1 class="t">${esc(d.title)}</h1><p class="date">${esc(d.doc_date)}</p>${mdToHtml(d.body)}
<script>window.onload=()=>{window.print()}</script></body></html>`);
  w.document.close();
}
