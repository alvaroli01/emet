"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Search, Sparkles, KanbanSquare, FileText, AudioLines, Gavel, Lightbulb, User, ArrowRight, Loader2, Sun, LayoutDashboard,
  Tent, Users, CheckSquare, Plus, Mic, CornerDownLeft, ArrowUp,
} from "lucide-react";
import { mdToHtml } from "@/lib/markdown";

type Msg = { role: "user" | "assistant"; text: string | null; error?: string };
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
  // Ask emet is a conversation: every question and answer stays on screen and is sent along with the next question
  const [chat, setChat] = useState<Msg[] | null>(null);
  const [follow, setFollow] = useState("");
  const chatEnd = useRef<HTMLDivElement>(null);
  const busy = !!chat && chat.at(-1)?.role === "assistant" && chat.at(-1)?.text === null && !chat.at(-1)?.error;
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((v) => !v); }
    };
    const onOpen = () => setOpen(true);
    // "emet:ask" with a question (e.g. from Today's big ask box) opens straight to the answer
    const onAsk = (e: Event) => { pending.current = String((e as CustomEvent<string>).detail ?? "").trim() || null; setOpen(true); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("emet:palette", onOpen);
    window.addEventListener("emet:ask", onAsk);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("emet:palette", onOpen); window.removeEventListener("emet:ask", onAsk); };
  }, []);
  useEffect(() => {
    if (!open) return;
    const question = pending.current; pending.current = null;
    setQ(question ?? ""); setHits([]); setChat(null); setFollow(""); setSel(0);
    if (question) ask(question); else setTimeout(() => input.current?.focus(), 10);
  }, [open]);

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
  async function ask(question: string, prev: Msg[] = []) {
    setChat([...prev, { role: "user", text: question }, { role: "assistant", text: null }]);
    const history = prev.filter((m) => m.text && !m.error).map((m) => ({ role: m.role, content: m.text! }));
    const res = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, history }) }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setChat([...prev, { role: "user", text: question }, { role: "assistant", text: res?.ok ? data.answer : null, error: res?.ok ? undefined : data.error ?? "failed" }]);
  }
  useEffect(() => { chatEnd.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [chat]);
  function sendFollow(e: React.FormEvent) {
    e.preventDefault();
    const text = follow.trim();
    if (!text || busy || !chat) return;
    setFollow(""); ask(text, chat);
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
    if (chat) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(rows.length - 1, s + 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    if (e.key === "Enter") { e.preventDefault(); rows[sel]?.run(); }
  }

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-3 pt-[10vh] sm:pt-[14vh]" role="dialog" aria-modal="true" aria-label={t("label")}>
      <button className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" aria-label={t("close")} onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-solid shadow-[0_30px_80px_-20px_rgb(0_0_0/0.5)] ring-1 ring-line" onKeyDown={onKeyDown}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          {chat ? <Sparkles size={18} className="shrink-0 text-brand" /> : <Search size={18} className="shrink-0 text-muted" />}
          {chat ? <p className="h-14 flex-1 content-center font-semibold">{t("chatTitle")}</p> : (
            <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("placeholder")}
                   aria-label={t("placeholder")} className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted focus-visible:outline-none" />
          )}
          {loading && !chat && <Loader2 size={16} className="animate-spin text-muted" />}
          {chat && <button onClick={() => { setChat(null); setQ(""); setTimeout(() => input.current?.focus(), 10); }} className="rounded-full px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface-2 hover:text-ink">{t("newChat")}</button>}
        </div>

        {chat ? (
          <>
            <div className="max-h-[55vh] space-y-4 overflow-y-auto p-4 sm:p-5" aria-live="polite">
              {chat.map((m, i) => m.role === "user" ? (
                <p key={i} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-[15px] font-medium text-white">{m.text}</p>
              ) : m.text === null && !m.error ? (
                <p key={i} className="flex items-center gap-2 text-sm text-muted"><Loader2 size={15} className="animate-spin" /> {t("thinking")}</p>
              ) : m.error ? (
                <p key={i} className="max-w-[90%] rounded-2xl rounded-bl-md bg-surface-2 px-4 py-3 text-sm">{m.error === "no-key" ? t("noKey") : t("askFailed")}</p>
              ) : (
                <div key={i} className="doc-body max-w-[92%] rounded-2xl rounded-bl-md bg-surface-2 px-4 py-3 text-[15px]" dangerouslySetInnerHTML={{ __html: mdToHtml(m.text ?? "") }} />
              ))}
              <div ref={chatEnd} />
            </div>
            <form onSubmit={sendFollow} className="flex items-center gap-2 border-t border-line p-3">
              <label htmlFor="ask-follow" className="sr-only">{t("followUp")}</label>
              <input id="ask-follow" autoFocus value={follow} onChange={(e) => setFollow(e.target.value)} placeholder={t("followUp")} autoComplete="off"
                     className="h-11 min-w-0 flex-1 rounded-full bg-surface-2 px-4 text-[15px] outline-none placeholder:text-muted focus:ring-2 focus:ring-brand/40" />
              <button disabled={busy || !follow.trim()} aria-label={t("send")} className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-white transition disabled:opacity-40"><ArrowUp size={18} /></button>
            </form>
            <p className="px-4 pb-3 text-[11px] text-muted">{t("fromData")}</p>
          </>
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
        {!chat && <div className="flex items-center justify-between border-t border-line px-4 py-2 text-[11px] text-muted">
          <span>{t("footer")}</span>
          <kbd className="rounded border border-line px-1.5 py-0.5 font-sans">⌘K</kbd>
        </div>}
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
            className="glass-pill h-10 w-10 justify-center text-sm text-muted transition hover:text-ink md:w-full md:max-w-md md:justify-start md:px-4">
      <Search size={16} /> <span className="hidden flex-1 text-left md:inline">{t("short")}</span>
      <kbd className="hidden rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] lg:inline">⌘ K</kbd>
    </button>
  );
}
