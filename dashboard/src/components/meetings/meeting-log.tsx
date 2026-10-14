"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Mic, Search, GraduationCap, Phone, Video, Crown, ArrowLeft, Download, Trash2, Loader2, ChevronDown, Lock, AudioLines } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { mdToHtml } from "@/lib/markdown";
import { longDate } from "@/lib/format";
import { Recorder, type Destination } from "@/components/camp/recorder";
import { AudioPlayer } from "@/components/camp/audio-player";

export type MeetingRow = {
  id: string; title: string; kind: Kind; meeting_date: string; status: "recording" | "ready";
  minutes: number; audio_parts: number; created_by: string | null; created_at: string;
};
type Kind = "training" | "phone" | "video" | "leaders";
const KINDS: Kind[] = ["training", "phone", "video", "leaders"];
const ICON = { training: GraduationCap, phone: Phone, video: Video, leaders: Crown } as const;
const TINT: Record<Kind, string> = { training: "#2f7d4f", phone: "#2b6ca3", video: "#5b4ba8", leaders: "#b7791f" };
const FREE_BYTES = 1024 ** 3;

export function MeetingLog({ meetings, names, meId, isLeader, ai, storageBytes, initialOpen, title }: {
  meetings: MeetingRow[]; names: Record<string, string>; meId: string; isLeader: boolean;
  ai: { connected: boolean; last4: string | null }; storageBytes: number | null; initialOpen?: string; title: string;
}) {
  const t = useTranslations("meetings");
  const locale = useLocale();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [filter, setFilter] = useState<Kind | "all">("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(initialOpen ?? null);
  const [recording, setRecording] = useState(false);

  const kinds = KINDS.filter((k) => k !== "leaders" || isLeader);
  const q = query.trim().toLowerCase();
  const shown = meetings.filter((m) => (filter === "all" || m.kind === filter) && (!q || m.title.toLowerCase().includes(q)));
  const open = meetings.find((m) => m.id === openId) ?? null;

  // Group by month, newest first
  const groups = useMemo(() => {
    const out: { label: string; items: MeetingRow[] }[] = [];
    for (const m of shown) {
      const label = new Date(m.meeting_date + "T12:00:00Z").toLocaleDateString(locale, { month: "long", year: "numeric", timeZone: "UTC" });
      const g = out.at(-1);
      if (g?.label === label) g.items.push(m); else out.push({ label, items: [m] });
    }
    return out;
  }, [shown, locale]);

  const destination: Destination = {
    bucket: "meetings",
    title: t("recordTitle"),
    kinds: kinds.map((k) => ({ value: k, label: t(`kindOne.${k}`) })),
    prepare: async ({ name, kind }) => {
      const { data, error } = await supabase.from("meetings").insert({ title: name, kind: kind ?? "training" }).select("id").single();
      return error || !data ? null : { id: data.id, folder: data.id };
    },
    save: async ({ id, notes, transcript, minutes, audioParts }) => {
      const { error } = await supabase.from("meetings").update({ notes, transcript, minutes, audio_parts: audioParts, status: "ready" }).eq("id", id);
      return !error;
    },
  };

  return (
    <>
      {recording && createPortal(
        <Recorder connected={ai.connected} last4={ai.last4} destination={destination} onClose={() => setRecording(false)}
                  onCreated={(d) => { setRecording(false); setOpenId(d.id); router.refresh(); }} />,
        document.body,
      )}

      <section className="panel contours contours-corner flex flex-wrap items-end justify-between gap-4 p-5 sm:p-6">
        <div className="max-w-xl">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
        </div>
        <button onClick={() => setRecording(true)}
                className="flex items-center gap-2 rounded-2xl bg-trail px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-lift)] transition hover:brightness-105 active:scale-[0.98]">
          <Mic size={18} /> {t("record")}
        </button>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className={`space-y-3 ${open ? "hidden lg:block" : ""}`}>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {(["all", ...kinds] as const).map((k) => {
              const n = k === "all" ? meetings.length : meetings.filter((m) => m.kind === k).length;
              const Icon = k === "all" ? AudioLines : ICON[k];
              return (
                <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k}
                        className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${
                          filter === k ? "bg-ink text-brand-contrast" : "bg-surface text-muted shadow-[var(--shadow)] hover:text-ink"}`}>
                  <Icon size={14} /> {k === "all" ? t("all") : t(`kinds.${k}`)} <span className="tabular-nums opacity-70">{n}</span>
                </button>
              );
            })}
          </div>
          <label className="relative block">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} className="input pl-9" />
          </label>

          {groups.length ? groups.map((g) => (
            <section key={g.label}>
              <h2 className="mt-4 mb-2 text-sm font-semibold first-letter:uppercase">{g.label}</h2>
              <ul className="space-y-1.5">
                {g.items.map((m) => <Row key={m.id} m={m} by={m.created_by ? names[m.created_by] : undefined} active={m.id === openId} onOpen={() => setOpenId(m.id)} />)}
              </ul>
            </section>
          )) : (
            <div className="panel p-8 text-center">
              <AudioLines size={26} className="mx-auto mb-2 text-muted" />
              <p className="font-medium">{meetings.length ? t("noResults") : t("empty")}</p>
              {!meetings.length && <p className="mt-1 text-sm text-muted">{t("emptyHint")}</p>}
            </div>
          )}

          {storageBytes !== null && (
            <div className="pt-3 text-xs text-muted">
              <div className="mb-1 flex justify-between"><span>{t("storage")}</span>
                <span className="tabular-nums">{t("storageUsed", { used: (storageBytes / 1024 ** 2).toFixed(0), total: "1 GB" })}</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className={`h-full rounded-full ${storageBytes > FREE_BYTES * 0.8 ? "bg-bad" : storageBytes > FREE_BYTES * 0.6 ? "bg-warn" : "bg-climbed"}`}
                     style={{ width: `${Math.min(100, (storageBytes / FREE_BYTES) * 100)}%` }} />
              </div>
            </div>
          )}
        </div>

        {open ? (
          <Detail key={open.id} m={open} by={open.created_by ? names[open.created_by] : undefined}
                  canManage={open.created_by === meId || isLeader} onBack={() => setOpenId(null)}
                  onDeleted={() => { setOpenId(null); router.refresh(); }} />
        ) : (
          <div className="panel hidden place-items-center p-10 text-center lg:grid">
            <div>
              <AudioLines size={28} className="mx-auto mb-3 text-muted" />
              <p className="font-medium">{t("pick")}</p>
              <p className="mt-1 text-sm text-muted">{t("pickHint")}</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Row({ m, by, active, onOpen }: { m: MeetingRow; by?: string; active: boolean; onOpen: () => void }) {
  const t = useTranslations("meetings");
  const locale = useLocale();
  const Icon = ICON[m.kind];
  const d = new Date(m.meeting_date + "T12:00:00Z");
  const stale = m.status === "recording" && Date.now() - Date.parse(m.created_at) > 4 * 3600e3;
  return (
    <li>
      <button onClick={onOpen} aria-current={active ? "true" : undefined}
              className={`flex w-full items-center gap-3 rounded-[12px] p-2.5 text-left transition-[background,box-shadow] duration-200 ${
                active ? "bg-surface shadow-[var(--shadow-lift)]" : "hover:bg-surface hover:shadow-[var(--shadow)]"}`}>
        <span className="grid w-11 shrink-0 text-center leading-none">
          <span className="readout text-lg">{d.toLocaleDateString(locale, { day: "numeric", timeZone: "UTC" })}</span>
          <span className="mt-0.5 text-[10px] text-muted uppercase">{d.toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" })}</span>
        </span>
        <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={{ background: `color-mix(in srgb, ${TINT[m.kind]} 16%, transparent)`, color: TINT[m.kind] }}>
          <Icon size={15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{m.title}</span>
            {m.kind === "leaders" && <Lock size={11} className="shrink-0 text-muted" />}
          </span>
          <span className="block truncate text-xs text-muted">
            {m.status === "recording"
              ? (stale ? t("unfinished") : <span className="inline-flex items-center gap-1 text-trail"><span className="size-1.5 animate-pulse rounded-full bg-trail" /> {t("live")}</span>)
              : <>{by ?? "—"} · {t("minutes", { count: m.minutes })}</>}
          </span>
        </span>
      </button>
    </li>
  );
}

function Detail({ m, by, canManage, onBack, onDeleted }: { m: MeetingRow; by?: string; canManage: boolean; onBack: () => void; onDeleted: () => void }) {
  const t = useTranslations("meetings");
  const tr = useTranslations("camp.recorder");
  const locale = useLocale();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [full, setFull] = useState<{ notes: string; transcript: string } | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [menu, setMenu] = useState(false);
  const Icon = ICON[m.kind];

  useEffect(() => {
    supabase.from("meetings").select("notes, transcript").eq("id", m.id).single()
      .then(({ data }) => setFull(data ?? { notes: "", transcript: "" }));
  }, [m.id, m.status, supabase]);

  async function download(kind: "word" | "pdf" | "md") {
    setMenu(false);
    if (!full) return;
    const ex = await import("@/lib/doc-export");
    const body = [full.notes, full.transcript ? `\n## ${tr("transcriptHeading")}\n\n${full.transcript}` : ""].join("\n");
    const d = { title: m.title, body, doc_date: m.meeting_date };
    if (kind === "word") await ex.downloadWord(d); else if (kind === "pdf") ex.downloadPdf(d); else ex.downloadMarkdown(d);
  }

  async function remove() {
    if (!confirm(t("confirmDelete", { title: m.title }))) return;
    const { data: files } = await supabase.storage.from("meetings").list(m.id);
    if (files?.length) await supabase.storage.from("meetings").remove(files.map((f) => `${m.id}/${f.name}`));
    const { error } = await supabase.from("meetings").delete().eq("id", m.id);
    if (error) return toast("error", t("deleteError"));
    toast("ok", t("deleted"));
    onDeleted();
  }

  const tool = "grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink";
  return (
    <article className="panel min-w-0 p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <button onClick={onBack} className={`${tool} lg:hidden`} aria-label={t("back")}><ArrowLeft size={17} /></button>
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ background: `color-mix(in srgb, ${TINT[m.kind]} 14%, transparent)`, color: TINT[m.kind] }}>
          <Icon size={13} /> {t(`kindOne.${m.kind}`)}
        </span>
        <span className="ml-auto flex items-center gap-1">
          <div className="relative">
            <button onClick={() => setMenu(!menu)} className={tool} aria-label={t("download")} title={t("download")}><Download size={16} /></button>
            {menu && (
              <div className="panel absolute right-0 z-20 mt-1 w-44 p-1 text-sm">
                {(["word", "pdf", "md"] as const).map((k) => (
                  <button key={k} onClick={() => download(k)} className="w-full rounded-lg px-2.5 py-1.5 text-left hover:bg-surface-2">{t(`downloadAs.${k}`)}</button>
                ))}
              </div>
            )}
          </div>
          {canManage && <button onClick={remove} className={`${tool} hover:text-bad-text`} aria-label={t("delete")} title={t("delete")}><Trash2 size={16} /></button>}
        </span>
      </div>

      <h2 className="text-2xl font-semibold tracking-tight text-balance">{m.title}</h2>
      <p className="mt-1 mb-5 text-sm text-muted">{longDate(m.meeting_date, locale)} · {by ?? "—"}{m.minutes ? ` · ${t("minutes", { count: m.minutes })}` : ""}</p>

      {m.audio_parts > 0 && <AudioPlayer ownerId="" docId={m.id} createdAt={m.created_at} bucket="meetings" folder={m.id} keepForever />}

      {m.status === "recording" ? (
        <p className="flex items-center gap-2 py-8 text-sm text-muted"><Loader2 size={15} className="animate-spin" /> {t("stillRecording")}</p>
      ) : !full ? (
        <div className="space-y-2 py-4" aria-busy="true">{[80, 95, 60].map((w) => <div key={w} className="h-3 animate-pulse rounded bg-surface-2" style={{ width: `${w}%` }} />)}</div>
      ) : (
        <>
          {full.notes.trim()
            ? <div className="doc-body" dangerouslySetInnerHTML={{ __html: mdToHtml(full.notes) }} />
            : <p className="text-sm text-muted">{t("noNotes")}</p>}
          {full.transcript && (
            <div className="mt-6 border-t border-line pt-4">
              <button onClick={() => setShowTranscript((v) => !v)} className="flex items-center gap-1.5 text-sm font-semibold" aria-expanded={showTranscript}>
                <ChevronDown size={16} className={`transition-transform ${showTranscript ? "rotate-180" : ""}`} /> {t("transcript")}
              </button>
              {showTranscript && <p className="mt-3 max-w-[70ch] text-[15px] leading-7 whitespace-pre-wrap">{full.transcript}</p>}
            </div>
          )}
        </>
      )}
    </article>
  );
}
