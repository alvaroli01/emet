"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Mic, Square, Loader2, X, KeyRound, ExternalLink, Check, AlertTriangle, Unplug } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { shortDate, todayISO } from "@/lib/format";
import type { Doc } from "./docs";

const CHUNK_MS = 30_000; // text appears every 30 s; each chunk is a standalone file
type Lang = "auto" | "es" | "en";
type Chunk = { index: number; state: "waiting" | "sending" | "done" | "limit" | "error"; text: string };
type Phase = "setup" | "recording" | "finishing";

/* ── Tiny IndexedDB store: audio chunks stay on this device until their text is safely back ── */
const DB = "emet-recorder", STORE = "chunks";
function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbPut(key: string, blob: Blob) { const d = await idb(); d.transaction(STORE, "readwrite").objectStore(STORE).put(blob, key); }
async function idbDel(key: string) { const d = await idb(); d.transaction(STORE, "readwrite").objectStore(STORE).delete(key); }

type Recognition = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null; onend: (() => void) | null };

const res0 = (e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string } }> }) => e.results[e.results.length - 1]?.[0]?.transcript ?? "";

/** Records a class or meeting and turns it into a named, dated doc: notes on top, full transcript below. */
/** Where a recording goes. Default: a private doc in Base camp. The Meeting log passes its own. */
export type Destination = {
  bucket: "recordings" | "meetings";
  title: string;
  kinds?: { value: string; label: string }[];
  /** Called when recording starts: creates the record and returns the audio folder */
  prepare: (a: { name: string; kind?: string }) => Promise<{ id: string; folder: string } | null>;
  save: (a: { id: string; name: string; kind?: string; notes: string; transcript: string; minutes: number; audioParts: number }) => Promise<boolean>;
};

