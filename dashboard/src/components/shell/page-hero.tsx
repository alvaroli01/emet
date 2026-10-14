"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { useReducedMotion } from "motion/react";
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

const toneDot = { ok: "bg-ok", warn: "bg-warn", bad: "bg-bad", info: "bg-climbed" } as const;

/**
 * The top of every section: who you are, what needs you here today, the few numbers that matter,
 * the next actions — and one visual for the section (mountain, terrain, globe, team sphere…).
 * The section's detailed data lives below it, in grouped tabs.
 */
export function PageHero({ section, title, subtitle, lines = [], stats = [], actions = [], visual, aside }: {
  section: { label: string; icon?: React.ReactNode; color?: string };
  title: string;
  subtitle?: string;
  lines?: HeroLine[];
  stats?: HeroStat[];
  actions?: HeroAction[];
  visual?: React.ReactNode;
  /** Extra content under the actions (e.g. the group's members) */
  aside?: React.ReactNode;
}) {
  const locale = useLocale();
  return (
    <section className="panel relative grid overflow-hidden lg:min-h-[300px] lg:grid-cols-[minmax(0,1fr)_minmax(0,44%)]">
      <div aria-hidden className="contours contours-corner pointer-events-none absolute inset-0 opacity-70" />
      <div className="relative z-10 flex flex-col gap-5 p-5 sm:p-7">
        <BlurFade delay={0.02} offset={6} blur="4px">
          <p className="flex items-center gap-2 text-sm text-muted">
            {section.icon && <span aria-hidden className="grid size-7 place-items-center rounded-lg text-base leading-none" style={{ background: section.color ? `color-mix(in srgb, ${section.color} 16%, transparent)` : "var(--surface-2)" }}>{section.icon}</span>}
            {section.label}
          </p>
          <h1 className="mt-3 max-w-[22ch] text-[clamp(1.7rem,3.4vw,2.6rem)] leading-[1.06] font-[650] tracking-[-0.02em] text-balance" style={{ fontStretch: "112%" }}>{title}</h1>
          {subtitle && <p className="mt-2 max-w-prose text-[15px] text-muted">{subtitle}</p>}
        </BlurFade>

        {lines.length > 0 && (
          <BlurFade delay={0.12} offset={6} blur="4px">
            <ul className="space-y-1.5">
              {lines.slice(0, 4).map((l) => {
                const body = <><span aria-hidden className={`mt-[7px] size-2 shrink-0 rounded-full ${toneDot[l.tone ?? "info"]}`} /><span>{l.text}</span></>;
                return (
                  <li key={l.text}>
                    {l.href ? <Link href={l.href} className="group flex gap-2.5 text-[15px] hover:underline hover:decoration-line hover:underline-offset-4">{body}</Link>
                      : <p className="flex gap-2.5 text-[15px]">{body}</p>}
                  </li>
                );
              })}
            </ul>
          </BlurFade>
        )}

        {stats.length > 0 && (
          <BlurFade delay={0.2} offset={6} blur="4px">
            <dl className="flex flex-wrap gap-x-7 gap-y-3">
              {stats.map((s) => (
                <div key={s.label} className="min-w-0">
                  <dt className="text-xs text-muted">{s.label}</dt>
                  <dd className="readout text-2xl leading-tight">
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
          </BlurFade>
        )}

        {(actions.length > 0 || aside) && (
          <BlurFade delay={0.28} offset={6} blur="4px" className="mt-auto space-y-4">
            {actions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {actions.slice(0, 4).map((a) => (
                  <Link key={a.href + a.label} href={a.href}
                        className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition ${a.primary ? "bg-ink text-brand-contrast hover:opacity-90" : "bg-surface-2 hover:bg-line"}`}>
                    {a.icon}{a.label}
                  </Link>
                ))}
              </div>
            )}
            {aside}
          </BlurFade>
        )}
      </div>

      {visual && (
        <div className="relative order-first h-52 border-b border-line sm:h-64 lg:order-none lg:h-auto lg:border-b-0 lg:border-l">
          {visual}
        </div>
      )}
    </section>
  );
}
