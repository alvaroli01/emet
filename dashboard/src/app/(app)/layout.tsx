import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Sidebar, BottomNav } from "@/components/nav";
import { SyncIndicator } from "@/components/sync-indicator";
import { LocaleSync } from "@/components/preferences";
import { UserMenu } from "@/components/shell/user-menu";
import { Backdrop, Breadcrumb, MobileLogo, NotOnToday, TopBarFrame } from "@/components/shell/top-bar";
import { HeaderRecord } from "@/components/camp/header-record";
import { NotificationsBell } from "@/components/workspace/notifications";
import { OfficePill } from "@/components/office/office-pill";
import { StartOnToday } from "@/components/shell/start-on-today";
import { CommandPalette, SearchButton } from "@/components/workspace/command-palette";
import { DailyBrief } from "@/components/workspace/daily-brief";
import { Presence } from "@/components/workspace/presence";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("shell");
  const tg = await getTranslations("group.names");
  const { me, myGroup, groups, isLeader } = await getSession();
  const showProjects = isLeader || !!me.is_coach;

  if (me.is_guest) {
    // Ollin guests: only the projects they were invited to (the database shows them nothing else)
    const { data: projects } = await (await createClient()).from("projects").select("id, name").order("name");
    return (
      <div className="relative isolate flex min-h-dvh flex-col">
        <Backdrop />
        <LocaleSync saved={me.locale} />
        <TopBarFrame>
          <nav className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {(projects ?? []).map((p) => <Link key={p.id} href={`/projects/${p.id}`} className="glass-pill shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium text-white">{p.name}</Link>)}
          </nav>
          <div className="flex items-center gap-1 sm:gap-1.5">
            <NotificationsBell meId={me.id} />
            <UserMenu name={me.full_name} avatar={me.avatar_url} profileId={me.id} subtitle="Ollin" />
          </div>
        </TopBarFrame>
        <main className="on-photo mx-auto w-full max-w-[1400px] flex-1 px-3 pt-3 pb-10 sm:px-4 sm:pt-5 lg:px-6">{children}</main>
      </div>
    );
  }

  return (
    <div className="relative isolate flex min-h-dvh">
      <Backdrop />
      <LocaleSync saved={me.locale} />
      <Sidebar groups={groups} myGroupId={me.group_id} showProjects={showProjects} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBarFrame>
          <MobileLogo />
          <Breadcrumb />
          <div className="flex flex-1 justify-center"><NotOnToday><SearchButton /></NotOnToday></div>
          <div className="flex items-center gap-1 sm:gap-1.5">
            <span className="hidden sm:contents"><SyncIndicator /></span>
            <OfficePill meId={me.id} />
            <StartOnToday />
            <NotificationsBell meId={me.id} />
            <HeaderRecord />
            <UserMenu name={me.full_name} avatar={me.avatar_url} profileId={me.id}
                      subtitle={myGroup ? (me.role_title ?? tg(myGroup.slug)) : t("noGroupYet")} />
          </div>
        </TopBarFrame>
        <main className="on-photo mx-auto w-full max-w-[1400px] flex-1 px-3 pt-3 pb-28 sm:px-4 sm:pt-5 lg:px-6 lg:pb-10">{children}</main>
      </div>
      <BottomNav groups={groups} myGroupId={me.group_id} showProjects={showProjects} />
      <CommandPalette />
      <DailyBrief />
      <Presence />
    </div>
  );
}
