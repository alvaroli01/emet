"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { LayoutDashboard, KanbanSquare, CheckSquare, Users, Menu, X, Tent, AudioLines, Lightbulb, Sun, Radar, ChevronDown, ChevronsLeft, ChevronsRight, Sparkles, FolderKanban } from "lucide-react";
import type { Group } from "@/lib/session";
import { LogoMark } from "@/components/summit/logo";
import { GroupIcon } from "@/components/group-icon";

type Props = { groups: Group[]; myGroupId: string | null };
type Item = { href: string; label: string; icon: React.ReactNode; color?: string; mine?: boolean };

/** The menu in three folding groups (like a file tree): your space, the five teams, shared tools. */
function useSections({ groups, myGroupId }: Props) {
  const t = useTranslations("nav");
  const tg = useTranslations("group.names");
  const sections: { key: string; label: string; items: Item[] }[] = [
    { key: "main", label: t("sectionWorkspace"), items: [
      { href: "/today", label: t("today"), icon: <Sun size={17} /> },
      { href: "/", label: t("overview"), icon: <LayoutDashboard size={17} /> },
      { href: "/camp", label: t("camp"), icon: <Tent size={17} /> },
      { href: "/my-tasks", label: t("myTasks"), icon: <CheckSquare size={17} /> },
      { href: "/projects", label: t("projects"), icon: <FolderKanban size={17} /> },
    ] },
    { key: "teams", label: t("groups"), items: groups.map((g) => ({
      href: `/g/${g.slug}`, label: tg(g.slug), color: g.color, mine: g.id === myGroupId, icon: <GroupIcon slug={g.slug} size={17} />,
    })) },
    { key: "tools", label: t("sectionTools"), items: [
      { href: "/board", label: t("generalBoard"), icon: <KanbanSquare size={17} /> },
      { href: "/lab", label: t("lab"), icon: <Lightbulb size={17} /> },
      { href: "/scout", label: t("scout"), icon: <Radar size={17} /> },
      { href: "/meetings", label: t("meetings"), icon: <AudioLines size={17} /> },
      { href: "/team", label: t("team"), icon: <Users size={17} /> },
    ] },
  ];
  return { sections, t };
}

export function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
}

