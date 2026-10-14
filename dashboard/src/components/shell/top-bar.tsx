"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogoMark } from "@/components/summit/logo";

/** "emet / Finance" — where you are, in the top bar (hidden on Today, which has its own greeting). */
export function Breadcrumb() {
  const path = usePathname();
  const t = useTranslations("nav");
  const tg = useTranslations("group.names");
  if (path === "/today") return null;
  const seg = path.split("/").filter(Boolean);
  const page = !seg.length ? t("overview")
    : seg[0] === "g" && seg[1] ? (tg.has(seg[1]) ? tg(seg[1]) : seg[1])
    : ({ camp: t("camp"), board: t("generalBoard"), lab: t("lab"), scout: t("scout"), meetings: t("meetings"), team: t("team"), "my-tasks": t("myTasks") } as Record<string, string>)[seg[0]] ?? seg[0];
  return (
    <p className="hidden items-center gap-1.5 text-sm md:flex">
      <Link href="/today" className="text-muted hover:text-ink">emet</Link>
      <span className="text-muted">/</span>
      <span className="font-medium">{page}</span>
    </p>
  );
}

/** Phone: logo on the left of the top bar. */
export function MobileLogo() {
  return <span className="flex items-center gap-2 font-semibold tracking-tight md:hidden"><LogoMark size={28} /> emet</span>;
}

/** On Today the bar floats transparently over the Bilbao photo; elsewhere it is a glass strip. */
export function TopBarFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const clear = path === "/today";
  return (
    <header className={`sticky top-0 z-20 flex h-16 items-center gap-3 px-3 sm:px-4 lg:px-6 ${clear ? "force-dark" : "border-b border-line bg-bg/80 backdrop-blur-2xl"}`}>
      {children}
    </header>
  );
}

/**
 * Every page sits on a dark photo that fits what the section is about, like Today's Bilbao at night.
 * All photos are free under the Unsplash License (credits in README → Systems → Dashboard look).
 */
const PHOTOS: [RegExp, string][] = [
  [/^\/today/, "/img/bilbao-night.jpg"],
  [/^\/camp/, "/img/sections/camp.jpg"],
  [/^\/team/, "/img/sections/team.jpg"],
  [/^\/g\/team-leader/, "/img/sections/team-leader.jpg"],
  [/^\/g\/finance/, "/img/sections/finance.jpg"],
  [/^\/g\/customer/, "/img/sections/customer.jpg"],
  [/^\/g\/marketing/, "/img/sections/marketing.jpg"],
  [/^\/g\/communications/, "/img/sections/communications.jpg"],
  [/^\/(board|my-tasks)/, "/img/sections/board.jpg"],
  [/^\/lab/, "/img/sections/lab.jpg"],
  [/^\/meetings/, "/img/sections/meetings.jpg"],
  [/^\/scout/, "/img/sections/scout.jpg"],
  [/^\/$/, "/img/sections/overview.jpg"],
];

export function Backdrop() {
  const path = usePathname();
  const src = PHOTOS.find(([re]) => re.test(path))?.[1];
  if (!src) return null;
  const today = path === "/today";
  // Finance is all numbers and charts: its photo is softened and darker so nothing competes with them
  const calm = path.startsWith("/g/finance");
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative full-screen backdrop */}
      <img key={src} src={src} alt="" decoding="async" className={`size-full object-cover ${today ? "object-[60%_40%]" : "object-center"} ${calm ? "scale-105 blur-[6px]" : ""}`} />
      {today ? (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_10%,transparent_0%,rgb(8_8_10/0.55)_55%,rgb(8_8_10/0.92)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#08080a] via-[#08080a]/70 to-transparent" />
        </>
      ) : (
        // Work pages hold more text, so the photo is dimmer and fades out further down the page
        <div className={`absolute inset-0 ${calm ? "bg-[linear-gradient(180deg,rgb(var(--shade)/0.55)_0%,rgb(var(--shade)/0.78)_50%,rgb(var(--shade)/0.94)_100%)]" : "bg-[linear-gradient(180deg,rgb(var(--shade)/0.3)_0%,rgb(var(--shade)/0.62)_50%,rgb(var(--shade)/0.9)_100%)]"}`} />
      )}
    </div>
  );
}

/** Hides its children on Today (which has its own big ask box and search pill). */
export function NotOnToday({ children }: { children: React.ReactNode }) {
  return usePathname() === "/today" ? null : <>{children}</>;
}
