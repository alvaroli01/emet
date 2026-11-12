"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Briefcase, Building2, Clock, MapPin, Plane, Utensils } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { Avatar } from "@/components/ui";
import type { EmetCalItem } from "@/components/home/emet-calendar";

export type OfficeData = {
  // Everyone: where they are now, since/until when (Spanish time), time at Dock today, last time they opened emet
  team: { id: string; name: string; avatar: string | null; status: "in" | "lunch" | "lunchOver" | "outside" | "left" | "away" | "none"; since: string | null;
    note: string | null; today: string; seen: string | null }[];
  me: { in: boolean; paused: boolean; today: string; week: string };           // "7h 05m"
  week: { id: string; name: string; avatar: string | null; hours: string; ms: number }[];
  isAdmin: boolean; officeSet: boolean; // the office point the phones are measured against
  // Working outside (Mon/Wed/Fri): who is out now, and this week's log for everyone — the "outside calendar"
  emetRows: EmetCalItem[]; // shown as the main emet calendar on Today (EmetCalendar), not in this card
};

const STATUS_STYLE = { in: "bg-ok/15 text-ok-text", lunch: "bg-warn/15 text-warn-text", lunchOver: "bg-bad/10 text-bad-text", outside: "bg-brand/15 text-ink", left: "bg-surface-2 text-muted", away: "bg-surface-2 text-ink", none: "bg-surface-2 text-muted" } as const;
const STATUS_ICON = { in: <Building2 size={11} />, lunch: <Utensils size={11} />, lunchOver: <Utensils size={11} />, outside: <Briefcase size={11} />, left: <Clock size={11} />, away: <Plane size={11} />, none: null } as const;

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

      <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">{t("teamNow")}</h3>
      <ul className="mb-4 divide-y divide-line">
        {d.team.map((p) => (
          <li key={p.id} className="flex items-center gap-2.5 py-2 text-sm">
            <span className={p.status === "none" ? "opacity-50" : ""}><Avatar name={p.name} src={p.avatar} size={26} /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{p.name}</span>
              <span className="block truncate text-xs text-muted">{p.seen ? t("seen", { time: p.seen }) : t("neverSeen")}</span>
            </span>
            <span className="text-right">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[p.status]}`}>
                {STATUS_ICON[p.status]} {t(`st.${p.status}`, { time: p.since ?? "", note: p.note ?? "" })}
              </span>
              <span className="block text-xs tabular-nums text-muted">{t("atDockToday", { hours: p.today })}</span>
            </span>
          </li>
        ))}
      </ul>

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
