"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { LayoutDashboard, KanbanSquare, CheckSquare, Users, Menu, X, Tent, AudioLines, Lightbulb, Sun, Radar, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { Group } from "@/lib/session";
import { LogoMark } from "@/components/summit/logo";
import { Dock, DockIcon } from "@/components/ui/dock";

type Props = { groups: Group[]; myGroupId: string | null };
type Item = { href: string; label: string; icon: React.ReactNode; color?: string; mine?: boolean };

/** The menu in three groups: your workspace, the five teams, and shared tools. */
function useSections({ groups, myGroupId }: Props) {
  const t = useTranslations("nav");
  const tg = useTranslations("group.names");
  const sections: { key: string; label: string; items: Item[] }[] = [
    { key: "workspace", label: t("sectionWorkspace"), items: [
      { href: "/today", label: t("today"), icon: <Sun size={18} /> },
      { href: "/", label: t("overview"), icon: <LayoutDashboard size={18} /> },
      { href: "/camp", label: t("camp"), icon: <Tent size={18} /> },
      { href: "/my-tasks", label: t("myTasks"), icon: <CheckSquare size={18} /> },
    ] },
    { key: "teams", label: t("groups"), items: groups.map((g) => ({
      href: `/g/${g.slug}`, label: tg(g.slug), color: g.color, mine: g.id === myGroupId,
      icon: <span className="grid size-[18px] place-items-center text-[15px] leading-none">{g.emoji}</span>,
    })) },
    { key: "tools", label: t("sectionTools"), items: [
      { href: "/board", label: t("generalBoard"), icon: <KanbanSquare size={18} /> },
      { href: "/lab", label: t("lab"), icon: <Lightbulb size={18} /> },
      { href: "/scout", label: t("scout"), icon: <Radar size={18} /> },
      { href: "/meetings", label: t("meetings"), icon: <AudioLines size={18} /> },
      { href: "/team", label: t("team"), icon: <Users size={18} /> },
    ] },
  ];
  return { sections, t };
}

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
}

function NavList({ collapsed = false, onNavigate, ...props }: Props & { collapsed?: boolean; onNavigate?: () => void }) {
  const path = usePathname();
  const { sections, t } = useSections(props);
  return (
    <nav className="flex flex-col gap-5">
      {sections.map((s) => (
        <div key={s.key}>
          {collapsed ? <div className="mx-auto mb-2 h-px w-6 bg-line" /> : <p className="mb-1.5 px-3 text-xs font-medium text-muted">{s.label}</p>}
          <ul className="flex flex-col gap-0.5">
            {s.items.map((i) => {
              const active = isActive(path, i.href);
              return (
                <li key={i.href}>
                  <Link href={i.href} onClick={onNavigate} aria-current={active ? "page" : undefined} title={collapsed ? i.label : undefined}
                        className={`group relative flex items-center gap-3 rounded-xl py-2 text-sm transition-colors ${collapsed ? "justify-center px-0" : "px-3"} ${
                          active ? "bg-ink text-brand-contrast" : "text-muted hover:bg-surface-2 hover:text-ink"}`}>
                    {i.icon}
                    {!collapsed && <span className="flex-1 truncate">{i.label}</span>}
                    {!collapsed && i.mine && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${active ? "bg-white/15" : "bg-surface-2 text-ink"}`}>
                        <span aria-hidden className="size-1.5 rounded-full" style={{ background: i.color }} />{t("yourTeam")}
                      </span>
                    )}
                    {collapsed && i.mine && <span aria-hidden className="absolute top-1.5 right-2 size-1.5 rounded-full" style={{ background: i.color }} />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Desktop: left sidebar, collapsible to an icon rail (remembered on this device). */
export function Sidebar(props: Props) {
  const t = useTranslations("nav");
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { try { setCollapsed(localStorage.getItem("emet-nav") === "rail"); } catch { /* private mode */ } }, []);
  const toggle = () => { setCollapsed((c) => { try { localStorage.setItem("emet-nav", c ? "full" : "rail"); } catch { /* ignore */ } return !c; }); };
  return (
    <aside className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface py-4 transition-[width] duration-200 lg:flex ${collapsed ? "w-[72px] px-2.5" : "w-64 px-3"}`}>
      <div className={`mb-6 flex items-center ${collapsed ? "flex-col gap-3" : "justify-between px-2"}`}>
        <Link href="/today" className="flex items-center gap-2.5">
          <LogoMark />
          {!collapsed && <span className="font-semibold tracking-tight" style={{ fontStretch: "112%" }}>emet HQ</span>}
        </Link>
        <button onClick={toggle} aria-label={collapsed ? t("expand") : t("collapse")} title={collapsed ? t("expand") : t("collapse")} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-ink">
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
      </div>
      <div className="-mx-1 flex-1 overflow-y-auto px-1 [scrollbar-width:thin]">
        <NavList {...props} collapsed={collapsed} />
      </div>
    </aside>
  );
}

/** Phone: a floating dock with the 4 most-used places + "More" for everything else. */
export function BottomNav(props: Props) {
  const t = useTranslations("nav");
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const myGroup = props.groups.find((g) => g.id === props.myGroupId);
  const items = [
    { href: "/today", label: t("today"), icon: <Sun size={20} /> },
    { href: "/board", label: t("board"), icon: <KanbanSquare size={20} /> },
    myGroup
      ? { href: `/g/${myGroup.slug}`, label: t("myTeam"), icon: <span className="text-lg leading-none">{myGroup.emoji}</span> }
      : { href: "/team", label: t("team"), icon: <Users size={20} /> },
    { href: "/camp", label: t("camp"), icon: <Tent size={20} /> },
  ];

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center pb-[calc(0.6rem+env(safe-area-inset-bottom))] lg:hidden">
        <Dock disableMagnification iconSize={58} className="pointer-events-auto mt-0 h-[66px] gap-1 border-line bg-surface/90 p-1.5 shadow-[var(--shadow-lift)]">
          {items.map((i) => {
            const active = isActive(path, i.href);
            return (
              <DockIcon key={i.href} className="rounded-xl p-0">
                <Link href={i.href} aria-current={active ? "page" : undefined}
                      className={`flex size-full flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] transition-colors ${active ? "bg-ink font-medium text-brand-contrast" : "text-muted"}`}>
                  {i.icon}<span className="max-w-full truncate px-0.5">{i.label}</span>
                </Link>
              </DockIcon>
            );
          })}
          <DockIcon className="rounded-xl p-0">
            <button onClick={() => setOpen(true)} className="flex size-full flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] text-muted">
              <Menu size={20} /><span>{t("more")}</span>
            </button>
          </DockIcon>
        </Dock>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button aria-label={t("close")} onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2 font-semibold"><LogoMark size={24} /> emet HQ</span>
              <button onClick={() => setOpen(false)} aria-label={t("close")} className="rounded-lg p-1.5 hover:bg-surface-2"><X size={18} /></button>
            </div>
            <NavList {...props} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
