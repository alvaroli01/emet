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
    <header className={`sticky top-0 z-20 flex h-16 items-center gap-3 px-3 sm:px-4 lg:px-6 ${clear ? "" : "border-b border-line bg-bg/55 backdrop-blur-2xl"}`}>
      {children}
    </header>
  );
}

/** Today's full-screen backdrop: Bilbao at night (photo: Adrian Villa, Unsplash License), darkened for legibility. */
export function Backdrop() {
  const path = usePathname();
  if (path !== "/today") return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative full-screen backdrop */}
      <img src="/img/bilbao-night.jpg" alt="" className="size-full object-cover object-[60%_40%]" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_10%,transparent_0%,rgb(8_8_10/0.55)_55%,rgb(8_8_10/0.92)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#08080a] via-[#08080a]/70 to-transparent" />
    </div>
  );
}

/** Hides its children on Today (which has its own big ask box and search pill). */
export function NotOnToday({ children }: { children: React.ReactNode }) {
  return usePathname() === "/today" ? null : <>{children}</>;
}
