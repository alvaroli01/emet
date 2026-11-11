"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { officeStatus, hm, madridMidnight, type Visit } from "@/lib/office";

/** Top bar, next to the bell: "In the office" / "Out of office". Tap it for my time today and this week, and the rules. */
export function OfficePill({ meId }: { meId: string }) {
  const t = useTranslations("officePill");
  const supabase = useMemo(() => createClient(), []);
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 8 * 864e5).toISOString().slice(0, 10); // a little more than a week; officeStatus trims it
    const { data } = await supabase.from("office_visits").select("id, user_id, arrived_at, left_at, forgot")
      .eq("user_id", meId).gte("arrived_at", madridMidnight(since)).returns<Visit[]>();
    setVisits(data ?? []); setNow(Date.now());
  }, [supabase, meId]);
  useEffect(() => {
    load();
    const tick = setInterval(load, 60_000); // the clock keeps counting while I'm in
    const ch = supabase.channel(`office-pill-${meId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "office_visits", filter: `user_id=eq.${meId}` }, load).subscribe();
    return () => { clearInterval(tick); supabase.removeChannel(ch); };
  }, [load, supabase, meId]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!visits) return null;
  const s = officeStatus(visits, meId, now);
  return (
    <div ref={box} className="relative">
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
