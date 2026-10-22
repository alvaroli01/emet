"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, Clock, Maximize2, X } from "lucide-react";
import { layoutLanes } from "@/lib/calendar-layout";
import { PhoneWeek } from "./phone-week";

export type CalendarItem = {
  id: string; title: string; day: string; start: string | null; end: string | null;
  status: "done" | "late" | "open"; href: string; team?: string; kind?: "google" | "notion";
};
export type GoogleStatus = "connected" | "not_connected" | "unreachable";

const ROW = 52, BIG_ROW = 64; // px per hour (normal / expanded view)
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const DOT = { done: "bg-muted", late: "bg-bad", open: "bg-[#ff7a2e]" } as const;
const GDOT = "bg-[#60a5fa]", NDOT = "bg-[#a78bfa]"; // Google blue, Notion purple

/** emet items open inside the app; Google events open Google Calendar in a new tab. */
function Item({ x, ...p }: { x: CalendarItem } & Omit<ComponentProps<"a">, "href">) {
  return x.kind ? <a href={x.href} target="_blank" rel="noopener noreferrer" {...p} /> : <Link href={x.href} {...p} />;
}

/**
 * My week as a time-grid calendar (from the "personal dashboard 2" picture): a column per day, hours down the side,
 * my plans as cards in their time slot, tasks due that day on top, today's column tinted red with a live red "now" line.
 * Weekend columns only show up when something is planned or it's the weekend.
 */
