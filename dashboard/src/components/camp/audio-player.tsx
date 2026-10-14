"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { shortDate } from "@/lib/format";
import { Play, Pause, Download, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/** Plays a recording back from the owner's private storage, minute by minute, as one continuous track. */
export function AudioPlayer({ ownerId, docId, createdAt, bucket = "recordings", folder: folderProp, keepForever = false }: {
  ownerId: string; docId: string; createdAt: string; bucket?: "recordings" | "meetings"; folder?: string; keepForever?: boolean;
}) {
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
