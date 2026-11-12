"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { bestPosition } from "@/lib/best-position";
import { officeStatus, madridMidnight, type Visit } from "@/lib/office";

/** Top bar, next to the bell: "In the office" / "Out of office". Tap it → the check-in circle (/office). */
export function OfficePill({ meId }: { meId: string }) {
  const t = useTranslations("officePill");
  const supabase = useMemo(() => createClient(), []);
  const [visits, setVisits] = useState<(Visit & { lunch_until: string | null })[] | null>(null);
  const [autoOut, setAutoOut] = useState(false); // just checked out automatically: offer "I'm out, I'll be back"
  const [now, setNow] = useState(() => Date.now());

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
  // home and his time was still running). Asks for the location (unless blocked) only while checked in or paused; once per visit.
  const checked = useRef(false);
  const toast = useToast();
  useEffect(() => {
    if (checked.current || !visits || !/iPhone|iPad|Android/i.test(navigator.userAgent) || !navigator.geolocation) return;
    // Paused ("I'll be back") and opening emet again → if at Dock, the day carries on by itself
    const latest = [...visits].sort((a, b) => b.arrived_at.localeCompare(a.arrived_at))[0];
    const pausedToday = !!latest?.lunch_until && !!latest.left_at && latest.left_at >= madridMidnight(new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }));
    const inNow = officeStatus(visits, meId, Date.now()).inNow;
    // Not checked in → opening emet at Dock checks you in straight away (Alvaro, 2026-11-12: no need to tap the circle).
    // Weekends and after 21:00 the server says no; away from Dock nothing happens.
    checked.current = true;
    // iPhone home-screen apps often report "prompt" (or have no Permissions API) even after Allow: ask unless clearly denied
    const ask = () => {
      bestPosition().then(async (pos) => {
        const r = await fetch("/api/office/tap", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: inNow ? "auto-out" : "in", lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }) }).catch(() => null);
        const j = (r?.ok ? await r.json().catch(() => null) : null) as { status?: string } | null;
        if (j?.status === "out-away") { setAutoOut(true); load(); }
        if (j?.status === "in") { toast("ok", t(pausedToday ? "autoBack" : "autoIn")); load(); }
      }).catch(() => {});
    };
    if (!navigator.permissions?.query) { ask(); return; }
    navigator.permissions.query({ name: "geolocation" as PermissionName }).then((p) => { if (p.state !== "denied") ask(); }).catch(ask);
  }, [visits, meId, load, toast, t]);

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
    <div className="relative">
      {autoOut && (
        <div role="dialog" className="panel bg-solid fixed inset-x-3 top-[4.5rem] z-50 space-y-3 p-4 text-sm shadow-[var(--shadow-lift)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+8px)] sm:w-80">
          <p>{t("autoOut")}</p>
          <div className="flex flex-col gap-2">
            <button onClick={() => willReturn(true)} className="rounded-xl bg-brand px-3 py-2.5 font-medium text-brand-contrast">{t("willReturn")}</button>
            <button onClick={() => willReturn(false)} className="rounded-xl bg-surface-2 px-3 py-2.5 font-medium hover:bg-line">{t("doneToday")}</button>
          </div>
        </div>
      )}
      <Link href="/office" aria-label={t("open")}
              className={`flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${s.inNow ? "bg-ok text-white" : "glass-pill text-muted"}`}>
        <span className={`size-2 rounded-full ${s.inNow ? "bg-white" : s.paused ? "bg-warn" : "bg-muted"}`} />
        <span className="max-sm:hidden">{s.inNow ? t("in") : s.paused ? t("paused") : t("out")}</span>
        <Building2 size={14} className="sm:hidden" />
      </Link>
    </div>
  );
}
