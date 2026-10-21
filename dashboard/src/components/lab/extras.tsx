"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Radar, Calculator, ExternalLink } from "lucide-react";
import { eur, pct } from "@/lib/format";
import { unitEconomics } from "@/lib/scout/core";
import type { Analysis } from "@/lib/lab/score";
import { CouncilPanel } from "./council";

/** Extra judgement under an analysed idea: unit economics, proof-of-demand links, the council, and the jump to Scout. */
export function IdeaExtras({ idea, hasKey }: { idea: { id: string; title: string; analysis: Analysis | null }; hasKey: boolean }) {
  const t = useTranslations("lab.extras");
  const locale = useLocale();
  const a = idea.analysis;
  const u = a ? unitEconomics(a.numbers.price, a.numbers.unit_cost) : null;
  const q = encodeURIComponent(idea.title);
  return (
    <div className="space-y-6">
      {(u || a) && (
        <section className="rounded-xl border border-line p-4">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><Calculator size={14} /> {t("economics")}</h3>
          {u ? (
            <>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div><dt className="text-xs text-muted">{t("profitUnit")}</dt><dd className={`readout text-lg ${u.profit <= 0 ? "text-bad-text" : ""}`}>{eur(u.profit, locale, 2)}</dd></div>
                <div><dt className="text-xs text-muted">{t("margin")}</dt><dd className={`readout text-lg ${u.margin < 0.5 ? "text-warn-text" : "text-ok-text"}`}>{pct(u.margin, locale)}</dd></div>
                <div><dt className="text-xs text-muted">{t("roas")}</dt><dd className="readout text-lg">{u.breakEvenRoas ?? "—"}</dd></div>
                <div><dt className="text-xs text-muted">{t("cpa")}</dt><dd className="readout text-lg">{eur(Math.max(0, u.breakEvenCpa), locale, 2)}</dd></div>
              </dl>
              <p className="mt-2 text-xs text-muted">{t("economicsNote", { price: eur(u.price, locale, 2), cost: eur(u.cost, locale, 2), fees: eur(u.fees, locale, 2) })}</p>
              {u.margin < 0.5 && <p className="mt-1 text-xs text-warn-text">{t("belowTarget")}</p>}
            </>
          ) : <p className="text-sm text-muted">{t("noNumbers")}</p>}
          <p className="mt-3 text-xs text-muted">{t("proof")}{" "}
            <a className="text-climbed underline-offset-2 hover:underline" target="_blank" rel="noopener noreferrer" href={`https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=${q}`}>{t("adLibrary")} <ExternalLink size={10} className="inline" /></a>{" · "}
            <a className="text-climbed underline-offset-2 hover:underline" target="_blank" rel="noopener noreferrer" href={`https://trends.google.com/trends/explore?geo=ES&q=${q}`}>Google Trends <ExternalLink size={10} className="inline" /></a>
          </p>
        </section>
      )}

      <CouncilPanel ideaId={idea.id} hasKey={hasKey} ready={!!a} />

      {a && (a.verdict === "strong" || a.verdict === "promising") && (
        <Link href={`/scout?idea=${idea.id}`} className="panel panel-lift flex items-center gap-3 p-4">
          <Radar size={20} className="shrink-0 text-climbed" />
          <span className="min-w-0"><span className="block font-medium">{t("toScout")}</span><span className="block text-sm text-muted">{t("toScoutHint")}</span></span>
        </Link>
      )}
    </div>
  );
}
