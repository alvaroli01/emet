"use client";

import { useTranslations } from "next-intl";
import { Briefcase, Building2, MapPin, Plane, Utensils } from "lucide-react";

export type EmetCalItem = { id: string; day: string; kind: "office" | "outside" | "lunch" | "away"; name: string; from: string; to: string | null;
  hours: string; zero: boolean; note: string | null; start: string | null; end: string | null };

const ICON = { office: Building2, outside: Briefcase, lunch: Utensils, away: Plane } as const;
const TONE = { office: "ring-ok/40", outside: "ring-brand/40", lunch: "ring-warn/40", away: "ring-line" } as const;

/** Today's main calendar: the emet team calendar for this week (Mon–Fri) — every Dock stretch (hours, or 0 h if never
 *  checked out), every outside stretch with the places, long breaks and who is away. Everyone sees everyone. */
export function EmetCalendar({ days, today, items }: { days: string[]; today: string; items: EmetCalItem[] }) {
  const t = useTranslations("today.office");
  const label = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString(undefined, { weekday: "short", day: "numeric", timeZone: "UTC" });
  return (
    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-5">
      {days.map((d) => {
        const list = items.filter((x) => x.day === d);
        return (
          <div key={d} className={`min-h-24 rounded-2xl p-2 ${d === today ? "bg-brand/10 ring-1 ring-brand/40" : "bg-surface-2/60"}`}>
            <p className={`mb-1.5 px-1 text-xs font-medium ${d === today ? "text-ink" : "text-muted"}`}>{label(d)}</p>
            {list.length === 0 ? <p className="px-1 text-xs text-muted">—</p> : (
              <ul className="space-y-1">
                {list.map((x) => {
                  const Icon = ICON[x.kind];
                  return (
                    <li key={x.id} className={`rounded-lg bg-solid/70 px-2 py-1.5 text-[11px] ring-1 ${TONE[x.kind]}`}>
                      <p className="flex items-center gap-1 font-medium"><Icon size={11} className="shrink-0 text-muted" /><span className="truncate">{x.name}</span></p>
                      <p className="readout tabular-nums text-muted">
                        {x.kind === "away" ? t("allDay") : `${x.from}–${x.to ?? (x.zero ? "?" : t("now"))}`}
                        {x.kind !== "away" && <> · <span className={x.zero ? "font-medium text-bad-text" : ""}>{x.zero ? t("zero") : x.hours}</span></>}
                      </p>
                      {x.note && <p className={`line-clamp-2 ${x.kind === "lunch" ? "font-medium text-bad-text" : "text-muted"}`}>{x.kind === "lunch" ? `${t("eating")} ${x.note}` : x.note}</p>}
                      {(x.start || x.end) && (
                        <p className="flex flex-wrap gap-x-2">
                          {x.start && <a href={x.start} target="_blank" rel="noreferrer" className="text-muted underline underline-offset-2 hover:text-ink"><MapPin size={10} className="inline" /> {t("startPlace")}</a>}
                          {x.end && <a href={x.end} target="_blank" rel="noreferrer" className={`underline underline-offset-2 hover:text-ink ${x.kind === "office" ? "text-warn-text" : "text-muted"}`}><MapPin size={10} className="inline" /> {t(x.kind === "office" ? "outPlace" : "lastPlace")}</a>}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
