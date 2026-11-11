"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { officeStatus, hm, madridMidnight, type Visit } from "@/lib/office";

/** Top bar, next to the bell: "In the office" / "Out of office". Tap it for my time today and this week, and the rules. */
export function OfficePill({ meId }: { meId: string }) {
  const t = useTranslations("officePill");
  const supabase = useMemo(() => createClient(), []);
  const [visits, setVisits] = useState<(Visit & { lunch_until: string | null })[] | null>(null);
  const [autoOut, setAutoOut] = useState(false); // just checked out automatically: offer "I'm out, I'll be back"
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 8 * 864e5).toISOString().slice(0, 10); // a little more than a week; officeStatus trims it
    const { data } = await supabase.from("office_visits").select("id, user_id, arrived_at, left_at, forgot, lunch_until")
      .eq("user_id", meId).gte("arrived_at", madridMidnight(since)).returns<(Visit & { lunch_until: string | null })[]>();
    setVisits(data ?? []); setNow(Date.now());
  }, [supabase, meId]);
  useEffect(() => {
    load();
    const tick = setInterval(load, 60_000); // the clock keeps counting while I'm in
    const ch = supabase.channel(`office-pill-${meId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "office_visits", filter: `user_id=eq.${meId}` }, load).subscribe();
    return () => { clearInterval(tick); supabase.removeChannel(ch); };
  }, [load, supabase, meId]);
  // Opening emet on a phone while checked in, away from Dock → checked out now, at this spot (Alvaro, 2026-11-11: he got
  // home and his time was still running). Only when location is already allowed (never a surprise prompt); once per visit.
  const checked = useRef(false);
  const toast = useToast();
  useEffect(() => {
    if (checked.current || !visits || !/iPhone|iPad|Android/i.test(navigator.userAgent) || !navigator.geolocation) return;
    // Paused ("I'll be back") and opening emet again → if at Dock, the day carries on by itself
    const latest = [...visits].sort((a, b) => b.arrived_at.localeCompare(a.arrived_at))[0];
    const pausedToday = !!latest?.lunch_until && !!latest.left_at && latest.left_at >= madridMidnight(new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }));
    const inNow = officeStatus(visits, meId, Date.now()).inNow;
    if (!inNow && !pausedToday) return;
    checked.current = true;
    navigator.permissions?.query({ name: "geolocation" as PermissionName }).then((p) => {
      if (p.state !== "granted") return;
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const r = await fetch("/api/office/tap", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: inNow ? "auto-out" : "in", lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }) }).catch(() => null);
        const j = (r?.ok ? await r.json().catch(() => null) : null) as { status?: string } | null;
        if (j?.status === "out-away") { setAutoOut(true); load(); }
        if (j?.status === "in") { toast("ok", t("autoBack")); load(); }
      }, () => {}, { enableHighAccuracy: true, timeout: 20000, maximumAge: 60_000 });
    }).catch(() => {});
  }, [visits, meId, load, toast, t]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function willReturn(back: boolean) {
    setAutoOut(false);
    if (!back) return;
    const r = await fetch("/api/office/tap", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "will-return", lat: 0, lng: 0, accuracy: 0 }) }).catch(() => null);
    const j = (r?.ok ? await r.json().catch(() => null) : null) as { status?: string } | null;
    if (j?.status === "lunch") { toast("ok", t("willReturnSaved")); load(); }
  }

  if (!visits) return null;
  const s = officeStatus(visits, meId, now);
  return (
    <div ref={box} className="relative">
      {autoOut && (
        <div role="dialog" className="panel bg-solid fixed inset-x-3 top-[4.5rem] z-50 space-y-3 p-4 text-sm shadow-[var(--shadow-lift)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+8px)] sm:w-80">
          <p>{t("autoOut")}</p>
          <div className="flex flex-col gap-2">
            <button onClick={() => willReturn(true)} className="rounded-xl bg-brand px-3 py-2.5 font-medium text-brand-contrast">{t("willReturn")}</button>
            <button onClick={() => willReturn(false)} className="rounded-xl bg-surface-2 px-3 py-2.5 font-medium hover:bg-line">{t("doneToday")}</button>
          </div>
        </div>
      )}
      <button onClick={() => setOpen(!open)} aria-expanded={open}
              className={`flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${s.inNow ? "bg-ok text-white" : "glass-pill text-muted"}`}>
        <span className={`size-2 rounded-full ${s.inNow ? "bg-white" : s.paused ? "bg-warn" : "bg-muted"}`} />
        <span className="max-sm:hidden">{s.inNow ? t("in") : s.paused ? t("paused") : t("out")}</span>
        <Building2 size={14} className="sm:hidden" />
      </button>
      {open && (
        <div className="panel bg-solid absolute top-[calc(100%+8px)] right-0 z-50 w-[min(20rem,calc(100vw-24px))] space-y-3 p-4 text-sm shadow-[var(--shadow-lift)] max-sm:fixed max-sm:inset-x-3 max-sm:top-[4.5rem] max-sm:w-auto" role="dialog">
          <p className="font-semibold">{s.inNow ? t("inSince", { time: s.since ?? "" }) : s.paused ? t("pausedSince", { time: s.since ?? "" }) : t("outLong")}</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-surface-2 p-2.5"><p className="text-xs text-muted">{t("today")}</p><p className="readout text-lg tabular-nums">{hm(s.todayMs)}</p></div>
            <div className="rounded-xl bg-surface-2 p-2.5"><p className="text-xs text-muted">{t("week")}</p><p className="readout text-lg tabular-nums">{hm(s.weekMs)}</p></div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{t("rulesTitle")}</p>
            <ul className="list-disc space-y-1 pl-4 text-xs text-muted">
              {(["r1", "r2", "r3", "r4", "r5"] as const).map((k) => <li key={k}>{t(k)}</li>)}
            </ul>
          </div>
          <Link href="/office" onClick={() => setOpen(false)} className="block text-xs underline underline-offset-2 hover:text-ink">{t("setup")}</Link>
        </div>
      )}
    </div>
  );
}