export function WeekCalendar({ days, today, items, google, big = false }: { days: string[]; today: string; items: CalendarItem[]; google?: GoogleStatus; big?: boolean }) {
  const row = big ? BIG_ROW : ROW;
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setExpanded(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [expanded]);
  const t = useTranslations("home");
  const locale = useLocale();
  const router = useRouter();
  const scroller = useRef<HTMLDivElement>(null);
  // "Now" comes from the viewer's clock after mount, so the server and the browser never disagree
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => { const d = new Date(); setNow(d.getHours() * 60 + d.getMinutes()); };
    tick();
    const id = setInterval(tick, 30_000);
    // Google events are fetched on the server: re-render every 5 minutes while the page is on screen
    const refresh = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 5 * 60_000);
    return () => { clearInterval(id); clearInterval(refresh); };
  }, [router]);

  // Small card: weekends only when something timed or an emet task is there (a multi-day Google all-day event isn't enough). Expanded: all 7 days.
  const cols = days.filter((d, i) => big || i < 5 || d === today || items.some((x) => x.day === d && (x.start || x.kind !== "google")));
  const timed = items.filter((x) => x.start);
  const starts = timed.map((x) => mins(x.start!)), ends = timed.map((x) => (x.end ? mins(x.end) : mins(x.start!) + 30));
  const from = Math.min(8, ...starts.map((m) => Math.floor(m / 60))), to = Math.max(20, ...ends.map((m) => Math.ceil(m / 60)));
  const hours = Array.from({ length: to - from }, (_, i) => from + i);
  const y = (m: number) => ((m - from * 60) / 60) * row;
  const nowY = now !== null && now >= from * 60 && now <= to * 60 ? y(now) : null;
  const isLive = (x: CalendarItem) => !x.kind && x.day === today && x.status !== "done" && now !== null && x.start !== null
    && mins(x.start) <= now && now < (x.end ? mins(x.end) : mins(x.start) + 30);

  // Open on the current hour (or the first plan) instead of 8 am
  useEffect(() => {
    if (!scroller.current || now === null) return;
    const at = now >= from * 60 && now <= to * 60 ? now : starts.length ? Math.min(...starts) : from * 60;
    scroller.current.scrollTop = Math.max(0, y(Math.floor(at / 60) * 60) - row);
    // only once, when "now" first becomes known
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now === null]);

  return (
    <div className={big ? "" : "relative mt-3"}>
      {!big && (
        <button onClick={() => setExpanded(true)} className="absolute -top-1 right-0 z-10 flex max-sm:hidden items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted hover:text-ink" aria-label={t("calExpand")}>
          <Maximize2 size={12} /> {t("calExpand")}
        </button>
      )}
      {expanded && createPortal(
        // Expanded: the same week, full screen, wide columns and full titles (portal: the glass card's blur would trap a fixed overlay)
        <div className="fixed inset-0 z-50 flex flex-col bg-black/70 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label={t("calendar")}>
          <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col overflow-hidden rounded-3xl bg-solid p-4 shadow-2xl sm:p-6">
            <div className="mb-2 flex items-center justify-between"><h2 className="text-lg font-semibold">{t("calendar")}</h2>
              <button onClick={() => setExpanded(false)} aria-label={t("calClose")} className="grid size-9 place-items-center rounded-full hover:bg-surface-2"><X size={18} /></button></div>
            <div className="min-h-0 flex-1 overflow-auto"><WeekCalendar days={days} today={today} items={items} google={google} big /></div>
          </div>
        </div>, document.body,
      )}
      {/* Phones: small day buttons + a short list; the time grid below is for the computer */}
      {!big && <PhoneWeek days={days} today={today} allDay={t("allDay")} empty={t("dayEmpty")}
        items={items.map((x) => ({ id: x.id, title: x.title, day: x.day, href: x.href, google: x.kind === "google", notion: x.kind === "notion", done: x.status === "done", late: x.status === "late",
          time: x.start ? `${x.start}${x.end ? `–${x.end}` : ""}` : null, meta: x.team ?? null }))} />}
    <div className={`overflow-x-auto ${big ? "" : "pt-6 max-sm:hidden"}`}>
      <div className={big ? "min-w-[980px]" : "min-w-[620px]"}>
        {/* Day headers + tasks due that day */}
        <div className="grid gap-1.5 pl-12" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0,1fr))` }}>
          {cols.map((day) => {
            const isToday = day === today;
            const due = items.filter((x) => x.day === day && !x.start);
            return (
              <div key={day} className={`rounded-t-2xl px-2 pt-2 pb-1.5 ${big ? "" : "max-h-24 overflow-y-auto [scrollbar-width:none]"} ${isToday ? "bg-[linear-gradient(180deg,rgb(239_68_68/0.32),rgb(239_68_68/0.14))]" : "bg-surface-2/50"}`}>
                <p className={`text-[11px] font-semibold uppercase tracking-wide ${isToday ? "text-white" : "text-muted"}`}>
                  {new Date(day + "T12:00:00Z").toLocaleDateString(locale, { weekday: "short", day: "numeric", timeZone: "UTC" })}
                </p>
                {due.map((x, k) => (
                  <Item key={x.id} x={x} title={x.title} style={{ animationDelay: `${k * 60}ms` }}
                        className={`cal-in mt-1 flex items-center gap-1.5 truncate rounded-lg bg-solid/70 px-1.5 py-1 text-[11px] ring-1 ring-line hover:ring-brand/50 ${x.kind === "google" ? `ring-[#60a5fa]/40 ${x.status === "done" ? "text-muted" : ""}` : x.kind === "notion" ? `ring-[#a78bfa]/45 ${x.status === "done" ? "text-muted line-through" : ""}` : x.status === "done" ? "text-muted line-through" : ""}`}>
                    <span className={`size-1.5 shrink-0 rounded-full ${x.kind === "google" ? GDOT : x.kind === "notion" ? NDOT : DOT[x.status]}`} /><span className={big ? "line-clamp-2" : "truncate"}>{x.title}</span>
                  </Item>
                ))}
              </div>
            );
          })}
        </div>

        {/* Hour grid (scrollbar hidden so its columns stay as wide as the day headers above) */}
        <div ref={scroller} className={`relative ${big ? "max-h-[calc(100dvh-14rem)]" : "max-h-[320px]"} overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
          <div className="relative grid gap-1.5 pl-12" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0,1fr))`, height: hours.length * row }}>
            {/* Hour labels and lines */}
            {hours.map((h) => (
              <div key={h} aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-line/60" style={{ top: (h - from) * row }}>
                <span className="absolute -top-2 left-0 w-10 text-right text-[10px] text-muted tabular-nums">{hhmm(h * 60)}</span>
              </div>
            ))}
            {cols.map((day, ci) => {
              const isToday = day === today;
              return (
                <div key={day} className={`relative ${isToday ? "bg-[linear-gradient(180deg,rgb(239_68_68/0.14),rgb(239_68_68/0.04))]" : "bg-surface-2/30"}`}>
                  {(() => { const timedToday = items.filter((x) => x.day === day && x.start);
                    const lanes = layoutLanes(timedToday.map((x) => ({ id: x.id, start: x.start!, end: x.end })));
                    return timedToday.map((x, k) => {
                    const top = y(mins(x.start!)), h = Math.max(30, y(x.end ? mins(x.end) : mins(x.start!) + 30) - top - 3);
                    const { lane, lanes: n } = lanes.get(x.id) ?? { lane: 0, lanes: 1 };
                    const live = isLive(x), g = x.kind === "google";
                    const strike = x.status === "done" ? (g ? "text-muted" : "text-muted line-through") : "";
                    return (
                      <Item key={x.id} x={x} title={x.title}
                            className={`cal-in absolute overflow-hidden rounded-xl text-left ${h < 44 ? "px-2 py-1.5" : "p-2"} ring-1 transition hover:ring-brand/60
                              ${live ? "cal-live bg-[linear-gradient(160deg,rgb(255_106_26/0.45),rgb(255_106_26/0.15))] ring-brand/60"
                                : x.kind === "google" ? `bg-[#3b82f6]/20 ring-[#60a5fa]/45 ${x.status === "done" ? "opacity-70" : ""}`
                                : x.kind === "notion" ? `bg-[#8b5cf6]/20 ring-[#a78bfa]/45 ${x.status === "done" ? "opacity-70" : ""}`
                                : x.status === "late" ? "bg-bad/15 ring-bad/40" : "bg-solid/80 ring-line"}`}
                            style={{ top, height: h, left: `calc(${(lane / n) * 100}% + 2px)`, width: `calc(${100 / n}% - 4px)`, animationDelay: `${(ci * 3 + k) * 50}ms` }}>
                        {h < 44 ? (
                          <span className={`flex items-center gap-1.5 text-[11px] leading-tight font-medium ${strike}`}>
                            <span className={`size-1.5 shrink-0 rounded-full ${live ? "animate-pulse bg-white" : g ? GDOT : x.kind === "notion" ? NDOT : DOT[x.status]}`} /><span className={big ? "line-clamp-2" : "truncate"}>{x.title}</span>
                          </span>
                        ) : (<>
                          <span className={`flex items-center gap-1 text-[10px] font-medium ${g ? "text-[#93c5fd]" : x.kind === "notion" ? "text-[#c4b5fd]" : x.status === "done" ? "text-muted" : x.status === "late" ? "text-bad-text" : "text-[#ffb27a]"}`}>
                            {g ? <CalendarDays size={10} /> : <span className={`size-1.5 rounded-full ${live ? "animate-pulse bg-white" : x.kind === "notion" ? NDOT : DOT[x.status]}`} />}
                            {g ? t("cal.google") : x.kind === "notion" ? "Notion" : live ? t("calNow") : t(`cal.${x.status}`)}
                          </span>
                          <span className={`mt-0.5 block text-xs leading-tight font-medium ${strike}`}>{x.title}</span>
                          {h > 50 && <span className="mt-1 flex items-center gap-1 text-[10px] text-muted"><Clock size={10} /> {x.start}{x.end ? `–${x.end}` : ""}</span>}
                        </>)}
                      </Item>
                    );
                  }); })()}
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
        {google === "unreachable" && <p className="mt-2 text-xs text-bad-text">{t("gcalFailed")}</p>}
      </div>
    </div>
    </div>
  );
}
