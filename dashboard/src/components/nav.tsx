"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { LayoutDashboard, KanbanSquare, CheckSquare, Users, Menu, X } from "lucide-react";
import type { Group } from "@/lib/session";

type Props = { groups: Group[]; myGroupId: string | null };

function useItems({ groups, myGroupId }: Props) {
  const t = useTranslations("nav");
  const tg = useTranslations("group.names");
  const top = [
    { href: "/", label: t("overview"), icon: <LayoutDashboard size={17} /> },
    { href: "/board", label: t("generalBoard"), icon: <KanbanSquare size={17} />, emoji: "🏢" },
  ];
  const groupItems = groups.map((g) => ({
    href: `/g/${g.slug}`,
    label: tg(g.slug),
    emoji: g.emoji,
    color: g.color,
    mine: g.id === myGroupId,
  }));
  const bottom = [
    { href: "/my-tasks", label: t("myTasks"), icon: <CheckSquare size={17} /> },
    { href: "/team", label: t("team"), icon: <Users size={17} /> },
  ];
  return { top, groupItems, bottom, t };
}

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
}

function NavLink({ href, active, children, onClick }: {
  href: string; active: boolean; children: React.ReactNode; onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ${
        active ? "bg-surface-2 font-medium text-ink" : "text-muted hover:bg-surface-2/60 hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

function NavList(props: Props & { onNavigate?: () => void }) {
  const path = usePathname();
  const { top, groupItems, bottom, t } = useItems(props);
  return (
    <nav className="flex flex-col gap-0.5">
      {top.map((i) => (
        <NavLink key={i.href} href={i.href} active={isActive(path, i.href)} onClick={props.onNavigate}>
          {i.icon}
          <span>{i.label}</span>
        </NavLink>
      ))}
      <p className="mt-5 mb-1 px-2.5 text-[11px] font-medium uppercase tracking-wider text-muted">{t("groups")}</p>
      {groupItems.map((i) => (
        <NavLink key={i.href} href={i.href} active={isActive(path, i.href)} onClick={props.onNavigate}>
          <span className="grid size-[17px] place-items-center text-[14px] leading-none">{i.emoji}</span>
          <span className="flex-1">{i.label}</span>
          {i.mine && (
            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ background: `${i.color}22`, color: i.color }}>
              {t("yourTeam")}
            </span>
          )}
        </NavLink>
      ))}
      <div className="my-4 h-px bg-line" />
      {bottom.map((i) => (
        <NavLink key={i.href} href={i.href} active={isActive(path, i.href)} onClick={props.onNavigate}>
          {i.icon}
          <span>{i.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

/** Desktop: fixed left sidebar */
export function Sidebar(props: Props) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface px-3 py-4 lg:flex">
      <Link href="/" className="mb-6 flex items-center gap-2 px-2.5">
        <span className="grid size-7 place-items-center rounded-lg bg-brand text-sm font-semibold text-brand-contrast">e</span>
        <span className="font-semibold tracking-tight">emet HQ</span>
      </Link>
      <NavList {...props} />
    </aside>
  );
}

/** Mobile: bottom bar with the 4 most-used places + "More" for everything else */
export function BottomNav(props: Props) {
  const t = useTranslations("nav");
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const myGroup = props.groups.find((g) => g.id === props.myGroupId);
  const items = [
    { href: "/", label: t("overview"), icon: <LayoutDashboard size={20} /> },
    { href: "/board", label: t("board"), icon: <KanbanSquare size={20} /> },
    myGroup
      ? { href: `/g/${myGroup.slug}`, label: t("myTeam"), icon: <span className="text-lg leading-none">{myGroup.emoji}</span> }
      : { href: "/team", label: t("team"), icon: <Users size={20} /> },
    { href: "/my-tasks", label: t("myTasks"), icon: <CheckSquare size={20} /> },
  ];

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {items.map((i) => (
          <Link key={i.href} href={i.href}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${isActive(path, i.href) ? "text-ink" : "text-muted"}`}>
            {i.icon}
            <span className="truncate">{i.label}</span>
          </Link>
        ))}
        <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted">
          <Menu size={20} />
          <span>{t("more")}</span>
        </button>
      </nav>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button aria-label={t("close")} onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-semibold">emet HQ</span>
              <button onClick={() => setOpen(false)} aria-label={t("close")} className="rounded-lg p-1.5 hover:bg-surface-2">
                <X size={18} />
              </button>
            </div>
            <NavList {...props} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
