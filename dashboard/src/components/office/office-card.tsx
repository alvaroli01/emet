"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Building2, Copy, Loader2, LogIn, LogOut, RotateCcw, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { Avatar } from "@/components/ui";

export type OfficeData = {
  inNow: { id: string; name: string; avatar: string | null; since: string }[]; // since = "09:12" Spanish time
  paused: { id: string; name: string; avatar: string | null; since: string; today: string }[]; // left today, may come back before 21:00
  me: { in: boolean; paused: boolean; today: string; week: string };           // "7h 05m"
  week: { id: string; name: string; avatar: string | null; hours: string; ms: number }[];
};

/** At the office: who is in right now, my hours, and the phone automation that checks me in and out by itself. */
export function OfficeCard({ d }: { d: OfficeData }) {
  const t = useTranslations("today.office");
  const toast = useToast();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState(false);
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => { if (setup && token === undefined) supabase.from("office_links").select("token").maybeSingle().then(({ data }) => setToken(data?.token ?? null)); }, [setup, token, supabase]);

  async function press() {
    setBusy(true);
    const r = await fetch("/api/office", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: d.me.in ? "leave" : "arrive" }) });
    setBusy(false);
    if (!r.ok) { toast("error", t("error")); return; }
    router.refresh();
  }
  async function create(reset = false) {
    setToken(undefined);
    if (reset) await supabase.from("office_links").delete().not("token", "is", null);
    const { data, error } = await supabase.from("office_links").insert({}).select("token").single();
    if (error) { toast("error", t("error")); setToken(null); return; }
    setToken(data.token);
  }
  const url = (e: "arrive" | "leave") => (token ? `${window.location.origin}/api/office/${token}?event=${e}` : "");
  const copy = async (e: "arrive" | "leave") => { await navigator.clipboard.writeText(url(e)); toast("ok", t("copied")); };

  return (
    <section className="panel p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-lg font-semibold tracking-tight"><Building2 size={17} /> {t("title")}</h2>
        <button onClick={press} disabled={busy}
                className={`flex min-h-9 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium ${d.me.in ? "bg-surface-2 hover:bg-line" : "bg-brand text-brand-contrast"}`}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : d.me.in ? <LogOut size={14} /> : <LogIn size={14} />} {d.me.in ? t("checkOut") : t("checkIn")}
        </button>
      </div>
      <p className="mb-3 text-sm text-muted">{t("mine", { today: d.me.today, week: d.me.week })}{d.me.paused && <> · <span className="font-medium text-ink">{t("youPaused")}</span></>}</p>

      <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">{t("inNow", { n: d.inNow.length })}</h3>
      {d.inNow.length ? (
        <ul className="mb-4 space-y-1.5">
          {d.inNow.map((p) => (
            <li key={p.id} className="flex items-center gap-2.5 text-sm">
              <Avatar name={p.name} src={p.avatar} size={24} />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="text-xs text-muted tabular-nums">{t("since", { time: p.since })}</span>
            </li>
          ))}
        </ul>
      ) : <p className="mb-4 text-sm text-muted">{t("nobody")}</p>}

      {d.paused.length > 0 && (
        <>
          <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">{t("pausedTitle", { n: d.paused.length })}</h3>
          <ul className="mb-4 space-y-1.5">
            {d.paused.map((p) => (
              <li key={p.id} className="flex items-center gap-2.5 text-sm text-muted">
                <span className="opacity-60"><Avatar name={p.name} src={p.avatar} size={24} /></span>
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="text-xs tabular-nums">{t("pausedSince", { time: p.since, hours: p.today })}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {d.week.length > 0 && (
        <details className="mb-3">
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-muted hover:text-ink">{t("weekTitle")}</summary>
          <ul className="mt-2 space-y-1.5">
            {d.week.map((p) => (
              <li key={p.id} className="flex items-center gap-2.5 text-sm">
                <Avatar name={p.name} src={p.avatar} size={22} />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="readout text-xs tabular-nums">{p.hours}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <button onClick={() => setSetup(!setup)} className="flex items-center gap-1.5 text-xs text-muted underline underline-offset-2 hover:text-ink">
        <Smartphone size={13} /> {t("setupToggle")}
      </button>
      {setup && (
        <div className="mt-3 space-y-3 rounded-xl bg-surface-2 p-4 text-sm">
          <p className="text-muted">{t("setupHint")}</p>
          {token === undefined ? <Loader2 size={16} className="animate-spin text-muted" /> : !token ? (
            <button onClick={() => create()} className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-contrast">{t("create")}</button>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => copy("arrive")} className="flex items-center gap-1.5 rounded-xl bg-surface px-3 py-2 text-sm font-medium hover:bg-line"><Copy size={13} /> {t("copyArrive")}</button>
                <button onClick={() => copy("leave")} className="flex items-center gap-1.5 rounded-xl bg-surface px-3 py-2 text-sm font-medium hover:bg-line"><Copy size={13} /> {t("copyLeave")}</button>
              </div>
              <div>
                <p className="font-medium">{t("iphoneTitle")}</p>
                <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-muted">
                  {(["i1", "i2", "i3", "i4", "i5"] as const).map((k) => <li key={k}>{t(k)}</li>)}
                </ol>
              </div>
              <div>
                <p className="font-medium">{t("androidTitle")}</p>
                <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-muted">
                  {(["a1", "a2", "a3", "a4"] as const).map((k) => <li key={k}>{t(k)}</li>)}
                </ol>
              </div>
              <p className="text-xs text-muted">{t("private")}{" "}
                <button onClick={() => confirm(t("confirmReset")) && create(true)} className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-ink"><RotateCcw size={11} /> {t("reset")}</button>
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
