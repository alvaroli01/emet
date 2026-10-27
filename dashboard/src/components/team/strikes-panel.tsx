"use client";

import { useLocale, useTranslations } from "next-intl";
import { Gavel, Droplets } from "lucide-react";
import { shortDate } from "@/lib/format";
import { quarterOf, strikeSummary, PUNISHMENT_EUR } from "@/lib/strikes";
import type { StrikesData } from "@/lib/strikes-server";

/** On anyone's page: their strikes this quarter (resets every 3 months), €3 fines not paid yet, and any €75 punishment. */
export function StrikesPanel({ data, today, isMe }: { data: StrikesData; today: string; isMe: boolean }) {
  const t = useTranslations("strikes");
  const locale = useLocale();
  const s = strikeSummary(data.strikes, today);
  const q = quarterOf(today);
  const now = data.strikes.filter((x) => quarterOf(x.happened_on) === q);
  const open = data.punishments.filter((p) => !p.done_at);
  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold"><Gavel size={16} /> {t("title")}</h2>
        <p className="text-xs text-muted">{t("resets", { date: shortDate(s.reset, locale) })}</p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <p className="readout text-3xl">{s.total}<span className="text-base font-normal text-muted"> / 3</span></p>
        <div className="flex gap-1.5" aria-hidden>{[0, 1, 2].map((i) => <span key={i} className={`h-2.5 w-10 rounded-full ${i < s.total % 3 || (s.total >= 3 && s.total % 3 === 0) ? "bg-bad" : "bg-surface-2"}`} />)}</div>
        <p className="text-sm text-muted">{s.total >= 3 ? t("reached") : t("left", { n: s.toNext })}</p>
        {s.unpaid > 0 && <span className="rounded-full bg-warn/15 px-2.5 py-1 text-xs font-medium text-warn-text">{t("owes", { eur: s.unpaid })}</span>}
      </div>
      {open.map((p) => (
        <p key={p.id} className={`mt-3 flex items-start gap-2 rounded-xl p-3 text-sm ring-1 ${p.due_on < today ? "bg-bad/10 ring-bad/40" : "bg-warn/10 ring-warn/40"}`}>
          <Droplets size={16} className="mt-0.5 shrink-0" />
          <span>{isMe ? t("punishmentMe", { eur: PUNISHMENT_EUR, date: shortDate(p.due_on, locale) }) : t("punishmentOther", { eur: PUNISHMENT_EUR, date: shortDate(p.due_on, locale) })}</span>
        </p>
      ))}
      {now.length ? (
        <ul className="mt-3 divide-y divide-line">
          {now.map((x) => (
            <li key={x.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="w-16 shrink-0 text-xs text-muted tabular-nums">{shortDate(x.happened_on, locale)}</span>
              <span className="min-w-0 flex-1">{t(`kinds.${x.kind}`)}{x.note && <span className="block truncate text-xs text-muted">{x.note}</span>}</span>
              <span className="text-xs font-semibold tabular-nums">+{x.weight}</span>
              {Number(x.fine) > 0 && <span className={`rounded-full px-2 py-0.5 text-[11px] ${x.paid_at ? "bg-ok/15 text-ok-text" : "bg-warn/15 text-warn-text"}`}>€{Number(x.fine)} · {x.paid_at ? t("paid") : t("notPaid")}</span>}
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 text-sm text-muted">{t("clean")}</p>}
    </section>
  );
}