function Tree({ onNavigate, ...props }: Props & { onNavigate?: () => void }) {
  const path = usePathname();
  const { sections, t } = useSections(props);
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  return (
    <nav className="space-y-4">
      {sections.map((s) => (
        <div key={s.key}>
          <button onClick={() => setClosed((c) => ({ ...c, [s.key]: !c[s.key] }))} aria-expanded={!closed[s.key]}
                  className="flex w-full items-center justify-between px-2 py-1 text-[11px] font-medium tracking-[0.08em] text-muted uppercase hover:text-ink">
            {s.label}<ChevronDown size={14} className={`transition-transform ${closed[s.key] ? "-rotate-90" : ""}`} />
          </button>
          {!closed[s.key] && (
            <ul className="relative mt-1 ml-3 space-y-0.5 border-l border-line pl-2.5">
              {s.items.map((i) => {
                const active = isActive(path, i.href);
                return (
                  <li key={i.href} className="relative">
                    <span aria-hidden className="absolute top-1/2 -left-2.5 h-px w-2 bg-line" />
                    <Link href={i.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
                          className={`flex min-h-10 items-center gap-2.5 rounded-xl px-2.5 text-sm transition ${active ? "glass-pill font-medium text-ink" : "text-muted hover:bg-surface-2 hover:text-ink"}`}>
                      <span style={i.color && active ? { color: i.color } : undefined} className={!i.color && active ? "text-brand" : ""}>{i.icon}</span>
                      <span className="flex-1 truncate">{i.label}</span>
                      {i.mine && <span aria-hidden title={t("yourTeam")} className="size-1.5 rounded-full" style={{ background: i.color }} />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </nav>
  );
}

/** Round glass icon buttons — the compact menu used on Today (over the Bilbao photo) and when collapsed. */
function Rail(props: Props) {
  const path = usePathname();
  const { sections } = useSections(props);
  return (
    <nav className="flex flex-col items-center gap-2.5">
      {sections.flatMap((s, si) => [
        ...(si ? [<span key={s.key + "-sep"} aria-hidden className="my-1 h-px w-6 bg-line" />] : []),
        ...s.items.map((i) => {
          const active = isActive(path, i.href);
          return (
            <Link key={i.href} href={i.href} title={i.label} aria-label={i.label} aria-current={active ? "page" : undefined}
                  className={`grid size-11 place-items-center rounded-full transition active:scale-95 ${active ? "bg-ink text-bg shadow-lg" : "glass-pill text-ink hover:brightness-125"}`}>
              {i.icon}
            </Link>
          );
        }),
      ])}
    </nav>
  );
}

/** Desktop sidebar: the folding tree, or the round icon rail on Today / when collapsed (remembered). */
export function Sidebar(props: Props) {
  const t = useTranslations("nav");
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { try { setCollapsed(localStorage.getItem("emet-nav") === "rail"); } catch { /* private mode */ } }, []);
  const toggle = () => setCollapsed((c) => { try { localStorage.setItem("emet-nav", c ? "full" : "rail"); } catch { /* ignore */ } return !c; });
  const rail = collapsed || path === "/today";
  return (
    <aside className={`sticky top-0 z-20 hidden h-dvh shrink-0 flex-col py-4 lg:flex ${rail ? "w-[84px] items-center px-2" : "w-64 px-3"}`}>
      <div className={`flex h-full flex-col ${rail ? "w-full items-center px-1 py-3" : "glass rounded-[26px] p-3"}`}>
        <div className={`mb-5 flex items-center ${rail ? "flex-col gap-3" : "justify-between px-1"}`}>
          <Link href="/today" className="flex items-center gap-2.5" aria-label="emet HQ">
            <LogoMark size={rail ? 40 : 30} />
            {!rail && <span className="leading-tight"><span className="block text-[15px] font-semibold">emet</span><span className="block text-xs text-muted">HQ</span></span>}
          </Link>
          {path !== "/today" && (
            <button onClick={toggle} aria-label={rail ? t("expand") : t("collapse")} title={rail ? t("expand") : t("collapse")} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink">
              {rail ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
            </button>
          )}
        </div>
        <div className="-mx-1 flex-1 overflow-y-auto px-1 [scrollbar-width:none]">
          {rail ? <Rail {...props} /> : <Tree {...props} />}
        </div>
        {!rail && (
          <Link href="/today#ask" className="glass mt-4 block rounded-2xl p-3.5 transition hover:brightness-110">
            <span className="flex items-center gap-2 text-sm font-semibold"><span className="grid size-7 place-items-center rounded-lg text-white" style={{ background: "var(--io-gradient)" }}><Sparkles size={14} /></span>{t("askCard")}</span>
            <span className="mt-1.5 block text-xs leading-relaxed text-muted">{t("askCardText")}</span>
          </Link>
        )}
      </div>
    </aside>
  );
}

/** Phone: a floating liquid-glass tab bar with the 4 most-used places + "More" for everything else. */
export function BottomNav(props: Props) {
  const t = useTranslations("nav");
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const myGroup = props.groups.find((g) => g.id === props.myGroupId);
  const items = [
    { href: "/today", label: t("today"), icon: <Sun size={20} /> },
    { href: "/board", label: t("board"), icon: <KanbanSquare size={20} /> },
    myGroup
      ? { href: `/g/${myGroup.slug}`, label: t("myTeam"), icon: <GroupIcon slug={myGroup.slug} size={20} /> }
      : { href: "/team", label: t("team"), icon: <Users size={20} /> },
    { href: "/camp", label: t("camp"), icon: <Tent size={20} /> },
  ];

  return (
    <>
      <nav aria-label={t("mobileNav")} className="fixed inset-x-3 bottom-[calc(0.6rem+env(safe-area-inset-bottom))] z-30 lg:hidden">
        <ul className="glass grid grid-cols-5 rounded-[26px] p-1.5">
          {items.map((i) => {
            const active = isActive(path, i.href);
            return (
              <li key={i.href}>
                <Link href={i.href} aria-current={active ? "page" : undefined}
                      className={`flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-[20px] text-[11px] transition active:scale-95 ${active ? "bg-ink font-semibold text-bg" : "text-muted"}`}>
                  {i.icon}<span className="max-w-full truncate px-0.5">{i.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button onClick={() => setOpen(true)} aria-haspopup="dialog" className="flex min-h-13 w-full flex-col items-center justify-center gap-0.5 rounded-[20px] text-[11px] text-muted active:scale-95">
              <Menu size={20} /><span>{t("more")}</span>
            </button>
          </li>
        </ul>
      </nav>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button aria-label={t("close")} onClick={() => setOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-[28px] bg-solid p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl ring-1 ring-line">
            <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2 font-semibold"><LogoMark size={26} /> emet HQ</span>
              <button onClick={() => setOpen(false)} aria-label={t("close")} className="grid size-11 place-items-center rounded-full hover:bg-surface-2"><X size={18} /></button>
            </div>
            <Tree {...props} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
