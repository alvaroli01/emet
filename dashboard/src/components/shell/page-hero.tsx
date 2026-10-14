"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { useReducedMotion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { BlurFade as MagicBlurFade } from "@/components/ui/blur-fade";
import { NumberTicker } from "@/components/ui/number-ticker";

export type HeroLine = { text: string; href?: string; tone?: "ok" | "warn" | "bad" | "info" };
export type HeroStat = { label: string; value: number | null; kind: "eur" | "num" | "pct"; hint?: string };
export type HeroAction = { label: string; href: string; icon?: React.ReactNode; primary?: boolean };

/** The hero's one entrance moment; skipped entirely when the device asks for reduced motion. */
function BlurFade({ children, className, ...props }: React.ComponentProps<typeof MagicBlurFade>) {
  const reduce = useReducedMotion();
  return reduce ? <div className={className}>{children}</div> : <MagicBlurFade className={className} {...props}>{children}</MagicBlurFade>;
}

const toneDot = { ok: "bg-ok", warn: "bg-warn", bad: "bg-bad", info: "bg-brand" } as const;

/**
 * The top of every section, as bento tiles: a greeting tile washed in the team's colour (who you are, what needs you
 * here, next actions), one tile per key number, and a tile for the section's visual (mountain, terrain, globe…).
 * Phones stack them: greeting → numbers → visual. The detailed data lives below, in grouped tabs.
 */
export function PageHero({ section, title, subtitle, lines = [], stats = [], actions = [], visual, aside }: {
  section: { label: string; icon?: React.ReactNode; color?: string };
  title: string;
  subtitle?: string;
  lines?: HeroLine[];
  stats?: HeroStat[];
  actions?: HeroAction[];
  visual?: React.ReactNode;
  /** Extra content inside the greeting tile (e.g. the group's members) */
  aside?: React.ReactNode;
}) {
  const locale = useLocale();
  const tint = { "--tile-tint": section.color ?? "var(--brand)" } as React.CSSProperties;
  return (
    <section className="grid gap-3 sm:gap-4 lg:grid-cols-12" style={tint}>
      <BlurFade delay={0.02} offset={8} blur="6px" className={`panel tint relative flex flex-col gap-5 overflow-hidden p-5 sm:p-7 ${visual ? "lg:col-span-7" : "lg:col-span-12"}`}>
        <div aria-hidden className="contours contours-corner pointer-events-none absolute inset-0" />
        <div className="relative">
          <p className="inline-flex items-center gap-2 rounded-full bg-surface/80 py-1 pr-3 pl-1 text-sm font-medium shadow-[var(--shadow)]">
            <span aria-hidden className="grid size-6 place-items-center rounded-full text-sm leading-none text-white" style={{ background: section.color ?? "var(--brand)" }}>{section.icon}</span>
            {section.label}
          </p>
          <h1 className="mt-4 max-w-[24ch] text-[clamp(1.6rem,4.2vw,2.5rem)] leading-[1.08] font-semibold tracking-[-0.03em] text-balance">{title}</h1>
          {subtitle && <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-muted">{subtitle}</p>}
        </div>

        {lines.length > 0 && (
          <ul className="relative divide-y divide-line overflow-hidden rounded-2xl bg-surface/85 shadow-[var(--shadow)] ring-1 ring-line/60">
            {lines.slice(0, 4).map((l) => {
              const body = (
                <>
                  <span aria-hidden className={`size-2 shrink-0 rounded-full ${toneDot[l.tone ?? "info"]}`} />
                  <span className="min-w-0 flex-1 text-[15px]">{l.text}</span>
                  {l.href && <ChevronRight size={16} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />}
                </>
              );
              return (
                <li key={l.text}>
                  {l.href ? <Link href={l.href} className="group flex min-h-12 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2/60">{body}</Link>
                    : <p className="flex min-h-12 items-center gap-3 px-4 py-2.5">{body}</p>}
                </li>
              );
            })}
          </ul>
        )}

        {(actions.length > 0 || aside) && (
          <div className="relative mt-auto space-y-4">
            {actions.length > 0 && (
              // Phones: one swipeable row of buttons instead of a wrapped pile
              <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
                {actions.slice(0, 4).map((a, i) => (
                  <Link key={a.href + a.label} href={a.href}
                        className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium transition active:scale-[0.97] ${a.primary || (i === 0 && !actions.some((x) => x.primary)) ? "bg-brand text-brand-contrast shadow-[0_6px_16px_-6px_color-mix(in_srgb,var(--brand)_60%,transparent)] hover:brightness-110" : "bg-surface text-ink shadow-[var(--shadow)] ring-1 ring-line hover:bg-surface-2"}`}>
                    {a.icon}{a.label}
                  </Link>
                ))}
              </div>
            )}
            {aside}
          </div>
        )}
      </BlurFade>

      {visual && (
        <BlurFade delay={0.1} offset={8} blur="6px" className="panel relative order-last h-60 overflow-hidden sm:h-72 lg:order-none lg:col-span-5 lg:row-span-2 lg:h-auto lg:min-h-[340px]">
          {visual}
        </BlurFade>
      )}

      {stats.length > 0 && (
        <div className={`grid grid-cols-3 gap-3 sm:gap-4 ${visual ? "lg:col-span-7" : "lg:col-span-12"}`}>
          {stats.slice(0, 3).map((s, i) => (
            <BlurFade key={s.label} delay={0.16 + i * 0.05} offset={8} blur="6px" className="panel flex min-w-0 flex-col justify-between gap-2 p-3.5 sm:p-5">
              <p className="line-clamp-2 text-xs leading-snug text-muted sm:text-sm">{s.label}</p>
              <div>
                <p className="readout truncate text-xl leading-none sm:text-3xl">
                  {s.value === null ? "—" : (
                    <NumberTicker value={s.kind === "pct" ? Math.round(s.value * 100) : s.kind === "eur" ? Math.round(s.value) : s.value} locale={locale}
                                  decimalPlaces={s.kind === "num" && !Number.isInteger(s.value) ? 1 : 0}
                                  options={s.kind === "eur" ? { style: "currency", currency: "EUR", maximumFractionDigits: 0 } : undefined} />
                  )}{s.kind === "pct" && s.value !== null ? "%" : ""}
                </p>
                {s.hint && <p className="mt-1.5 truncate text-xs text-muted">{s.hint}</p>}
              </div>
            </BlurFade>
          ))}
        </div>
      )}
    </section>
  );
}
