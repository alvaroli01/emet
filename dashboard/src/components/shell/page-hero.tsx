"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ChevronRight, CheckCircle2 } from "lucide-react";
import { NumberTicker } from "@/components/ui/number-ticker";

export type HeroLine = { text: string; href?: string; tone?: "ok" | "warn" | "bad" | "info" };
export type HeroStat = { label: string; value: number | null; kind: "eur" | "num" | "pct"; hint?: string };
export type HeroAction = { label: string; href: string; icon?: React.ReactNode; primary?: boolean };

const toneDot = { ok: "bg-ok", warn: "bg-warn", bad: "bg-bad", info: "bg-brand" } as const;

/**
 * The top of every page, always in the same order so anyone knows where to look:
 *   1. what this page is (+ the main buttons)   2. the section assistant (team pages)
 *   3. "Needs you" — or "All done here"          4. the few numbers that matter, each saying what it means
 *   5. the page's visual (mountain, terrain, globe…) in its own card.
 */
export function PageHero({ section, title, subtitle, lines = [], stats = [], actions = [], visual, visualTitle, aside, assistant, corner }: {
  section: { label: string; icon?: React.ReactNode; color?: string };
  title: string;
  subtitle?: string;
  lines?: HeroLine[];
  stats?: HeroStat[];
  actions?: HeroAction[];
  visual?: React.ReactNode;
  /** Short caption above the visual card ("Our climb to €30K") */
  visualTitle?: string;
  /** Extra content under the header (e.g. the team's members) */
  aside?: React.ReactNode;
  /** The section assistant (chat) on team pages */
  assistant?: React.ReactNode;
  /** A control pinned next to the page buttons (e.g. Ask emet) */
  corner?: React.ReactNode;
}) {
  const t = useTranslations("hero");
  const locale = useLocale();
  const color = section.color ?? "var(--brand)";
  const needs = lines.filter((l) => l.tone !== "ok");
  const allOk = lines.length > 0 && needs.length === 0;

  return (
    <div className="fade-in space-y-4 sm:space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pt-1">
        {/* Glass box behind the title block so it reads clearly over the section photo */}
        <div className="panel min-w-0 max-w-3xl px-5 py-4 sm:px-6 sm:py-5">
          <p className="flex items-center gap-2 text-sm font-medium text-muted">
            <span aria-hidden className="grid size-7 place-items-center rounded-lg text-white" style={{ background: color }}>{section.icon}</span>
            {section.label}
          </p>
          <h1 className="display mt-3 text-[clamp(1.65rem,3.2vw,2.4rem)]">{title}</h1>
          {subtitle && <p className="mt-1.5 text-[15px] leading-relaxed text-muted sm:text-base">{subtitle}</p>}
          {aside && <div className="mt-3">{aside}</div>}
        </div>
        {(actions.length > 0 || corner) && (
          <div className="-mx-3 flex w-[calc(100%+1.5rem)] gap-2 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:flex-wrap sm:justify-end sm:px-0">
            {corner}
            {actions.slice(0, 3).map((a, i) => (
              <Link key={a.href + a.label} href={a.href}
                    className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4.5 text-sm font-semibold transition active:scale-[0.97] ${a.primary || (i === 0 && !actions.some((x) => x.primary)) ? "bg-brand text-brand-contrast shadow-[0_8px_20px_-8px_var(--brand)] hover:brightness-110" : "bg-surface text-ink shadow-[var(--shadow)] ring-1 ring-line hover:bg-surface-2"}`}>
                {a.icon}{a.label}
              </Link>
            ))}
          </div>
        )}
      </header>

      {assistant}

      {(lines.length > 0 || visual) && (
        <div className={`grid gap-4 ${visual ? "lg:grid-cols-5" : ""}`}>
          {lines.length > 0 && (allOk ? (
            <p className={`panel flex min-h-14 items-center gap-3 px-5 py-3 text-[15px] ${visual ? "lg:col-span-3 lg:self-start" : ""}`}>
              <CheckCircle2 size={20} className="shrink-0 text-ok" /> <span><span className="font-semibold">{t("allDoneTitle")}</span> <span className="text-muted">{lines[0].text}</span></span>
            </p>
          ) : (
            <section aria-labelledby="needs-you" className={`panel overflow-hidden ${visual ? "lg:col-span-3 lg:self-start" : ""}`}>
              <h2 id="needs-you" className="flex items-center gap-2 px-5 pt-4 pb-2 text-sm font-semibold">
                <span aria-hidden className="size-2 rounded-full bg-warn" /> {t("needsYou")} <span className="font-normal text-muted">· {needs.length}</span>
              </h2>
              <ul className="divide-y divide-line">
                {lines.slice(0, 5).map((l) => {
                  const body = (
                    <>
                      <span aria-hidden className={`size-2 shrink-0 rounded-full ${toneDot[l.tone ?? "info"]}`} />
                      <span className="min-w-0 flex-1 text-[15px]">{l.text}</span>
                      {l.href && <ChevronRight size={17} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />}
                    </>
                  );
                  return (
                    <li key={l.text}>
                      {l.href ? <Link href={l.href} className="group flex min-h-13 items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2/70">{body}</Link>
                        : <p className="flex min-h-13 items-center gap-3 px-5 py-3">{body}</p>}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {visual && (
            <figure className={`panel relative h-64 overflow-hidden sm:h-72 ${lines.length ? "lg:col-span-2 lg:h-auto lg:min-h-[280px]" : "lg:h-80"}`}>
              {visualTitle && <figcaption className="pointer-events-none absolute top-3.5 left-4 z-10 rounded-full bg-surface/85 px-2.5 py-1 text-xs font-medium text-muted backdrop-blur">{visualTitle}</figcaption>}
              {visual}
            </figure>
          )}
        </div>
      )}

      {stats.length > 0 && (
        <dl className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {stats.slice(0, 4).map((s, i) => (
            <div key={s.label} className={`panel flex min-w-0 flex-col gap-2 p-4 sm:p-5 ${stats.length === 3 && i === 2 ? "col-span-2 lg:col-span-1" : ""}`}>
              <dt className="text-[13px] font-medium text-muted">{s.label}</dt>
              <dd className="readout truncate text-[1.75rem] leading-none sm:text-3xl">
                {s.value === null ? "—" : (
                  <NumberTicker value={s.kind === "pct" ? Math.round(s.value * 100) : s.kind === "eur" ? Math.round(s.value) : s.value} locale={locale}
                                decimalPlaces={s.kind === "num" && !Number.isInteger(s.value) ? 1 : 0}
                                options={s.kind === "eur" ? { style: "currency", currency: "EUR", maximumFractionDigits: 0 } : undefined} />
                )}{s.kind === "pct" && s.value !== null ? "%" : ""}
              </dd>
              {s.hint && <dd className="text-xs text-muted">{s.hint}</dd>}
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
