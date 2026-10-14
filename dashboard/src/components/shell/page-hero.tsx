"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { BlurFade as MagicBlurFade } from "@/components/ui/blur-fade";
import { NumberTicker } from "@/components/ui/number-ticker";
import { IoArt, type ShapeName } from "./io-art";

export type HeroLine = { text: string; href?: string; tone?: "ok" | "warn" | "bad" | "info" };
export type HeroStat = { label: string; value: number | null; kind: "eur" | "num" | "pct"; hint?: string };
export type HeroAction = { label: string; href: string; icon?: React.ReactNode; primary?: boolean };

/** The hero's one entrance moment; skipped entirely when the device asks for reduced motion. */
function BlurFade({ children, className, ...props }: React.ComponentProps<typeof MagicBlurFade>) {
  // Same element tree on server and client (no hydration mismatch); reduced motion just makes it instant
  const reduce = useReducedMotion();
  return <MagicBlurFade className={className} {...props} {...(reduce ? { duration: 0, delay: 0, offset: 0, blur: "0px" } : {})}>{children}</MagicBlurFade>;
}

const toneDot = { ok: "bg-ok", warn: "bg-warn", bad: "bg-bad", info: "bg-trail" } as const;

/**
 * The top of every section, in the Google I/O style: a centred team chip, a huge personal headline,
 * then either the section's AI assistant (team pages) or link cards with what needs you, the next actions,
 * and below them a wide tile for the section's 3D visual next to its key numbers.
 */
export function PageHero({ section, title, subtitle, lines = [], stats = [], actions = [], visual, aside, assistant, corner, art = ["sparkle", "globe", "coin", "cloud"] }: {
  section: { label: string; icon?: React.ReactNode; color?: string };
  title: string;
  subtitle?: string;
  lines?: HeroLine[];
  stats?: HeroStat[];
  actions?: HeroAction[];
  visual?: React.ReactNode;
  /** Extra content under the actions (e.g. the group's members) */
  aside?: React.ReactNode;
  /** The section assistant (chat) — replaces the link cards and buttons when present */
  assistant?: React.ReactNode;
  /** Small control pinned to the top-right corner (e.g. Ask emet on Today) */
  corner?: React.ReactNode;
  /** The glossy I/O shapes floating behind the headline */
  art?: ShapeName[];
}) {
  const locale = useLocale();
  const color = section.color ?? "var(--trail)";
  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="relative isolate px-1 pt-6 text-center sm:pt-12" style={{ "--tile-tint": color } as React.CSSProperties}>
        {/* A soft glow of the team's colour behind the headline */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-10 -z-10 mx-auto h-72 max-w-3xl rounded-full opacity-25 blur-3xl" style={{ background: `radial-gradient(closest-side, ${color}, transparent)` }} />
        {corner && <div className="absolute top-0 right-0">{corner}</div>}
        <BlurFade delay={0.02} offset={10} blur="8px" className="relative isolate py-2 sm:py-6">
          <IoArt shapes={art} className="-inset-x-4 sm:-inset-x-10" />
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 py-1 pr-3.5 pl-1 text-sm font-medium backdrop-blur">
            <span aria-hidden className="grid size-6 place-items-center rounded-full text-sm leading-none text-white" style={{ background: color }}>{section.icon}</span>
            {section.label}
          </p>
          <h1 className="display mx-auto mt-5 max-w-[17ch] text-[clamp(2.4rem,8vw,5.5rem)] [text-shadow:0_2px_30px_var(--bg)]">{title}</h1>
          {subtitle && <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">{subtitle}</p>}
        </BlurFade>

        {assistant && <BlurFade delay={0.12} offset={10} blur="8px" className="mx-auto mt-7 max-w-2xl text-left sm:mt-9">{assistant}</BlurFade>}

        {!assistant && actions.length > 0 && (
          <BlurFade delay={0.14} offset={10} blur="8px" className="-mx-3 mt-7 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0">
            {actions.slice(0, 4).map((a, i) => (
              <Link key={a.href + a.label} href={a.href}
                    className={`inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full px-6 text-[15px] font-medium transition active:scale-[0.97] ${a.primary || (i === 0 && !actions.some((x) => x.primary)) ? "bg-brand text-brand-contrast hover:brightness-110" : "border border-line bg-surface text-ink hover:border-muted"}`}>
                {a.icon}{a.label}
              </Link>
            ))}
          </BlurFade>
        )}

        {!assistant && lines.length > 0 && (
          <BlurFade delay={0.2} offset={10} blur="8px" className="mx-auto mt-7 grid max-w-3xl gap-3 text-left sm:grid-cols-2">
            {lines.slice(0, 4).map((l) => {
              const body = (
                <>
                  <span aria-hidden className={`size-2 shrink-0 rounded-full ${toneDot[l.tone ?? "info"]}`} />
                  <span className="min-w-0 flex-1 text-[15px] leading-snug">{l.text}</span>
                  {l.href && <ArrowRight size={18} className="shrink-0 text-muted transition-transform group-hover:translate-x-1 group-hover:text-ink" />}
                </>
              );
              return l.href
                ? <Link key={l.text} href={l.href} className="group panel panel-lift flex min-h-14 items-center gap-3 px-5 py-3.5">{body}</Link>
                : <p key={l.text} className="panel flex min-h-14 items-center gap-3 px-5 py-3.5">{body}</p>;
            })}
          </BlurFade>
        )}
        {aside && <div className="mx-auto mt-5 flex max-w-3xl justify-center">{aside}</div>}
      </section>

      {(visual || stats.length > 0) && (
        <BlurFade delay={0.26} offset={10} blur="8px" className={`grid gap-3 sm:gap-4 ${visual && stats.length ? "lg:grid-cols-3" : ""}`}>
          {visual && <div className="panel relative h-64 overflow-hidden sm:h-80 lg:col-span-2 lg:h-[380px]">{visual}</div>}
          {stats.length > 0 && (
            <div className={`grid grid-cols-3 gap-3 sm:gap-4 ${visual ? "lg:grid-cols-1" : ""}`}>
              {stats.slice(0, 3).map((s) => (
                <div key={s.label} className="panel flex min-w-0 flex-col justify-between gap-2 p-4 sm:p-5">
                  <p className="line-clamp-2 text-xs leading-snug text-muted sm:text-sm">{s.label}</p>
                  <div>
                    <p className="readout truncate text-2xl leading-none sm:text-4xl">
                      {s.value === null ? "—" : (
                        <NumberTicker value={s.kind === "pct" ? Math.round(s.value * 100) : s.kind === "eur" ? Math.round(s.value) : s.value} locale={locale}
                                      decimalPlaces={s.kind === "num" && !Number.isInteger(s.value) ? 1 : 0}
                                      options={s.kind === "eur" ? { style: "currency", currency: "EUR", maximumFractionDigits: 0 } : undefined} />
                      )}{s.kind === "pct" && s.value !== null ? "%" : ""}
                    </p>
                    {s.hint && <p className="mt-1.5 truncate text-xs text-muted">{s.hint}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </BlurFade>
      )}
    </div>
  );
}
