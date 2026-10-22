"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Search, FileText, Database, ExternalLink, ChevronLeft, Loader2, BookOpen } from "lucide-react";
import type { RNode } from "@/lib/notion/blocks";
import type { PropValue } from "@/lib/notion/props";
import { NotionNodes } from "./notion-render";

type Hit = { id: string; c: string; kind: "page" | "database"; title: string; icon: string | null; workspace: string | null; url: string | null };
type Page = { kind: "page"; id: string; c: string; title: string; url: string; icon: string | null; nodes: RNode[] };
type Db = { kind: "database"; id: string; c: string; title: string; columns: { name: string; type: string }[]; rows: { id: string; url: string; cells: Record<string, PropValue> }[] };

/** Base camp → Notion: search / recent on the left, the page or database on the right (phones: list, then full-screen page). */
export function NotionTab({ meId }: { meId: string }) {
  const t = useTranslations("notion");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [connected, setConnected] = useState(true);
  const [open, setOpen] = useState<Page | Db | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trail = useRef<{ id: string; c: string; db: boolean }[]>([]);

  async function search(words: string) {
    const res = await fetch(`/api/notion/search?q=${encodeURIComponent(words)}`).catch(() => null);
    const j = res?.ok ? await res.json() : { connected: true, results: [] };
    setConnected(j.connected); setHits(j.results);
  }
  useEffect(() => { search(""); }, []);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => search(q), 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q]);

  async function show(id: string, c: string, db: boolean, push = true) {
    setLoading(true); setError(false);
    const res = await fetch(`/api/notion/${db ? "database" : "page"}/${id}?c=${c}`).catch(() => null);
    setLoading(false);
    if (!res?.ok) { setError(true); return; }
    const j = await res.json();
    if (push && open) trail.current.push({ id: open.id, c: open.c, db: open.kind === "database" });
    setOpen({ ...j, kind: db ? "database" : "page" });
  }
  function back() {
    const prev = trail.current.pop();
    if (prev) show(prev.id, prev.c, prev.db, false); else setOpen(null);
  }

  if (!connected) return (
    <section className="panel p-6 text-center">
      <BookOpen size={22} className="mx-auto text-brand" />
      <p className="mt-2 font-medium">{t("tabEmptyTitle")}</p>
      <p className="mt-1 text-sm text-muted">{t("tabEmptyText")}</p>
      <Link href={`/team/${meId}#connections`} className="mt-3 inline-flex rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-contrast">{t("connect")}</Link>
    </section>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className={`panel p-3 ${open ? "max-lg:hidden" : ""}`}>
        <label className="flex items-center gap-2 rounded-xl bg-surface-2/70 px-3 py-2">
          <Search size={15} className="text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} aria-label={t("search")} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
        <p className="mt-3 px-1 text-[11px] font-medium tracking-wide text-muted uppercase">{q ? t("results") : t("recent")}</p>
        {!hits ? <Loader2 size={16} className="m-3 animate-spin text-muted" /> : hits.length === 0 ? <p className="p-3 text-sm text-muted">{t("nothing")}</p> : (
          <ul className="mt-1 max-h-[65vh] space-y-0.5 overflow-y-auto">
            {hits.map((h) => (
              <li key={`${h.c}:${h.id}`}>
                <button type="button" onClick={() => { trail.current = []; show(h.id, h.c, h.kind === "database", false); }}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2/70 ${open?.id === h.id ? "bg-surface-2" : ""}`}>
                  <span className="w-5 shrink-0 text-center text-muted">{h.icon ?? (h.kind === "database" ? <Database size={15} /> : <FileText size={15} />)}</span>
                  <span className="min-w-0 flex-1 truncate">{h.title}</span>
                  {h.workspace && <span className="max-w-24 shrink-0 truncate text-[10px] text-muted">{h.workspace}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className={`panel min-h-[50vh] min-w-0 p-5 sm:p-7 ${open ? "" : "max-lg:hidden"}`}>
        {loading ? <Loader2 size={18} className="animate-spin text-muted" /> : error ? <p className="text-sm text-bad-text">{t("loadFailed")}</p> : !open ? (
          <p className="text-sm text-muted">{t("pick")}</p>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-2">
              <button type="button" onClick={back} className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-muted hover:bg-surface-2 lg:hidden"><ChevronLeft size={15} /> {t("back")}</button>
              {trail.current.length > 0 && <button type="button" onClick={back} className="hidden items-center gap-1 rounded-lg px-2 py-1 text-sm text-muted hover:bg-surface-2 lg:flex"><ChevronLeft size={15} /> {t("back")}</button>}
              {open.kind === "page" && <a href={open.url} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-muted hover:bg-surface-2 hover:text-ink"><ExternalLink size={14} /> {t("openInNotion")}</a>}
            </div>
            <h1 className="mb-3 text-2xl font-semibold tracking-tight">{open.kind === "page" && open.icon ? `${open.icon} ` : ""}{open.title}</h1>
            {open.kind === "page" ? (
              <div className="text-[15px]"><NotionNodes nodes={open.nodes} onOpen={(id, db) => show(id, open.c, db)} labels={{ open: t("openInNotion") }} /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead><tr className="border-b border-line text-left text-xs text-muted">{open.columns.map((c) => <th key={c.name} className="px-2 pb-2 font-medium">{c.name}</th>)}</tr></thead>
                  <tbody>{open.rows.map((r) => (
                    <tr key={r.id} className="border-b border-line/60 hover:bg-surface-2/50">
                      {open.columns.map((c, i) => (
                        <td key={c.name} className="px-2 py-2 align-top">
                          {i === 0 ? <button type="button" onClick={() => show(r.id, open.c, false)} className="text-left font-medium hover:underline">{r.cells[c.name]?.text || t("untitled")}</button>
                            : r.cells[c.name]?.url ? <a href={r.cells[c.name].url} target="_blank" rel="noopener noreferrer" className="text-climbed underline">{r.cells[c.name].text}</a>
                            : <span className="text-muted">{r.cells[c.name]?.text}</span>}
                        </td>
                      ))}
                    </tr>
                  ))}</tbody>
                </table>
                {open.rows.length === 0 && <p className="py-4 text-sm text-muted">{t("noRows")}</p>}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
