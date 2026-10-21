"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarSync, Check, ExternalLink, Loader2, Unplug } from "lucide-react";

const KNOWN = ["format", "unreachable", "not_calendar"];
type Status = "connected" | "not_connected" | "unreachable";

/**
 * Connect your own Google Calendar (its secret iCal link), step by step — same small layout as the recorder's
 * Groq connection. Read only and private to you. Used in the Today pop-over and in Base camp.
 */
export function GoogleConnect({ initial, onChange }: { initial?: boolean; onChange?: (connected: boolean) => void }) {
  const t = useTranslations("camp.gcal");
  const [connected, setConnected] = useState<boolean | undefined>(initial);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (initial !== undefined) return;
    fetch("/api/gcal").then((r) => r.json()).then((d) => setConnected(!!d.connected)).catch(() => setConnected(false));
  }, [initial]);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const res = await fetch("/api/gcal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) { setError(t(`error.${KNOWN.includes(d.error) ? d.error : "save"}`)); return; }
    setConnected(true); setUrl(""); onChange?.(true);
  }

  async function disconnect() {
    setBusy(true);
    await fetch("/api/gcal", { method: "DELETE" }).catch(() => null);
    setBusy(false); setConnected(false); onChange?.(false);
  }

  if (connected === undefined) return <Loader2 size={16} className="animate-spin text-muted" />;
  if (connected) return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="grid size-7 place-items-center rounded-full bg-ok text-white"><Check size={14} /></span>
        <span className="flex-1 font-medium">{t("connected")}</span>
        <button onClick={disconnect} disabled={busy} className="flex items-center gap-1 text-xs text-muted hover:text-bad-text"><Unplug size={13} /> {t("disconnect")}</button>
      </div>
      <p className="text-xs text-muted">{t("delay")}</p>
    </div>
  );
  return (
    <form onSubmit={connect} className="space-y-3">
      <p className="flex items-center gap-2 font-medium"><CalendarSync size={16} /> {t("title")}</p>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
        <li>{t("step1")}{" "}
          <a href="https://calendar.google.com/calendar/r/settings" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-climbed underline underline-offset-2">
            calendar.google.com <ExternalLink size={11} />
          </a>
        </li>
        <li>{t("step2")}</li>
        <li>{t("step3")}</li>
      </ol>
      <div className="flex gap-2">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("placeholder")} aria-label={t("title")}
               autoComplete="off" spellCheck={false} className="input min-w-0" />
        <button disabled={busy || !url.trim()} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-brand px-3 text-sm font-medium text-brand-contrast disabled:opacity-60">
          {busy && <Loader2 size={14} className="animate-spin" />}{t("connect")}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-bad-text">{error}</p>}
      <p className="text-xs text-muted">{t("privacy")}</p>
    </form>
  );
}

/** Today → Your week: "Google Calendar · How to connect?" opens the steps in a small pop-over beside the calendar. */
export function GoogleCalendarButton({ status }: { status: Status }) {
  const t = useTranslations("camp.gcal");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => { if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  const on = status !== "not_connected";
  return (
    <div ref={box} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ring-1 ${on ? "bg-surface-2 ring-transparent hover:text-link" : "bg-[#3b82f6]/25 text-[#bfdbfe] ring-[#60a5fa]/50 hover:bg-[#3b82f6]/40"}`}>
        <CalendarSync size={12} /> {t("short")}
        {on ? <span className={`ml-0.5 size-1.5 rounded-full ${status === "connected" ? "bg-ok" : "bg-bad"}`} /> : <span className="font-normal opacity-80">· {t("howTo")}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label={t("title")}
             className="absolute top-full right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-solid p-4 text-left text-ink shadow-[var(--shadow-lift)]">
          <GoogleConnect initial={status !== "not_connected"} onChange={() => router.refresh()} />
        </div>
      )}
    </div>
  );
}

/** Base camp → Agenda: the same steps in a small panel. */
export function GoogleCalendar() {
  return (
    <section id="gcal" className="panel scroll-mt-24 p-5">
      <div className="rounded-2xl bg-surface-2/60 p-4"><GoogleConnect /></div>
    </section>
  );
}
