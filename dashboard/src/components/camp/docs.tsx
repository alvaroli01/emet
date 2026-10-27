"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Plus, Search, Mic, Pin, PinOff, Trash2, Download, Share2, Bold, Heading1, Heading2, List, ListChecks, Eye, PenLine, ArrowLeft, Users, Lock, FileText, Sparkles, Loader2,
} from "lucide-react";
import { SaveToNotion } from "@/components/notion/save-to-notion";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { Avatar } from "@/components/ui";
import { mdToHtml } from "@/lib/markdown";
import { shortDate, todayISO, timeAgo } from "@/lib/format";
import type { Member } from "@/lib/boards";
import { Recorder } from "./recorder";
import { AudioPlayer } from "./audio-player";
import { writeNotesNow } from "@/lib/ai/notes-client";
import { missingNotes, withNotes } from "@/lib/ai/doc-notes";

export type Doc = {
  id: string; owner_id: string; title: string; body: string; kind: "note" | "meeting"; pinned: boolean; tags: string[];
  share_all: boolean; shared_with: string[]; doc_date: string; created_at: string; updated_at: string; audio_parts?: number;
};

export function DocsTab({ mine, shared, members, meId, ai, initialOpen }: { mine: Doc[]; shared: Doc[]; members: Member[]; meId: string; ai: { connected: boolean; last4: string | null }; initialOpen?: string }) {
  const t = useTranslations("camp.docs");
  const locale = useLocale();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [docs, setDocs] = useState(mine);
  const [openId, setOpenId] = useState<string | null>(initialOpen ?? null);
  const [query, setQuery] = useState("");
  const [naming, setNaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [recording, setRecording] = useState(false);

  const all = [...docs, ...shared];
  const open = all.find((d) => d.id === openId) ?? null;
  const q = query.trim().toLowerCase();
  const match = (d: Doc) => !q || d.title.toLowerCase().includes(q) || d.body.toLowerCase().includes(q);
  const sorted = [...docs].filter(match).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at));
  const names = Object.fromEntries(members.map((m) => [m.id, m]));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const title = newName.trim();
    if (!title) return;
    const now = new Date().toISOString();
    const doc: Doc = { id: crypto.randomUUID(), owner_id: meId, title, body: "", kind: "note", pinned: false, tags: [],
      share_all: false, shared_with: [], doc_date: todayISO(), created_at: now, updated_at: now };
    setDocs((d) => [doc, ...d]);
    setOpenId(doc.id);
    setNaming(false); setNewName("");
    const { id, title: tt, doc_date } = doc;
    const { error } = await supabase.from("docs").insert({ id, title: tt, doc_date });
    if (error) { setDocs((d) => d.filter((x) => x.id !== doc.id)); setOpenId(null); toast("error", t("saveError")); }
  }

  // Someone a recording was shared with wrote its summary: it becomes their own doc (they can't edit the original)
  async function saveCopy(copy: { title: string; body: string }) {
    const now = new Date().toISOString();
    const doc: Doc = { id: crypto.randomUUID(), owner_id: meId, title: copy.title.slice(0, 200), body: copy.body, kind: "meeting", pinned: false, tags: [],
      share_all: false, shared_with: [], doc_date: todayISO(), created_at: now, updated_at: now };
    const { error } = await supabase.from("docs").insert({ id: doc.id, title: doc.title, body: doc.body, kind: doc.kind, doc_date: doc.doc_date });
    if (error) return toast("error", t("saveError"));
    setDocs((d) => [doc, ...d]);
    setOpenId(doc.id);
    toast("ok", t("summaryCopied"));
  }

  const update = (id: string, patch: Partial<Doc>) => setDocs((d) => d.map((x) => (x.id === id ? { ...x, ...patch, updated_at: new Date().toISOString() } : x)));

  async function remove(doc: Doc) {
    if (!confirm(t("confirmDelete", { title: doc.title }))) return;
    setDocs((d) => d.filter((x) => x.id !== doc.id));
    setOpenId(null);
    const { error } = await supabase.from("docs").delete().eq("id", doc.id);
    if (error) toast("error", t("saveError")); else toast("ok", t("deleted"));
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      {recording && (
        <Recorder connected={ai.connected} last4={ai.last4} onClose={() => setRecording(false)}
                  onCreated={(doc) => { setDocs((d) => [doc, ...d]); setOpenId(doc.id); setRecording(false); }} />
      )}
      <aside className={`min-w-0 space-y-3 ${open ? "hidden lg:block" : ""}`}>
        <div className="flex gap-2">
          <label className="relative flex-1">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} className="input pl-9" />
          </label>
          <button onClick={() => setRecording(true)} aria-label={t("record")} title={t("record")}
                  className="grid size-[42px] shrink-0 place-items-center rounded-xl bg-trail text-white shadow-[var(--shadow)] transition hover:brightness-105">
            <Mic size={17} />
          </button>
          <button onClick={() => setNaming(true)} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-brand px-3 text-sm font-medium text-brand-contrast">
            <Plus size={16} /> {t("new")}
          </button>
        </div>

        {naming && (
          <form onSubmit={create} className="panel space-y-3 p-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{t("nameIt")}</span>
              <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("namePlaceholder")} className="input" />
            </label>
            <p className="text-xs text-muted">{t("dateAuto", { date: shortDate(todayISO(), locale) })}</p>
            <div className="flex gap-2">
              <button className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-brand-contrast">{t("create")}</button>
              <button type="button" onClick={() => setNaming(false)} className="rounded-lg px-3 py-1.5 text-sm text-muted hover:text-ink">{t("cancel")}</button>
            </div>
          </form>
        )}

        <ul className="space-y-1.5">
          {sorted.map((d) => <DocRow key={d.id} d={d} active={d.id === openId} onOpen={() => setOpenId(d.id)} locale={locale} />)}
          {!sorted.length && !naming && <li className="panel p-6 text-center text-sm text-muted">{q ? t("noResults") : t("empty")}</li>}
        </ul>

        {shared.filter(match).length > 0 && (
          <div>
            <h3 className="mt-5 mb-2 flex items-center gap-1.5 text-sm font-semibold"><Users size={14} /> {t("sharedWithYou")}</h3>
            <ul className="space-y-1.5">
              {shared.filter(match).map((d) => (
                <DocRow key={d.id} d={d} active={d.id === openId} onOpen={() => setOpenId(d.id)} locale={locale} owner={names[d.owner_id]?.full_name} />
              ))}
            </ul>
          </div>
        )}
      </aside>

      {open ? (
        <Editor key={open.id} doc={open} canEdit={open.owner_id === meId} onCopy={saveCopy} members={members} meId={meId} ownerName={names[open.owner_id]?.full_name}
                onBack={() => setOpenId(null)} onChange={(p) => update(open.id, p)} onDelete={() => remove(open)} />
      ) : (
        <div className="panel hidden place-items-center p-10 text-center lg:grid">
          <div>
            <FileText size={28} className="mx-auto mb-3 text-muted" />
            <p className="font-medium">{t("pickOne")}</p>
            <p className="mt-1 text-sm text-muted">{t("pickOneHint")}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function DocRow({ d, active, onOpen, locale, owner }: { d: Doc; active: boolean; onOpen: () => void; locale: string; owner?: string }) {
  const preview = d.body.replace(/[#*_\-\[\]]/g, "").trim().slice(0, 80);
  return (
    <li>
      <button onClick={onOpen} aria-current={active ? "true" : undefined}
              className={`w-full rounded-[12px] p-3 text-left transition-[background,box-shadow] duration-200 ${
                active ? "bg-surface shadow-[var(--shadow-lift)]" : "hover:bg-surface hover:shadow-[var(--shadow)]"}`}>
        <span className="flex items-center gap-1.5">
          {d.pinned && <Pin size={12} className="shrink-0 text-trail" />}
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{d.title}</span>
          {(d.share_all || d.shared_with.length > 0) && !owner && <Users size={12} className="shrink-0 text-muted" />}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted">
          {shortDate(d.doc_date, locale)}{owner ? ` · ${owner}` : ""}{preview ? ` · ${preview}` : ""}
        </span>
      </button>
    </li>
  );
}

function Editor({ doc, canEdit, members, meId, ownerName, onBack, onChange, onDelete, onCopy }: {
  doc: Doc; canEdit: boolean; members: Member[]; meId: string; ownerName?: string;
  onBack: () => void; onChange: (p: Partial<Doc>) => void; onDelete: () => void; onCopy: (copy: { title: string; body: string }) => void;
}) {
  const t = useTranslations("camp.docs");
  const locale = useLocale();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [title, setTitle] = useState(doc.title);
  const [body, setBody] = useState(doc.body);
  const [preview, setPreview] = useState(!canEdit || doc.body.length > 0);
  const [status, setStatus] = useState<"saved" | "saving" | "error">("saved");
  const [menu, setMenu] = useState<null | "share" | "download">(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function persist(patch: Partial<Doc>) {
    onChange(patch);
    if (!canEdit) return;
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const { error } = await supabase.from("docs").update(patch).eq("id", doc.id);
      setStatus(error ? "error" : "saved");
      if (error) toast("error", t("saveError"));
    }, 700);
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // A recording whose notes couldn't be written: write them again from the saved transcript
  const transcript = useMemo(() => missingNotes(body), [body]);
  const [writing, setWriting] = useState<string | null>(null);
  async function writeSummary() {
    if (!transcript || writing) return;
    setWriting(t("writingSummary"));
    const notes = await writeNotesNow(transcript, (ms) => setWriting(t("summaryWaiting", { s: Math.ceil(ms / 1000) })));
    setWriting(null);
    if (!notes) return toast("error", t("summaryFailed"));
    const next = withNotes(body, notes);
    if (canEdit) { setBody(next); persist({ body: next }); setPreview(true); toast("ok", t("summaryWritten")); }
    else onCopy({ title: `${doc.title} · ${t("summaryTitle")}`, body: next });
  }

  // Grow the writing area with its content, like a document page
  useEffect(() => {
    const el = area.current;
    if (el) { el.style.height = "auto"; el.style.height = `${Math.max(320, el.scrollHeight)}px`; }
  }, [body, preview]);

  function wrap(kind: "h1" | "h2" | "bold" | "list" | "check") {
    const el = area.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const lineStart = body.lastIndexOf("\n", a - 1) + 1;
    let next = body, caret = b;
    if (kind === "bold") { next = `${body.slice(0, a)}**${body.slice(a, b) || t("boldText")}**${body.slice(b)}`; caret = b + 4 + (a === b ? t("boldText").length : 0); }
    else {
      const prefix = { h1: "# ", h2: "## ", list: "- ", check: "- [ ] " }[kind];
      next = body.slice(0, lineStart) + prefix + body.slice(lineStart);
      caret = b + prefix.length;
    }
    setBody(next); persist({ body: next });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(caret, caret); });
  }

  async function download(kind: "word" | "pdf" | "md") {
    setMenu(null);
    const ex = await import("@/lib/doc-export");
    const d = { title, body, doc_date: doc.doc_date };
    if (kind === "word") await ex.downloadWord(d); else if (kind === "pdf") ex.downloadPdf(d); else ex.downloadMarkdown(d);
  }

  const shareLabel = doc.share_all ? t("share.team") : doc.shared_with.length ? t("share.people", { count: doc.shared_with.length }) : t("share.private");
  const tool = "grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink";

  return (
    <article className="panel min-w-0 p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button onClick={onBack} className={`${tool} lg:hidden`} aria-label={t("back")}><ArrowLeft size={17} /></button>
        <span className="text-xs text-muted">
          {canEdit ? (status === "saving" ? t("saving") : status === "error" ? t("notSaved") : t("savedAgo", { when: timeAgo(doc.updated_at, locale) }))
            : t("by", { name: ownerName ?? "—" })}
        </span>
        <span className="ml-auto flex items-center gap-1">
          {canEdit && (
            <button onClick={() => persist({ pinned: !doc.pinned })} className={tool} aria-label={doc.pinned ? t("unpin") : t("pin")} title={doc.pinned ? t("unpin") : t("pin")}>
              {doc.pinned ? <PinOff size={16} /> : <Pin size={16} />}
            </button>
          )}
          <div className="relative">
            <button onClick={() => setMenu(menu === "download" ? null : "download")} className={tool} aria-label={t("download")} title={t("download")}><Download size={16} /></button>
            {menu === "download" && (
              <div className="panel absolute right-0 z-20 mt-1 w-44 p-1 text-sm">
                {(["word", "pdf", "md"] as const).map((k) => (
                  <button key={k} onClick={() => download(k)} className="w-full rounded-lg px-2.5 py-1.5 text-left hover:bg-surface-2">{t(`downloadAs.${k}`)}</button>
                ))}
              </div>
            )}
          </div>
          {canEdit && (
            <div className="relative">
              <button onClick={() => setMenu(menu === "share" ? null : "share")}
                      className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-ink">
                {doc.share_all || doc.shared_with.length ? <Share2 size={15} /> : <Lock size={15} />}
                <span className="hidden sm:inline">{shareLabel}</span>
              </button>
              {menu === "share" && (
                <SharePanel doc={doc} members={members.filter((m) => m.id !== meId)}
                            onChange={(p) => persist(p)} onClose={() => setMenu(null)} />
              )}
            </div>
          )}
          <SaveToNotion kind="doc" id={doc.id} meId={meId} />
          {canEdit && <button onClick={onDelete} className={`${tool} hover:text-bad-text`} aria-label={t("delete")} title={t("delete")}><Trash2 size={16} /></button>}
        </span>
      </div>

      {canEdit ? (
        <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() && title !== doc.title && persist({ title: title.trim() })}
               className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none" aria-label={t("title")} />
      ) : <h2 className="text-2xl font-semibold tracking-tight">{doc.title}</h2>}
      <div className="mt-1 mb-5 flex items-center gap-2 text-sm text-muted">
        {canEdit ? (
          <input type="date" value={doc.doc_date} onChange={(e) => e.target.value && persist({ doc_date: e.target.value })}
                 aria-label={t("date")} className="rounded-md bg-transparent outline-none hover:text-ink" />
        ) : shortDate(doc.doc_date, locale)}
      </div>

      {canEdit && (
        <div className="sticky top-[100px] z-10 -mx-1 mb-3 flex items-center gap-0.5 rounded-xl bg-surface/90 p-1 backdrop-blur-sm">
          {!preview && <>
            <button onClick={() => wrap("h1")} className={tool} aria-label={t("tools.h1")} title={t("tools.h1")}><Heading1 size={16} /></button>
            <button onClick={() => wrap("h2")} className={tool} aria-label={t("tools.h2")} title={t("tools.h2")}><Heading2 size={16} /></button>
            <button onClick={() => wrap("bold")} className={tool} aria-label={t("tools.bold")} title={t("tools.bold")}><Bold size={16} /></button>
            <button onClick={() => wrap("list")} className={tool} aria-label={t("tools.list")} title={t("tools.list")}><List size={16} /></button>
            <button onClick={() => wrap("check")} className={tool} aria-label={t("tools.check")} title={t("tools.check")}><ListChecks size={16} /></button>
          </>}
          <button onClick={() => setPreview((p) => !p)}
                  className="ml-auto flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-ink">
            {preview ? <><PenLine size={15} /> {t("edit")}</> : <><Eye size={15} /> {t("read")}</>}
          </button>
        </div>
      )}

      {transcript && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-brand/10 p-3.5 ring-1 ring-brand/30">
          <p className="min-w-0 flex-1 text-sm">{canEdit ? t("summaryMissing") : t("summaryMissingShared")}</p>
          <button onClick={writeSummary} disabled={!!writing} className="flex min-h-10 items-center gap-2 rounded-full bg-brand px-4 text-sm font-semibold text-white disabled:opacity-70">
            {writing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {writing ?? t("writeSummary")}
          </button>
        </div>
      )}

      {canEdit && (doc.audio_parts ?? 0) > 0 && <AudioPlayer ownerId={doc.owner_id} docId={doc.id} createdAt={doc.created_at} docTitle={doc.title} />}

      {preview ? (
        body.trim() ? (
          <div className="doc-body" onDoubleClick={() => canEdit && setPreview(false)} dangerouslySetInnerHTML={{ __html: mdToHtml(body) }} />
        ) : <button onClick={() => setPreview(false)} className="w-full py-10 text-center text-sm text-muted">{t("startWriting")}</button>
      ) : (
        <textarea ref={area} autoFocus value={body} onChange={(e) => { setBody(e.target.value); persist({ body: e.target.value }); }}
                  placeholder={t("bodyPlaceholder")} spellCheck
                  className="w-full resize-none bg-transparent text-[15px] leading-7 outline-none placeholder:text-muted/70" />
      )}
    </article>
  );
}

function SharePanel({ doc, members, onChange, onClose }: { doc: Doc; members: Member[]; onChange: (p: Partial<Doc>) => void; onClose: () => void }) {
  const t = useTranslations("camp.docs");
  const mode = doc.share_all ? "team" : doc.shared_with.length ? "people" : "private";
  const [picking, setPicking] = useState(mode === "people");
  return (
    <div className="panel absolute right-0 z-20 mt-1 w-72 p-3 text-sm" onMouseLeave={onClose}>
      <p className="mb-2 font-semibold">{t("share.title")}</p>
      {(["private", "team", "people"] as const).map((m) => (
        <label key={m} className="flex cursor-pointer items-start gap-2 rounded-lg p-1.5 hover:bg-surface-2">
          <input type="radio" name={`share-${doc.id}`} checked={m === "people" ? picking && !doc.share_all : mode === m && !(m === "private" && picking)}
                 onChange={() => {
                   if (m === "private") { setPicking(false); onChange({ share_all: false, shared_with: [] }); }
                   if (m === "team") { setPicking(false); onChange({ share_all: true, shared_with: [] }); }
                   if (m === "people") { setPicking(true); onChange({ share_all: false }); }
                 }} className="mt-0.5" />
          <span><span className="block">{t(`share.${m}Option`)}</span><span className="block text-xs text-muted">{t(`share.${m}Hint`)}</span></span>
        </label>
      ))}
      {picking && !doc.share_all && (
        <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto border-t border-line pt-2">
          {members.map((m) => {
            const on = doc.shared_with.includes(m.id);
            return (
              <li key={m.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg p-1.5 hover:bg-surface-2">
                  <input type="checkbox" checked={on}
                         onChange={() => onChange({ shared_with: on ? doc.shared_with.filter((x) => x !== m.id) : [...doc.shared_with, m.id] })} />
                  <Avatar name={m.full_name} src={m.avatar_url} size={20} /> {m.full_name}
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted">{t("share.readOnlyNote")}</p>
    </div>
  );
}
