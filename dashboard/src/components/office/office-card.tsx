"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Briefcase, Building2, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { Avatar } from "@/components/ui";

export type OfficeData = {
  inNow: { id: string; name: string; avatar: string | null; since: string }[]; // since = "09:12" Spanish time
  paused: { id: string; name: string; avatar: string | null; since: string; today: string }[]; // left today, may come back before 21:00
  me: { in: boolean; paused: boolean; today: string; week: string };           // "7h 05m"
  week: { id: string; name: string; avatar: string | null; hours: string; ms: number }[];
  isAdmin: boolean; officeSet: boolean; // the office point the phones are measured against
  // Working outside (Mon/Wed/Fri): who is out now, and this week's log for everyone — the "outside calendar"
  outsideNow: { id: string; name: string; avatar: string | null; since: string; note: string }[];
  outsideWeek: { day: string; items: { id: string; name: string; note: string; from: string; to: string | null; map: string | null }[] }[];
};

/** At the office: who is in right now, who is working outside (and this week's outside log), my hours, and the
 *  one-tap check-in page. Only the phone's real position counts (the server decides), so nobody can fake their time. */
export function OfficeCard({ d }: { d: OfficeData }) {
  const t = useTranslations("today.office");
  const toast = useToast();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(false);
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

      {d.outsideNow.length > 0 && (
        <>
          <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">{t("outsideNow", { n: d.outsideNow.length })}</h3>
          <ul className="mb-4 space-y-1.5">
            {d.outsideNow.map((p) => (
              <li key={p.id} className="flex items-center gap-2.5 text-sm">
                <Avatar name={p.name} src={p.avatar} size={24} />
                <span className="min-w-0 flex-1 truncate">{p.name} <span className="text-muted">· {p.note}</span></span>
                <span className="text-xs text-muted tabular-nums">{t("since", { time: p.since })}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {d.outsideWeek.length > 0 && (
        <details className="mb-3">
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-muted hover:text-ink"><Briefcase size={12} className="mr-1 inline" />{t("outsideWeek")}</summary>
          <div className="mt-2 space-y-3">
            {d.outsideWeek.map((day) => (
              <div key={day.day}>
                <p className="mb-1 text-xs font-medium text-muted">{day.day}</p>
                <ul className="space-y-1">
                  {day.items.map((x) => (
                    <li key={x.id} className="flex items-baseline gap-2 text-sm">
                      <span className="readout w-24 shrink-0 text-xs tabular-nums text-muted">{x.from}–{x.to ?? t("now")}</span>
                      <span className="min-w-0 flex-1"><span className="font-medium">{x.name}</span> · {x.note}</span>
                      {x.map && <a href={x.map} target="_blank" rel="noreferrer" className="shrink-0 text-xs text-muted underline underline-offset-2 hover:text-ink"><MapPin size={11} className="inline" /> {t("where")}</a>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}

      <Link href="/office" className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-brand-contrast"><MapPin size={14} /> {t("open")}</Link>
      <p className="mt-2 text-xs text-muted">{t("tapHint")}</p>
      {!d.officeSet && <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-xs font-medium">{t("officeMissing")}</p>}
      {d.isAdmin && (
        <button onClick={setOffice} disabled={busy} className="mt-2 flex items-center gap-1.5 text-xs text-muted underline underline-offset-2 hover:text-ink">
          <MapPin size={12} /> {d.officeSet ? t("moveOffice") : t("setOffice")}
        </button>
      )}
    </section>
  );
}
