"use client";

import { Fragment } from "react";
import { FileText, Database, ExternalLink, Square, CheckSquare } from "lucide-react";
import type { RNode, Span } from "@/lib/notion/blocks";

/** Draws Notion content as plain React text (never raw HTML). Links open in a new tab; child pages open inside emet. */
const COLOR: Record<string, string> = {
  gray: "text-muted", brown: "text-[#c49a6c]", orange: "text-[#ff9b5a]", yellow: "text-[#f5c451]", green: "text-ok-text", blue: "text-[#7fb3ff]",
  purple: "text-[#c4a1ff]", pink: "text-[#ff8fc7]", red: "text-bad-text",
};

export function Spans({ s }: { s: Span[] }) {
  return (
    <>
      {s.map((x, i) => {
        const cls = [x.bold && "font-semibold", x.italic && "italic", x.strike && "line-through", x.underline && "underline",
          x.code && "rounded bg-surface-2 px-1 font-mono text-[0.9em]", x.color && (COLOR[x.color.replace(/_background$/, "")] ?? "")].filter(Boolean).join(" ");
        const body = cls ? <span className={cls}>{x.text}</span> : x.text;
        return x.href ? <a key={i} href={x.href} target="_blank" rel="noopener noreferrer" className="text-climbed underline underline-offset-2">{body}</a> : <Fragment key={i}>{body}</Fragment>;
      })}
    </>
  );
}

type Open = (id: string, db: boolean) => void;

export function NotionNodes({ nodes, onOpen, labels }: { nodes: RNode[]; onOpen: Open; labels: { open: string } }) {
  const out: React.ReactNode[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.kind === "bullet" || n.kind === "number") {
      const run: RNode[] = [];
      while (i < nodes.length && nodes[i].kind === n.kind) run.push(nodes[i++]);
      i--;
      const List = n.kind === "number" ? "ol" : "ul";
      out.push(<List key={n.id} className={`my-1 space-y-1 pl-6 ${n.kind === "number" ? "list-decimal" : "list-disc"}`}>
        {run.map((x) => x.kind === n.kind && <li key={x.id}><Spans s={x.spans} />{x.children.length > 0 && <NotionNodes nodes={x.children} onOpen={onOpen} labels={labels} />}</li>)}
      </List>);
      continue;
    }
    out.push(<Node key={n.id} n={n} onOpen={onOpen} labels={labels} />);
  }
  return <>{out}</>;
}

function Node({ n, onOpen, labels }: { n: RNode; onOpen: Open; labels: { open: string } }) {
  switch (n.kind) {
    case "heading": {
      const cls = n.level === 1 ? "mt-6 text-2xl font-semibold" : n.level === 2 ? "mt-5 text-xl font-semibold" : "mt-4 text-lg font-semibold";
      return <p role="heading" aria-level={n.level + 1} className={cls}><Spans s={n.spans} /></p>;
    }
    case "paragraph": return <p className="my-1.5 min-h-[1em] leading-relaxed"><Spans s={n.spans} /></p>;
    case "quote": return <blockquote className="my-2 border-l-2 border-line pl-3 text-muted"><Spans s={n.spans} /></blockquote>;
    case "callout": return <div className="my-2 flex gap-2 rounded-xl bg-surface-2/70 p-3">{n.icon && <span aria-hidden>{n.icon}</span>}<p><Spans s={n.spans} /></p></div>;
    case "todo": return (
      <div className="my-1">
        <p className="flex items-start gap-2">{n.checked ? <CheckSquare size={16} className="mt-0.5 shrink-0 text-ok-text" /> : <Square size={16} className="mt-0.5 shrink-0 text-muted" />}
          <span className={n.checked ? "text-muted line-through" : ""}><Spans s={n.spans} /></span></p>
        {n.children.length > 0 && <div className="pl-6"><NotionNodes nodes={n.children} onOpen={onOpen} labels={labels} /></div>}
      </div>
    );
    case "toggle": return (
      <details className="my-1"><summary className="cursor-pointer"><Spans s={n.spans} /></summary>
        <div className="pl-5"><NotionNodes nodes={n.children} onOpen={onOpen} labels={labels} /></div></details>
    );
    case "code": return <pre className="my-2 overflow-x-auto rounded-xl bg-surface-2 p-3 font-mono text-xs"><code>{n.text}</code></pre>;
    case "divider": return <hr className="my-4 border-line" />;
    case "image": return n.url ? (
      <figure className="my-3">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={n.url} alt="" className="max-h-[480px] rounded-xl" loading="lazy" />
        {n.caption.length > 0 && <figcaption className="mt-1 text-xs text-muted"><Spans s={n.caption} /></figcaption>}</figure>
    ) : null;
    case "file": case "bookmark": return n.url ? (
      <a href={n.url} target="_blank" rel="noopener noreferrer" className="my-2 flex items-center gap-2 rounded-xl bg-surface-2/60 px-3 py-2 text-sm hover:bg-surface-2">
        <ExternalLink size={14} className="shrink-0 text-muted" /><span className="truncate">{n.caption.length ? n.caption.map((c) => c.text).join("") : n.url}</span></a>
    ) : null;
    case "table": return (
      <div className="my-3 overflow-x-auto"><table className="w-full border-collapse text-sm">
        <tbody>{n.rows.map((r, i) => <tr key={i} className="border-b border-line">{r.map((c, j) => {
          const Cell = n.header && i === 0 ? "th" : "td";
          return <Cell key={j} className="px-2 py-1.5 text-left align-top"><Spans s={c} /></Cell>;
        })}</tr>)}</tbody></table></div>
    );
    case "child": return (
      <button type="button" onClick={() => onOpen(n.target, n.db)} className="my-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2/60">
        {n.db ? <Database size={15} className="text-muted" /> : <FileText size={15} className="text-muted" />}<span className="underline-offset-2 hover:underline">{n.title || "Untitled"}</span>
      </button>
    );
    case "columns": return <div className="my-2 grid gap-4 sm:grid-flow-col sm:auto-cols-fr">{n.columns.map((col, i) => <div key={i}><NotionNodes nodes={col} onOpen={onOpen} labels={labels} /></div>)}</div>;
    case "unsupported": return <p className="my-1 inline-flex rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">{labels.open} · {n.type.replace(/_/g, " ")}</p>;
    default: return null;
  }
}
