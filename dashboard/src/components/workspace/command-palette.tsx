"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Search, Sparkles, KanbanSquare, FileText, AudioLines, Gavel, Lightbulb, User, ArrowRight, Loader2, Sun, LayoutDashboard,
  Tent, Users, CheckSquare, Plus, Mic, CornerDownLeft,
} from "lucide-react";
import { mdToHtml } from "@/lib/markdown";
import type { SearchHit } from "@/app/api/search/route";

type Row = { id: string; icon: typeof Search; label: string; hint?: string; run: () => void; ask?: boolean };
const HIT_ICON = { card: KanbanSquare, doc: FileText, meeting: AudioLines, decision: Gavel, idea: Lightbulb, person: User } as const;

/** ⌘K: jump anywhere, find anything, or ask emet a question about the team's data. */
export function CommandPalette() {
  const t = useTranslations("palette");
  const tn = useTranslations("nav");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(0);
  const [answer, setAnswer] = useState<{ q: string; text: string | null; error?: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((v) => !v); }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("emet:palette", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("emet:palette", onOpen); };
  }, []);
  useEffect(() => { if (open) { setQ(""); setHits([]); setAnswer(null); setSel(0); setTimeout(() => input.current?.focus(), 10); } }, [open]);

  // Search as you type (debounced); the database decides what this person may see
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    setLoading(true);
    const id = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`).catch(() => null);
      setHits(res?.ok ? ((await res.json()) as { hits: SearchHit[] }).hits : []);
      setLoading(false); setSel(0);
    }, 180);
    return () => clearTimeout(id);
  }, [q]);

  const go = (href: string) => { setOpen(false); router.push(href); };
  async function ask(question: string) {
    setAnswer({ q: question, text: null });
    const res = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setAnswer({ q: question, text: res?.ok ? data.answer : null, error: res?.ok ? undefined : data.error ?? "failed" });
  }

  const rows: Row[] = useMemo(() => {
    const text = q.trim();
    if (!text) return [
      { id: "today", icon: Sun, label: tn("today"), run: () => go("/today") },
      { id: "overview", icon: LayoutDashboard, label: tn("overview"), run: () => go("/") },
      { id: "camp", icon: Tent, label: tn("camp"), run: () => go("/camp") },
      { id: "board", icon: KanbanSquare, label: tn("generalBoard"), run: () => go("/board") },
      { id: "lab", icon: Lightbulb, label: tn("lab"), run: () => go("/lab") },
      { id: "meetings", icon: AudioLines, label: tn("meetings"), run: () => go("/meetings") },
      { id: "tasks", icon: CheckSquare, label: tn("myTasks"), run: () => go("/my-tasks") },
      { id: "team", icon: Users, label: tn("team"), run: () => go("/team") },
      { id: "new-idea", icon: Plus, label: t("newIdea"), run: () => go("/lab") },
      { id: "new-doc", icon: Plus, label: t("newDoc"), run: () => go("/camp?tab=docs") },
      { id: "record", icon: Mic, label: t("recordMeeting"), run: () => go("/meetings") },
    ];
    return [
      { id: "ask", icon: Sparkles, label: t("ask", { q: text }), hint: t("askHint"), run: () => ask(text), ask: true },
      ...hits.map((h) => ({ id: `${h.type}-${h.id}`, icon: HIT_ICON[h.type], label: h.title, hint: h.snippet ? `${t(`types.${h.type}`)} · ${h.snippet}` : t(`types.${h.type}`), run: () => go(h.href) })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, hits]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") setOpen(false);
    if (answer) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(rows.length - 1, s + 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    if (e.key === "Enter") { e.preventDefault(); rows[sel]?.run(); }
  }

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-3 pt-[10vh] sm:pt-[14vh]" role="dialog" aria-modal="true" aria-label={t("label")}>
      <button className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" aria-label={t("close")} onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-surface shadow-[0_30px_80px_-20px_rgb(0_0_0/0.5)] ring-1 ring-line" onKeyDown={onKeyDown}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          {answer ? <Sparkles size={18} className="shrink-0 text-trail" /> : <Search size={18} className="shrink-0 text-muted" />}
          <input ref={input} value={answer ? answer.q : q} readOnly={!!answer} onChange={(e) => setQ(e.target.value)} placeholder={t("placeholder")}
                 aria-label={t("placeholder")} className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted/70 focus-visible:outline-none" />
          {loading && !answer && <Loader2 size={16} className="animate-spin text-muted" />}
          {answer && <button onClick={() => { setAnswer(null); setTimeout(() => input.current?.focus(), 10); }} className="text-xs text-muted hover:text-ink">{t("back")}</button>}
        </div>

        {answer ? (
          <div className="max-h-[60vh] overflow-y-auto p-5" aria-live="polite">
            {answer.text === null && !answer.error ? (
              <p className="flex items-center gap-2 text-sm text-muted"><Loader2 size={15} className="animate-spin" /> {t("thinking")}</p>
            ) : answer.error ? (
              <p className="text-sm">{answer.error === "no-key" ? t("noKey") : t("askFailed")}</p>
            ) : (
              <>
                <div className="doc-body text-[15px]" dangerouslySetInnerHTML={{ __html: mdToHtml(answer.text ?? "") }} />
                <p className="mt-4 text-xs text-muted">{t("fromData")}</p>
              </>
            )}
          </div>
        ) : (
          <ul className="max-h-[60vh] overflow-y-auto p-2" role="listbox">
            {!q.trim() && <li className="px-3 pt-1 pb-2 text-xs font-medium text-muted">{t("jump")}</li>}
            {rows.map((r, i) => (
              <li key={r.id} role="option" aria-selected={i === sel}>
                <button onMouseEnter={() => setSel(i)} onClick={r.run}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${i === sel ? "bg-surface-2" : ""}`}>
                  <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${r.ask ? "bg-trail text-white" : "bg-surface-2 text-muted"}`}><r.icon size={15} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.label}</span>
                    {r.hint && <span className="block truncate text-xs text-muted">{r.hint}</span>}
                  </span>
                  {i === sel && (r.ask ? <CornerDownLeft size={14} className="text-muted" /> : <ArrowRight size={14} className="text-muted" />)}
                </button>
              </li>
            ))}
            {q.trim().length >= 2 && !loading && !hits.length && <li className="px-3 py-3 text-sm text-muted">{t("noResults")}</li>}
          </ul>
        )}
        <div className="flex items-center justify-between border-t border-line px-4 py-2 text-[11px] text-muted">
          <span>{t("footer")}</span>
          <kbd className="rounded border border-line px-1.5 py-0.5 font-sans">⌘K</kbd>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** The header button that opens the palette (phones have no ⌘K). */
export function SearchButton() {
  const t = useTranslations("palette");
  return (
    <button onClick={() => window.dispatchEvent(new Event("emet:palette"))} aria-label={t("label")}
            className="flex h-9 items-center gap-2 rounded-full px-2.5 text-sm text-muted transition hover:bg-surface-2 hover:text-ink sm:bg-surface-2/70 sm:pr-3">
      <Search size={16} /> <span className="hidden md:inline">{t("short")}</span>
      <kbd className="hidden rounded border border-line px-1 text-[10px] lg:inline">⌘K</kbd>
    </button>
  );
}
