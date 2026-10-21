"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarSync, Loader2, Unplug } from "lucide-react";
import { useToast } from "@/components/toast";

const KNOWN = ["format", "unreachable", "not_calendar"];

/** "Show my Google Calendar in emet": paste your Google secret iCal link once. Read only, private to you. */
export function GoogleCalendar() {
  const t = useTranslations("camp.gcal");
  const toast = useToast();
  const [connected, setConnected] = useState<boolean | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch("/api/gcal").then((r) => r.json()).then((d) => setConnected(!!d.connected)).catch(() => setConnected(false)); }, []);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/gcal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) { toast("error", t(`error.${KNOWN.includes(d.error) ? d.error : "save"}`)); return; }
    setConnected(true); setEditing(false); setUrl("");
  }

  async function disconnect() {
    setBusy(true);
    await fetch("/api/gcal", { method: "DELETE" }).catch(() => null);
    setBusy(false); setConnected(false); toast("ok", t("disconnected"));
  }

  return (
    <section id="gcal" className="panel scroll-mt-24 p-5">
      <h2 className="flex items-center gap-2 font-semibold"><CalendarSync size={17} /> {t("title")}</h2>
      <p className="mt-1 mb-4 text-sm text-muted">{t("hint")}</p>
      {connected === undefined ? <Loader2 size={16} className="animate-spin text-muted" /> : connected && !editing ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-ok-text">{t("connected")}</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setEditing(true)} className="rounded-xl bg-surface-2 px-3.5 py-2 text-sm font-medium hover:bg-line">{t("change")}</button>
            <button onClick={disconnect} disabled={busy} className="flex items-center gap-1.5 rounded-xl bg-surface-2 px-3.5 py-2 text-sm font-medium hover:bg-line">
              <Unplug size={14} /> {t("disconnect")}
            </button>
          </div>
          <p className="text-xs text-muted">{t("delay")}</p>
        </div>
      ) : (
        <form onSubmit={connect} className="space-y-3">
          <ol className="list-decimal space-y-0.5 pl-5 text-sm text-muted"><li>{t("step1")}</li><li>{t("step2")}</li><li>{t("step3")}</li></ol>
          <div className="flex gap-2">
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("placeholder")} aria-label={t("title")}
                   autoComplete="off" spellCheck={false} className="input min-w-0 flex-1" />
            <button disabled={busy || !url.trim()} className="grid shrink-0 place-items-center rounded-xl bg-brand px-4 text-sm font-medium text-brand-contrast disabled:opacity-50">
              {busy ? <Loader2 size={16} className="animate-spin" /> : t("connect")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
