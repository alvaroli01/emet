"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";

export type PhoneWeekItem = {
  id: string; title: string; day: string; time: string | null; href: string;
  google?: boolean; notion?: boolean; done?: boolean; late?: boolean; meta?: string | null;
};

/**
 * Phones only: the week as 7 small day buttons and a short list for the chosen day (today first) —
 * small and readable instead of the computer's time grid.
 */
export function PhoneWeek({ days, today, items, allDay, empty }: { days: string[]; today: string; items: PhoneWeekItem[]; allDay: string; empty: string }) {
  const locale = useLocale();
  const [day, setDay] = useState(days.includes(today) ? today : days[0]);
  const list = items.filter((x) => x.day === day).sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
  const label = (d: string, o: Intl.DateTimeFormatOptions) => new Date(d + "T12:00:00Z").toLocaleDateString(locale, { ...o, timeZone: "UTC" });

  return (
    <div className="mt-3 sm:hidden">
      <div className="grid gap-1" role="tablist" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
        {days.map((d) => {
          const on = d === day, has = items.some((x) => x.day === d);
          return (
            <button key={d} role="tab" aria-selected={on} onClick={() => setDay(d)}
                    className={`flex flex-col items-center rounded-xl py-1.5 text-[11px] leading-tight transition ${on ? "bg-brand text-white" : d === today ? "bg-surface-2 text-ink ring-1 ring-brand/60" : "bg-surface-2/60 text-muted"}`}>
              <span className="uppercase">{label(d, { weekday: "narrow" })}</span>
              <span className="text-sm font-semibold">{label(d, { day: "numeric" })}</span>
              <span className={`mt-0.5 size-1 rounded-full ${has ? (on ? "bg-white" : "bg-brand") : "bg-transparent"}`} />
            </button>
          );
        })}
      </div>
      <ul className="mt-3 space-y-1.5">
        {list.map((x) => (
          <li key={x.id}>
            <Link href={x.href} {...(x.google || x.notion ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className={`flex items-start gap-3 rounded-xl border-l-2 bg-surface-2/60 px-3 py-2 ${x.google ? "border-[#60a5fa]" : x.notion ? "border-[#a78bfa]" : x.late ? "border-bad" : x.done ? "border-ok" : "border-brand"}`}>
              <span className="w-[4.5rem] shrink-0 pt-0.5 text-[11px] text-muted tabular-nums">{x.time ?? allDay}</span>
              <span className="min-w-0 flex-1">
                <span className={`line-clamp-2 text-sm leading-snug ${x.done ? "text-muted line-through" : ""}`}>{x.title}</span>
                {x.meta && <span className="block truncate text-[11px] text-muted">{x.meta}</span>}
              </span>
            </Link>
          </li>
        ))}
        {!list.length && <li className="py-3 text-center text-xs text-muted">{empty}</li>}
      </ul>
    </div>
  );
}