export function Recorder({ connected: initiallyConnected, last4: initialLast4, onClose, onCreated, destination }: {
  connected: boolean; last4: string | null; onClose: () => void; onCreated: (doc: Doc) => void; destination?: Destination;
}) {
  const t = useTranslations("camp.recorder");
  const locale = useLocale();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [connected, setConnected] = useState(initiallyConnected);
  const [last4, setLast4] = useState(initialLast4);
  const [keyInput, setKeyInput] = useState("");
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyError, setKeyError] = useState("");
  const [mode, setMode] = useState<"groq" | "browser">(initiallyConnected ? "groq" : "browser");
  const [name, setName] = useState(() => `${t("defaultName")} ${new Date().toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`);
  const [lang, setLang] = useState<Lang>("auto");
  const [phase, setPhase] = useState<Phase>("setup");
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [live, setLive] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState<number[]>(Array(28).fill(0));
  const [waitUntil, setWaitUntil] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const queue = useRef<{ index: number; blob: Blob }[]>([]);
  const working = useRef(false);
  const stopping = useRef(false);
  const session = useRef(crypto.randomUUID());
  const texts = useRef<string[]>([]);
  const browserText = useRef("");
  const raf = useRef(0);
  const startedAt = useRef(0);
  const segPeak = useRef(0);
  const owner = useRef<string | null>(null);
  const folder = useRef<string | null>(null);
  const bucket = destination?.bucket ?? "recordings";
  const [kind, setKind] = useState(destination?.kinds?.[0]?.value);
  const uploads = useRef<Promise<boolean>[]>([]);
  const finished = useRef(false);

  const browserSupported = typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

  useEffect(() => () => cleanup(), []);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [chunks, live, preview]);
  useEffect(() => {
    if (phase !== "recording") return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  function cleanup() {
    cancelAnimationFrame(raf.current);
    recognition.current?.stop();
    recognition.current = null;
    stream.current?.getTracks().forEach((tr) => tr.stop());
  }

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setKeyBusy(true); setKeyError("");
    const res = await fetch("/api/ai-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: keyInput }) });
    const data = await res.json().catch(() => ({}));
    setKeyBusy(false);
    if (!res.ok) return setKeyError(t(`keyErrors.${data.error === "format" ? "format" : data.error === "rejected" ? "rejected" : "save"}`));
    setConnected(true); setLast4(data.last4); setKeyInput(""); setMode("groq");
  }

  async function disconnect() {
    if (!confirm(t("confirmDisconnect"))) return;
    await fetch("/api/ai-key", { method: "DELETE" });
    setConnected(false); setLast4(null); setMode("browser");
  }

  /* ── Recording ── */
  async function start() {
    if (!name.trim()) return;
    try {
      // Tuned for a room: the browser cleans background noise and lifts quiet voices
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
    } catch {
      return toast("error", t("micDenied"));
    }
    const { data: me } = await supabase.rpc("my_profile_id");
    owner.current = (me as string | null) ?? null;
    if (destination) {
      const made = await destination.prepare({ name: name.trim(), kind });
      if (!made) { stream.current.getTracks().forEach((tr) => tr.stop()); return toast("error", t("saveError")); }
      session.current = made.id;
      folder.current = made.folder;
    } else folder.current = owner.current ? `${owner.current}/${session.current}` : null;
    meter(stream.current);
    startedAt.current = Date.now();
    setPhase("recording");
    if (mode === "groq") {
      nextSegment(0);
      // A live preview from the browser fills the gap until each accurate chunk arrives (skipped on iOS)
      if (browserSupported && !/iPhone|iPad|iPod/.test(navigator.userAgent)) listen(true);
    } else listen();
  }

  function meter(s: MediaStream) {
    const ctx = new AudioContext();
    const an = ctx.createAnalyser();
    an.fftSize = 64;
    ctx.createMediaStreamSource(s).connect(an);
    const buf = new Uint8Array(an.frequencyBinCount);
    const draw = () => {
      an.getByteFrequencyData(buf);
      const bars = Array.from({ length: 28 }, (_, i) => buf[Math.min(buf.length - 1, i + 1)] / 255);
      segPeak.current = Math.max(segPeak.current, bars.reduce((a, b) => a + b, 0) / bars.length);
      setLevel(bars);
      raf.current = requestAnimationFrame(draw);
    };
    draw();
  }

  // A fresh MediaRecorder per minute gives standalone audio files the transcriber can read on their own
  function nextSegment(index: number) {
    if (!stream.current) return;
    const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    const rec = new MediaRecorder(stream.current, { mimeType: type || undefined, audioBitsPerSecond: 24_000 });
    const parts: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
    segPeak.current = 0;
    rec.onstop = () => {
      const blob = new Blob(parts, { type: rec.mimeType });
      if (blob.size > 2000) {
        keepAudio(index, blob);
        // A silent minute (break, pause) is stored but not transcribed: nothing to hear, and it saves free minutes
        if (segPeak.current > 0.015) enqueue(index, blob);
      }
      if (!stopping.current) nextSegment(index + 1);
    };
    rec.start();
    recorder.current = rec;
    setTimeout(() => { if (rec.state === "recording") rec.stop(); }, CHUNK_MS);
  }

  // Every minute of audio goes to the owner's private storage folder (retried a few times on a bad connection)
  function keepAudio(index: number, blob: Blob) {
    if (!folder.current) return;
    const ext = blob.type.includes("mp4") ? "m4a" : "webm";
    const path = `${folder.current}/chunk-${String(index).padStart(3, "0")}.${ext}`;
    uploads.current.push((async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: blob.type.split(";")[0], upsert: true });
        if (!error) return true;
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
      return false;
    })());
  }

  function enqueue(index: number, blob: Blob) {
    idbPut(`${session.current}:${index}`, blob).catch(() => {});
    setChunks((c) => [...c, { index, state: "waiting", text: "" }]);
    queue.current.push({ index, blob });
    pump();
  }

  const mark = (index: number, p: Partial<Chunk>) => setChunks((c) => c.map((x) => (x.index === index ? { ...x, ...p } : x)));

  // Sends chunks one at a time, in order. On the free-tier limit it waits and tries again — nothing is dropped.
  async function pump() {
    if (working.current) return;
    working.current = true;
    while (queue.current.length) {
      const { index, blob } = queue.current[0];
      mark(index, { state: "sending" });
      const form = new FormData();
      form.append("audio", blob, `chunk-${index}.${blob.type.includes("mp4") ? "m4a" : "webm"}`);
      form.append("name", `chunk-${index}.${blob.type.includes("mp4") ? "m4a" : "webm"}`);
      form.append("language", lang === "auto" ? "" : lang);
      form.append("prompt", texts.current.filter(Boolean).slice(-1)[0] ?? "");
      const res = await fetch("/api/transcribe", { method: "POST", body: form }).catch(() => null);
      const data = res ? await res.json().catch(() => ({})) : {};
      if (res?.ok) {
        texts.current[index] = data.text ?? "";
        mark(index, { state: "done", text: data.text ?? "" });
        setPreview("");
        queue.current.shift();
        idbDel(`${session.current}:${index}`).catch(() => {});
        setWaitUntil(null);
        continue;
      }
      if (data.error === "bad-key" || data.error === "no-key") {
        mark(index, { state: "error" });
        setConnected(false);
        toast("error", t("keyStopped"));
        break;
      }
      const wait = data.error === "limit" ? (data.retryAfter ?? 60) : 15;
      mark(index, { state: data.error === "limit" ? "limit" : "error" });
      setWaitUntil(Date.now() + wait * 1000);
      await new Promise((r) => setTimeout(r, wait * 1000));
    }
    working.current = false;
    if (stopping.current && !queue.current.length) finish();
  }

  function listen(previewOnly = false) {
    const W = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = lang === "en" ? "en-US" : lang === "es" ? "es-ES" : locale.startsWith("en") ? "en-US" : "es-ES";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) browserText.current += res[0].transcript.trim() + " ";
        else interim += res[0].transcript;
      }
      if (previewOnly) setPreview(interim || res0(e));
      else setLive(browserText.current + interim);
    };
    r.onend = () => { if (!stopping.current) try { r.start(); } catch { /* already running */ } };
    (r as unknown as { onerror: (() => void) | null }).onerror = () => { if (previewOnly) setPreview(""); };
    r.start();
    recognition.current = r;
  }

  function stop() {
    stopping.current = true;
    setPhase("finishing");
    cancelAnimationFrame(raf.current);
    if (mode === "groq") {
      if (recorder.current?.state === "recording") recorder.current.stop();
      setTimeout(() => { if (!working.current && !queue.current.length) finish(); }, 400);
    } else {
      recognition.current?.stop();
      setTimeout(finish, 600);
    }
  }

  async function finish() {
    if (finished.current) return;
    finished.current = true;
    stream.current?.getTracks().forEach((tr) => tr.stop());
    setStatus(t("savingAudio"));
    const saved = (await Promise.all(uploads.current)).filter(Boolean).length;
    if (saved < uploads.current.length) toast("error", t("audioPartial"));
    const transcript = (mode === "groq" ? texts.current.filter(Boolean).join("\n\n") : browserText.current).trim();
    let notes = "";
    if (transcript && mode === "groq") {
      setStatus(t("writingNotes"));
      for (let attempt = 0; attempt < 4 && !notes; attempt++) {
        const res = await fetch("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transcript }) });
        const data = await res.json().catch(() => ({}));
        if (res.ok) notes = data.markdown ?? "";
        else if (data.error === "limit") { setWaitUntil(Date.now() + (data.retryAfter ?? 60) * 1000); await new Promise((r) => setTimeout(r, (data.retryAfter ?? 60) * 1000)); }
        else break;
      }
    }
    const mins = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));
    if (destination) {
      const ok = await destination.save({ id: session.current, name: name.trim(), kind, notes: notes || (transcript ? "" : `_${t("nothingHeard")}_`),
        transcript, minutes: mins, audioParts: saved });
      if (!ok) { finished.current = false; toast("error", t("saveError")); setStatus(""); return; }
      toast("ok", t("savedMeeting"));
      onCreated({ id: session.current } as Doc);
      return;
    }
    const body = [
      notes || (transcript ? `_${t("noNotes")}_` : `_${t("nothingHeard")}_`),
      transcript ? `\n## ${t("transcriptHeading")}\n\n${transcript}` : "",
      `\n_${t("recordedMeta", { minutes: mins, engine: mode === "groq" ? "Groq Whisper" : t("browserEngine") })}_`,
    ].join("\n");
    const now = new Date().toISOString();
    const doc: Doc = { id: session.current, owner_id: "", title: name.trim(), body, kind: "meeting", pinned: false, tags: [],
      share_all: false, shared_with: [], doc_date: todayISO(), created_at: now, updated_at: now, audio_parts: saved };
    const { data: row, error } = await supabase.from("docs")
      .insert({ id: doc.id, title: doc.title, body, kind: "meeting", doc_date: doc.doc_date, audio_parts: saved }).select("owner_id").single();
    if (error) { finished.current = false; toast("error", t("saveError")); setStatus(""); return; }
    toast("ok", t("saved"));
    onCreated({ ...doc, owner_id: row.owner_id });
  }

  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const pending = chunks.filter((c) => c.state !== "done").length;
  const transcriptSoFar = mode === "groq" ? chunks.filter((c) => c.text).map((c) => c.text).join(" ") : live;

  if (phase !== "setup") return (
    // While recording: a small floating box, so the rest of the dashboard stays usable
    <section role="region" aria-label={t("title")} aria-live="polite"
             className="fixed right-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 w-[min(380px,calc(100vw-1.5rem))] rounded-2xl bg-surface p-4 shadow-[0_24px_60px_-16px_rgb(0_0_0/0.45),0_2px_6px_rgb(0_0_0/0.12)] ring-1 ring-line lg:right-6 lg:bottom-6">
      <div className="flex items-center gap-3">
        <span className="relative grid size-10 shrink-0 place-items-center">
          {phase === "recording" && <span className="absolute inset-0 animate-ping rounded-full bg-trail/30 motion-reduce:animate-none" />}
          <span className={`relative grid size-10 place-items-center rounded-full ${phase === "recording" ? "bg-trail text-white" : "bg-surface-2 text-muted"}`}>
            {phase === "recording" ? <Mic size={17} /> : <Loader2 size={17} className="animate-spin" />}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="readout text-xl leading-none">{clock}</p>
          <p className="mt-0.5 truncate text-xs text-muted">{name}</p>
        </div>
        {phase === "recording" && (
          <button onClick={stop} className="flex h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-contrast active:scale-95">
            <Square size={13} fill="currentColor" /> {t("stop")}
          </button>
        )}
      </div>

      <div aria-hidden className="mt-3 flex h-7 items-end gap-[3px]">
        {level.map((v, i) => (
          <span key={i} className="flex-1 rounded-full bg-trail/80 transition-[height] duration-75"
                style={{ height: `${Math.max(8, (phase === "recording" ? v : 0) * 100)}%`, opacity: 0.35 + v * 0.65 }} />
        ))}
      </div>

      <div ref={scroller} className="mt-3 max-h-36 overflow-y-auto rounded-xl bg-surface-2/60 p-3 text-sm leading-relaxed">
        {transcriptSoFar
          ? <>{transcriptSoFar}{preview && <span className="text-muted"> {preview}</span>}</>
          : preview ? <span className="text-muted">{preview}</span>
          : <span className="text-muted">{mode === "groq" ? t("firstMinute") : t("listening")}</span>}
      </div>

      {mode === "groq" && chunks.length > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-muted">
          {chunks.slice(-12).map((c) => (
            <span key={c.index} title={t(`chunk.${c.state}`)}
                  className={`size-2 rounded-full ${c.state === "done" ? "bg-ok" : c.state === "sending" ? "animate-pulse bg-climbed" : c.state === "limit" ? "bg-warn" : c.state === "error" ? "bg-bad" : "bg-line"}`} />
          ))}
          <span className="ml-1">{pending ? t("pendingChunks", { count: pending }) : t("allTranscribed")}</span>
        </p>
      )}
      {waitUntil && (
        <p className="mt-2 flex items-start gap-1.5 text-xs">
          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-warn-text" />
          {t("limitWait", { minutes: Math.max(1, Math.ceil((waitUntil - Date.now()) / 60000)) })}
        </p>
      )}
      {phase === "finishing" && <p className="mt-2 flex items-center gap-1.5 text-xs text-muted"><Loader2 size={12} className="animate-spin" /> {status || t("finishing")}</p>}
    </section>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={t("title")}>
      <button className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-label={t("close")} onClick={onClose} />
      <div className="relative max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{destination?.title ?? t("title")}</h2>
            <p className="text-sm text-muted">{destination ? t("subtitleMeeting") : t("subtitle")}</p>
          </div>
          <button onClick={onClose} aria-label={t("close")} className="rounded-lg p-1.5 text-muted hover:bg-surface-2"><X size={18} /></button>
        </div>
          <div className="space-y-4 sm:space-y-5">
            {/* Engine: your own Groq account (best), or the browser */}
            <section className="rounded-2xl bg-surface-2/60 p-4">
              {connected ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="grid size-7 place-items-center rounded-full bg-ok text-white"><Check size={14} /></span>
                  <span className="flex-1"><span className="font-medium">{t("connected")}</span> <span className="text-muted">· ••••{last4}</span></span>
                  <button onClick={disconnect} className="flex items-center gap-1 text-xs text-muted hover:text-bad-text"><Unplug size={13} /> {t("disconnect")}</button>
                </div>
              ) : (
                <form onSubmit={connect} className="space-y-3">
                  <p className="flex items-center gap-2 font-medium"><KeyRound size={16} /> {t("connectTitle")}</p>
                  <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
                    <li>{t("step1")} <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-climbed underline underline-offset-2">console.groq.com/keys <ExternalLink size={11} /></a></li>
                    <li>{t("step2")}</li>
                    <li>{t("step3")}</li>
                  </ol>
                  <div className="flex gap-2">
                    <input type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="gsk_…" autoComplete="off" aria-label={t("keyLabel")} className="input" />
                    <button disabled={keyBusy || !keyInput} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-brand px-3 text-sm font-medium text-brand-contrast disabled:opacity-60">
                      {keyBusy && <Loader2 size={14} className="animate-spin" />}{t("connect")}
                    </button>
                  </div>
                  {keyError && <p role="alert" className="text-sm text-bad-text">{keyError}</p>}
                  <p className="text-xs text-muted">{t("keyPrivacy")}</p>
                </form>
              )}
            </section>

            {!connected && (
              <p className="text-sm text-muted">{browserSupported ? t("browserFallback") : t("browserUnsupported")}</p>
            )}

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{t("nameLabel")}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} onFocus={(e) => e.target.select()} placeholder={t("namePlaceholder")} className="input" />
              <span className="mt-1 block text-xs text-muted">{t("dateAuto", { date: shortDate(todayISO(), locale) })}</span>
            </label>

            {destination?.kinds && (
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">{t("meetingType")}</legend>
                <div className="grid grid-cols-2 gap-1.5 text-sm">
                  {destination.kinds.map((k) => (
                    <button key={k.value} type="button" onClick={() => setKind(k.value)} aria-pressed={kind === k.value}
                            className={`rounded-xl px-3 py-2 text-left transition ${kind === k.value ? "bg-brand font-medium text-brand-contrast" : "bg-surface-2 text-muted hover:text-ink"}`}>
                      {k.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">{t("language")}</legend>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1 text-sm">
                {(["auto", "es", "en"] as const).map((l) => (
                  <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l}
                          className={`rounded-lg py-1.5 transition ${lang === l ? "bg-surface font-medium shadow-sm" : "text-muted hover:text-ink"}`}>{t(`lang.${l}`)}</button>
                ))}
              </div>
              {lang === "auto" && mode === "browser" && <p className="mt-1 text-xs text-muted">{t("autoBrowserNote")}</p>}
            </fieldset>

            <div className="sticky -bottom-5 -mx-5 bg-surface px-5 pt-2 pb-1 sm:static sm:mx-0 sm:p-0">
              <button onClick={start} disabled={!name.trim() || (!connected && !browserSupported)}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-trail py-3.5 text-base font-semibold text-white shadow-[var(--shadow-lift)] transition hover:brightness-105 disabled:opacity-50">
                <Mic size={19} /> {t("start")}
              </button>
              <p className="mt-2 text-center text-xs text-muted">{t("micTip")}</p>
            </div>
          </div>
      </div>
    </div>
  );
}
