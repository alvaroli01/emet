"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Building2, Copy, Download, Link2, Loader2, MapPin, RotateCcw, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { Avatar } from "@/components/ui";

export type OfficeData = {
  inNow: { id: string; name: string; avatar: string | null; since: string }[]; // since = "09:12" Spanish time
  paused: { id: string; name: string; avatar: string | null; since: string; today: string }[]; // left today, may come back before 21:00
  me: { in: boolean; paused: boolean; today: string; week: string };           // "7h 05m"
  week: { id: string; name: string; avatar: string | null; hours: string; ms: number }[];
  isAdmin: boolean; officeSet: boolean; // the office point the phones are measured against
  officePoint: { lat: number; lng: number } | null;
};

/** At the office: who is in right now, my hours, and the phone automation that checks me in and out by itself.
 *  There is no manual check-in: only the phone's real position counts, so nobody can start or stop their time. */
export function OfficeCard({ d }: { d: OfficeData }) {
  const t = useTranslations("today.office");
  const toast = useToast();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState(false);
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => { if (setup && token === undefined) supabase.from("office_links").select("token").maybeSingle().then(({ data }) => setToken(data?.token ?? null)); }, [setup, token, supabase]);

  async function create(reset = false) {
    setToken(undefined);
    if (reset) await supabase.from("office_links").delete().not("token", "is", null);
    const { data, error } = await supabase.from("office_links").insert({}).select("token").single();
    if (error) { toast("error", t("error")); setToken(null); return; }
    setToken(data.token);
  }
  // OwnTracks (free, iPhone + Android, Alvaro 2026-11-11): one tap imports this whole setup — HTTP to my link, background
  // reporting, and a 100 m office zone that wakes the phone (emet itself decides 30 m in / 80 m out from the position).
  const isIphone = typeof navigator !== "undefined" && /iPhone|iPad/i.test(navigator.userAgent);
  const installUrl = isIphone ? "https://apps.apple.com/app/owntracks/id692424691" : "https://play.google.com/store/apps/details?id=org.owntracks.android";
  function connectUrl() {
    const conf = {
      _type: "configuration", mode: 3, url: `${window.location.origin}/api/office/${token}`, tid: "em",
      monitoring: 1, cmd: true, allowRemoteLocation: true, autostartOnBoot: true, extendedData: false,
      locatorDisplacement: 50, locatorInterval: 300, locatorPriority: 1, days: 0,
      waypoints: d.officePoint ? [{ _type: "waypoint", desc: "emet office", lat: d.officePoint.lat, lon: d.officePoint.lng, rad: 100, tst: 1762819200 }] : [],
    };
    return `owntracks:///config?inline=${btoa(JSON.stringify(conf))}`;
  }
  const copy = async () => { await navigator.clipboard.writeText(`${window.location.origin}/api/office/${token}`); toast("ok", t("copied")); };
  // Admin, standing in the office: save this spot as the office (what "30 m" and "150 m" are measured from)
  function setOffice() {
    if (!navigator.geolocation) { toast("error", t("error")); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { error } = await supabase.from("office_place").upsert({ id: true, lat: pos.coords.latitude, lng: pos.coords.longitude, updated_at: new Date().toISOString() });
      setBusy(false);
      if (error) { toast("error", t("error")); return; }
      toast("ok", t("officeSaved", { acc: Math.round(pos.coords.accuracy) }));
      router.refresh();
    }, () => { setBusy(false); toast("error", t("noLocation")); }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  }

  return (
    <section className="panel p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-lg font-semibold tracking-tight"><Building2 size={17} /> {t("title")}</h2>
        {d.me.in && <span className="rounded-full bg-ok px-2.5 py-1 text-xs font-medium text-white">{t("youIn")}</span>}
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
          {!d.officeSet && <p className="rounded-lg bg-surface px-3 py-2 text-xs font-medium">{t("officeMissing")}</p>}
          {d.isAdmin && (
            <button onClick={setOffice} disabled={busy} className="flex items-center gap-1.5 text-xs underline underline-offset-2 hover:text-ink">
              <MapPin size={12} /> {d.officeSet ? t("moveOffice") : t("setOffice")}
            </button>
          )}
          {token === undefined ? <Loader2 size={16} className="animate-spin text-muted" /> : !token ? (
            <button onClick={() => create()} className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-contrast">{t("create")}</button>
          ) : (
            <>
              <div>
                <p className="font-medium">{t("otTitle")}</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <a href={installUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-xl bg-surface px-3.5 py-2 text-sm font-medium hover:bg-line"><Download size={14} /> {t("otInstall")}</a>
                  <a href={connectUrl()} className="flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-sm font-medium text-brand-contrast"><Link2 size={14} /> {t("otConnect")}</a>
                </div>
                <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-muted">
                  {(["o1", "o2", "o3", isIphone ? "o4i" : "o4a"] as const).map((k) => <li key={k}>{t(k)}</li>)}
                </ol>
                <p className="mt-2 text-muted">{t("otBlocked")}</p>
                <button onClick={copy} className="mt-1.5 flex items-center gap-1.5 rounded-xl bg-surface px-3 py-2 text-sm font-medium hover:bg-line"><Copy size={13} /> {t("copyLink")}</button>
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
