"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { shortDate } from "@/lib/format";
import { Play, Pause, Download, Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import { createClient } from "@/lib/supabase/client";

/** Plays a recording back from the owner's private storage, minute by minute, as one continuous track. */
export function AudioPlayer({ ownerId, docId, createdAt, bucket = "recordings", folder: folderProp, keepForever = false, docTitle }: {
  ownerId: string; docId: string; createdAt: string; bucket?: "recordings" | "meetings"; folder?: string; keepForever?: boolean;
  /** Set on Base camp docs: shows "Redo transcript", which re-reads the saved audio into a new doc */
  docTitle?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [redo, setRedo] = useState<{ done: number; total: number; wait?: boolean } | null>(null);
  const t = useTranslations("camp.recorder");
  const supabase = useMemo(() => createClient(), []);
  const [urls, setUrls] = useState<string[] | null>(null);
  const [part, setPart] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const locale = useLocale();
  const keptUntil = shortDate(new Date(Date.parse(createdAt) + 60 * 864e5), locale);

  useEffect(() => {
    (async () => {
      if (bucket === "meetings") {
        const res = await fetch(`/api/meetings/${docId}/audio`).catch(() => null);
        const data = res?.ok ? ((await res.json()) as { parts: { url: string }[] }) : { parts: [] };
        return setUrls(data.parts.map((p) => p.url));
      }
      const folder = folderProp ?? `${ownerId}/${docId}`;
      const { data } = await supabase.storage.from(bucket).list(folder, { sortBy: { column: "name", order: "asc" } });
      const names = (data ?? []).map((f) => `${folder}/${f.name}`);
      if (!names.length) return setUrls([]);
      const { data: signed } = await supabase.storage.from(bucket).createSignedUrls(names, 60 * 60 * 6);
      setUrls((signed ?? []).map((s) => s.signedUrl).filter(Boolean) as string[]);
    })();
  }, [ownerId, docId, supabase, bucket, folderProp]);

  // Sends every saved half-minute of audio through the transcriber again, in order, and saves the result as a new doc
  async function redoTranscript() {
    if (!urls?.length || redo) return;
    const texts: string[] = [];
    setRedo({ done: 0, total: urls.length });
    for (let i = 0; i < urls.length; i++) {
      const blob = await fetch(urls[i]).then((r) => r.blob()).catch(() => null);
      if (!blob) continue;
      for (let attempt = 0; attempt < 6; attempt++) {
        const form = new FormData();
        const name = `chunk-${i}.${blob.type.includes("mp4") ? "m4a" : "webm"}`;
        form.append("audio", blob, name); form.append("name", name); form.append("language", "");
        form.append("prompt", texts.filter(Boolean).slice(-1)[0] ?? "");
        const res = await fetch("/api/transcribe", { method: "POST", body: form }).catch(() => null);
        const data = res ? await res.json().catch(() => ({})) : {};
        if (res?.ok) { texts.push(data.text ?? ""); break; }
        if (data.error === "no-key" || data.error === "bad-key") { setRedo(null); return toast("error", t("keyStopped")); }
        const wait = data.error === "limit" ? (data.retryAfter ?? 60) : 10;
        setRedo({ done: i, total: urls.length, wait: data.error === "limit" });
        await new Promise((r) => setTimeout(r, wait * 1000));
      }
      setRedo({ done: i + 1, total: urls.length });
    }
    const transcript = texts.filter(Boolean).join(" ").trim();
    const { data: row, error } = await supabase.from("docs")
      .insert({ title: t("redoneTitle", { title: docTitle ?? "" }), kind: "meeting", body: `## ${t("transcriptHeading")}\n\n${transcript || `_${t("nothingHeard")}_`}` })
      .select("id").single();
    setRedo(null);
    if (error || !row) return toast("error", t("saveError"));
    toast("ok", t("redoneSaved"));
    router.push(`/camp?tab=docs&doc=${row.id}`);
    router.refresh();
  }

  if (urls && !urls.length) return null;

  return (
    <div className="mb-5 flex items-center gap-3 rounded-xl bg-surface-2/70 p-2.5 pr-4">
      <button disabled={!urls} onClick={() => { const a = audio.current; if (!a) return; if (a.paused) a.play(); else a.pause(); }}
              aria-label={playing ? t("pause") : t("play")}
              className="grid size-10 shrink-0 place-items-center rounded-full bg-trail text-white disabled:opacity-60">
        {!urls ? <Loader2 size={16} className="animate-spin" /> : playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{t("recording")}</p>
        <p className="text-xs text-muted tabular-nums">{urls ? `${t("part", { n: part + 1, total: urls.length })}${keepForever ? "" : ` · ${t("keptUntil", { date: keptUntil })}`}` : t("loadingAudio")}</p>
      </div>
      {urls && docTitle !== undefined && bucket === "recordings" && (
        <button onClick={redoTranscript} disabled={!!redo} title={t("redoHint")}
                className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-surface px-3 text-xs font-semibold ring-1 ring-line hover:ring-brand/50 disabled:opacity-70">
          {redo ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
          {redo ? (redo.wait ? t("redoWaiting") : t("redoProgress", { done: redo.done, total: redo.total })) : t("redo")}
        </button>
      )}
      {urls && (
        <a href={urls[part]} download className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink" aria-label={t("downloadAudio")} title={t("downloadAudio")}>
          <Download size={15} />
        </a>
      )}
      {urls && (
        <audio ref={audio} src={urls[part]} preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
               onEnded={() => { if (part < urls.length - 1) { setPart(part + 1); requestAnimationFrame(() => audio.current?.play()); } else { setPlaying(false); setPart(0); } }} />
      )}
    </div>
  );
}
