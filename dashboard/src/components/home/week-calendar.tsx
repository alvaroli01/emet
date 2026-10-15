"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, Clock } from "lucide-react";

export type CalendarItem = {
  id: string; title: string; day: string; start: string | null; end: string | null;
  status: "done" | "late" | "open"; href: string; team?: string;
};

const ROW = 52; // px per hour
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const DOT = { done: "bg-muted", late: "bg-bad", open: "bg-[#ff7a2e]" } as const;

/**
 * My week as a time-grid calendar (from the "personal dashboard 2" picture): a column per day, hours down the side,
 * my plans as cards in their time slot, tasks due that day on top, today's column tinted red with a live red "now" line.
 * Weekend columns only show up when something is planned or it's the weekend.
 */
export function WeekCalendar({ days, today, items }: { days: string[]; today: string; items: CalendarItem[] }) {
  const t = useTranslations("home");
  const locale = useLocale();
  const scroller = useRef<HTMLDivElement>(null);
  // "Now" comes from the viewer's clock after mount, so the server and the browser never disagree
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => { const d = new Date(); setNow(d.getHours() * 60 + d.getMinutes()); };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const cols = days.filter((d, i) => i < 5 || d === today || items.some((x) => x.day === d));
  const timed = items.filter((x) => x.start);
  const starts = timed.map((x) => mins(x.start!)), ends = timed.map((x) => (x.end ? mins(x.end) : mins(x.start!) + 30));
  const from = Math.min(8, ...starts.map((m) => Math.floor(m / 60))), to = Math.max(20, ...ends.map((m) => Math.ceil(m / 60)));
  const hours = Array.from({ length: to - from }, (_, i) => from + i);
  const y = (m: number) => ((m - from * 60) / 60) * ROW;
  const nowY = now !== null && now >= from * 60 && now <= to * 60 ? y(now) : null;
  const isLive = (x: CalendarItem) => x.day === today && x.status !== "done" && now !== null && x.start !== null
    && mins(x.start) <= now && now < (x.end ? mins(x.end) : mins(x.start) + 30);

  // Open on the current hour (or the first plan) instead of 8 am
  useEffect(() => {
    if (!scroller.current || now === null) return;
    scroller.current.scrollTop = Math.max(0, (nowY ?? (starts.length ? y(Math.min(...starts)) : 0)) - ROW);
    // only once, when "now" first becomes known
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now === null]);

  return (
    <div className="mt-3 overflow-x-auto">
      <div className="min-w-[620px]">
        {/* Day headers + tasks due that day */}
        <div className="grid gap-1.5 pl-12" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0,1fr))` }}>
          {cols.map((day) => {
            const isToday = day === today;
            const due = items.filter((x) => x.day === day && !x.start);
            return (
              <div key={day} className={`rounded-t-2xl px-2 pt-2 pb-1.5 ${isToday ? "bg-[linear-gradient(180deg,rgb(239_68_68/0.32),rgb(239_68_68/0.14))]" : "bg-surface-2/50"}`}>
                <p className={`text-[11px] font-semibold uppercase tracking-wide ${isToday ? "text-white" : "text-muted"}`}>
                  {new Date(day + "T12:00:00Z").toLocaleDateString(locale, { weekday: "short", day: "numeric", timeZone: "UTC" })}
                </p>
                {due.map((x, k) => (
                  <Link key={x.id} href={x.href} title={x.title} style={{ animationDelay: `${k * 60}ms` }}
                        className={`cal-in mt-1 flex items-center gap-1.5 truncate rounded-lg bg-solid/70 px-1.5 py-1 text-[11px] ring-1 ring-line hover:ring-brand/50 ${x.status === "done" ? "text-muted line-through" : ""}`}>
                    <span className={`size-1.5 shrink-0 rounded-full ${DOT[x.status]}`} /><span className="truncate">{x.title}</span>
                  </Link>
                ))}
              </div>
            );
          })}
        </div>

        {/* Hour grid */}
        <div ref={scroller} className="relative max-h-[320px] overflow-y-auto [scrollbar-width:thin]">
          <div className="relative grid gap-1.5 pl-12" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0,1fr))`, height: hours.length * ROW }}>
            {/* Hour labels and lines */}
            {hours.map((h) => (
              <div key={h} aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-line/60" style={{ top: (h - from) * ROW }}>
                <span className="absolute -top-2 left-0 w-10 text-right text-[10px] text-muted tabular-nums">{hhmm(h * 60)}</span>
              </div>
            ))}
            {cols.map((day, ci) => {
              const isToday = day === today;
              return (
                <div key={day} className={`relative ${isToday ? "bg-[linear-gradient(180deg,rgb(239_68_68/0.14),rgb(239_68_68/0.04))]" : "bg-surface-2/30"}`}>
                  {items.filter((x) => x.day === day && x.start).map((x, k) => {
                    const top = y(mins(x.start!)), h = Math.max(30, y(x.end ? mins(x.end) : mins(x.start!) + 30) - top - 3);
                    const live = isLive(x);
                    return (
                      <Link key={x.id} href={x.href} title={x.title}
                            className={`cal-in absolute inset-x-1 overflow-hidden rounded-xl p-2 text-left ring-1 transition hover:ring-brand/60
                              ${live ? "cal-live bg-[linear-gradient(160deg,rgb(255_106_26/0.45),rgb(255_106_26/0.15))] ring-brand/60"
                                : x.status === "late" ? "bg-[rgb(127_29_29/0.55)] ring-bad/40" : "bg-solid/80 ring-line"}`}
                            style={{ top, height: h, animationDelay: `${(ci * 3 + k) * 50}ms` }}>
                        <span className={`flex items-center gap-1 text-[10px] font-medium ${x.status === "done" ? "text-muted" : x.status === "late" ? "text-bad-text" : "text-[#ffb27a]"}`}>
                          <span className={`size-1.5 rounded-full ${live ? "animate-pulse bg-white" : DOT[x.status]}`} />
                          {live ? t("calNow") : t(`cal.${x.status}`)}
                        </span>
                        <span className={`mt-0.5 block text-xs leading-tight font-medium ${x.status === "done" ? "text-muted line-through" : ""}`}>{x.title}</span>
                        {h > 50 && <span className="mt-1 flex items-center gap-1 text-[10px] text-muted"><Clock size={10} /> {x.start}{x.end ? `–${x.end}` : ""}</span>}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
            {/* Red "now" line across the week, with the time on the left */}
            {nowY !== null && (
              <div aria-hidden className="pointer-events-none absolute inset-x-0 z-10 transition-[top] duration-1000 ease-linear" style={{ top: nowY }}>
                <span className="absolute -top-2 left-0 w-10 rounded bg-bad text-center text-[10px] font-semibold text-white tabular-nums">{hhmm(now!)}</span>
                <span className="absolute left-11 right-0 h-px bg-bad shadow-[0_0_6px_rgb(239_68_68/0.8)]" />
                <span className="absolute -top-[3px] left-11 size-[7px] rounded-full bg-bad"><span className="absolute inset-0 animate-ping rounded-full bg-bad" /></span>
              </div>
            )}
          </div>
        </div>
        {!items.length && (
          <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted"><CalendarDays size={13} /> {t("calEmpty")}</p>
        )}
      </div>
    </div>
  );
}
