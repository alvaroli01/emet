"use client";

import { useMemo } from "react";
import { useLocale } from "next-intl";
import { Mic } from "lucide-react";
import { TerrainLazy } from "@/components/summit/mountain-lazy";
import { IconCloud } from "@/components/ui/icon-cloud";
import { OrbitingCircles } from "@/components/ui/orbiting-circles";
import { AnimatedCircularProgressBar } from "@/components/ui/animated-circular-progress-bar";
import { Ripple } from "@/components/ui/ripple";
import { eur, num } from "@/lib/format";

type Person = { id: string; full_name: string; avatar_url: string | null };

/** Weekly numbers as 3D columns on a contour plate (drag to turn, hover to read). */
export function HeroTerrain({ points, kind, ariaLabel, caption }: { points: { label: string; value: number }[]; kind: "eur" | "num"; ariaLabel: string; caption?: string }) {
  const locale = useLocale();
  const format = useMemo(() => (v: number) => (kind === "eur" ? eur(v, locale) : num(v, locale)), [kind, locale]);
  return (
    <>
      <TerrainLazy points={points} format={format} ariaLabel={ariaLabel} className="size-full" />
      {caption && <p className="pointer-events-none absolute bottom-3 left-4 text-xs text-muted">{caption}</p>}
    </>
  );
}

/** Initials avatar as an image, for the 3D team sphere (no network, works offline). */
function initialsImage(name: string, i: number) {
  const inks = ["#2b6ca3", "#c9502e", "#2f8a5a", "#a9845c", "#6b5ca5", "#1a201c"];
  const ini = name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="40" cy="40" r="40" fill="${inks[i % inks.length]}"/><text x="40" y="51" font-family="Arial,sans-serif" font-size="30" font-weight="700" fill="#fbfbf8" text-anchor="middle">${ini}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** The whole team as a 3D sphere you can spin. */
export function TeamSphere({ people }: { people: Person[] }) {
  const images = useMemo(() => people.map((p, i) => p.avatar_url || initialsImage(p.full_name, i)), [people]);
  return <div className="grid size-full place-items-center p-4 [&_canvas]:max-h-full [&_canvas]:max-w-full"><IconCloud images={images} /></div>;
}

/** A group's people orbiting its emoji: who is in this section, at a glance. */
export function MemberOrbit({ emoji, people, color }: { emoji: string; people: Person[]; color: string }) {
  const inner = people.slice(0, 4), outer = people.slice(4, 10);
  const face = (p: Person, i: number) => (
    <span key={p.id} title={p.full_name} className="grid size-full place-items-center overflow-hidden rounded-full border-2 border-surface text-[11px] font-semibold text-brand-contrast shadow-sm"
          style={{ background: ["#2b6ca3", "#c9502e", "#2f8a5a", "#a9845c", "#6b5ca5", "#1a201c"][i % 6] }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny avatar inside an animated orbit */}
      {p.avatar_url ? <img src={p.avatar_url} alt="" className="size-full object-cover" /> : p.full_name.split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase()}
    </span>
  );
  return (
    <div className="relative flex size-full items-center justify-center overflow-hidden">
      <span aria-hidden className="z-10 grid size-16 place-items-center rounded-2xl text-3xl shadow-sm" style={{ background: `color-mix(in srgb, ${color} 18%, var(--surface))` }}>{emoji}</span>
      {inner.length > 0 && <OrbitingCircles iconSize={36} radius={70} speed={0.6}>{inner.map(face)}</OrbitingCircles>}
      {outer.length > 0 && <OrbitingCircles iconSize={30} radius={118} reverse speed={0.4}>{outer.map((p, i) => face(p, i + 4))}</OrbitingCircles>}
    </div>
  );
}

/** A big progress ring (e.g. tasks done this week) with its label inside. */
export function ProgressRing({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <div className="relative grid size-full place-items-center overflow-hidden">
      <div aria-hidden className="contours absolute inset-0 opacity-50" />
      <div className="relative">
        <AnimatedCircularProgressBar value={max ? Math.round((value / max) * 100) : 0} max={100} min={0}
                                     gaugePrimaryColor="var(--climbed)" gaugeSecondaryColor="var(--surface-2)" className="size-40 text-3xl font-semibold" />
        <p className="mt-2 text-center text-xs text-muted">{label}</p>
      </div>
    </div>
  );
}

/** Recording rings around a mic: the Meeting log's visual. */
export function MicRipple() {
  return (
    <div className="relative size-full overflow-hidden">
      <Ripple mainCircleSize={120} numCircles={6} mainCircleOpacity={0.18} />
      <span aria-hidden className="absolute top-1/2 left-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-trail text-white shadow-lg"><Mic size={26} /></span>
    </div>
  );
}

/** The team's best ideas orbiting a lightbulb, each showing its score. */
export function IdeaOrbit({ ideas }: { ideas: { id: string; title: string; score: number | null }[] }) {
  const tone = (x: number | null) => (x === null ? "var(--muted)" : x >= 75 ? "var(--ok)" : x >= 60 ? "var(--climbed)" : x >= 45 ? "var(--warn)" : "var(--bad)");
  const chip = (i: { id: string; title: string; score: number | null }) => (
    <span key={i.id} title={i.title} className="grid size-full place-items-center rounded-full border-2 border-surface text-xs font-semibold text-white shadow-sm" style={{ background: tone(i.score) }}>{i.score ?? "?"}</span>
  );
  const inner = ideas.slice(0, 5), outer = ideas.slice(5, 11);
  return (
    <div className="relative flex size-full items-center justify-center overflow-hidden">
      <span aria-hidden className="z-10 grid size-16 place-items-center rounded-full bg-[color-mix(in_srgb,var(--warn)_25%,var(--surface))] text-3xl shadow-sm">💡</span>
      {inner.length > 0 && <OrbitingCircles iconSize={36} radius={72} speed={0.5}>{inner.map(chip)}</OrbitingCircles>}
      {outer.length > 0 && <OrbitingCircles iconSize={30} radius={120} reverse speed={0.35}>{outer.map(chip)}</OrbitingCircles>}
    </div>
  );
}
