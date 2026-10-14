import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { Sidebar, BottomNav } from "@/components/nav";
import { SyncIndicator } from "@/components/sync-indicator";
import { LocaleSync } from "@/components/preferences";
import { UserMenu } from "@/components/shell/user-menu";
import { Backdrop, Breadcrumb, MobileLogo, NotOnToday, TopBarFrame } from "@/components/shell/top-bar";
import { HeaderRecord } from "@/components/camp/header-record";
import { NotificationsBell } from "@/components/workspace/notifications";
import { CommandPalette, SearchButton } from "@/components/workspace/command-palette";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("shell");
  const tg = await getTranslations("group.names");
  const { me, myGroup, groups } = await getSession();

  return (
    <div className="relative isolate flex min-h-dvh">
      <Backdrop />
      <LocaleSync saved={me.locale} />
      <Sidebar groups={groups} myGroupId={me.group_id} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBarFrame>
          <MobileLogo />
          <Breadcrumb />
          <div className="flex flex-1 justify-center"><NotOnToday><SearchButton /></NotOnToday></div>
          <div className="flex items-center gap-1 sm:gap-1.5">
            <span className="hidden sm:contents"><SyncIndicator /></span>
            <NotificationsBell meId={me.id} />
            <HeaderRecord />
            <UserMenu name={me.full_name} avatar={me.avatar_url} profileId={me.id}
                      subtitle={myGroup ? (me.role_title ?? tg(myGroup.slug)) : t("noGroupYet")} />
          </div>
        </TopBarFrame>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-3 pt-3 pb-28 sm:px-4 sm:pt-5 lg:px-6 lg:pb-10">{children}</main>
      </div>
      <BottomNav groups={groups} myGroupId={me.group_id} />
      <CommandPalette />
    </div>
  );
}
