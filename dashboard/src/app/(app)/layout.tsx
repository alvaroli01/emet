import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { Sidebar, BottomNav } from "@/components/nav";
import { SyncIndicator } from "@/components/sync-indicator";
import { LocaleSync } from "@/components/preferences";
import { UserMenu } from "@/components/shell/user-menu";
import { LogoMark } from "@/components/summit/logo";
import { HeaderRecord } from "@/components/camp/header-record";
import { NotificationsBell } from "@/components/workspace/notifications";
import { CommandPalette, SearchButton } from "@/components/workspace/command-palette";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("shell");
  const tg = await getTranslations("group.names");
  const { me, myGroup, groups } = await getSession();

  return (
    <div className="flex min-h-dvh">
      <LocaleSync saved={me.locale} />
      <Sidebar groups={groups} myGroupId={me.group_id} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b border-line bg-bg/80 px-3 backdrop-blur-xl sm:px-4 lg:h-16 lg:px-8">
          <span className="flex items-center gap-2 font-semibold tracking-tight lg:hidden"><LogoMark size={26} /> <span className="hidden min-[380px]:inline">emet HQ</span></span>
          <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
            <span className="hidden sm:contents"><SyncIndicator /></span>
            <SearchButton />
            <NotificationsBell meId={me.id} />
            <HeaderRecord />
            <UserMenu name={me.full_name} avatar={me.avatar_url} profileId={me.id}
                      subtitle={myGroup ? (me.role_title ?? tg(myGroup.slug)) : t("noGroupYet")} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-3 pt-4 pb-28 sm:px-4 sm:pt-6 lg:px-8 lg:pb-12">{children}</main>
      </div>
      <BottomNav groups={groups} myGroupId={me.group_id} />
      <CommandPalette />
    </div>
  );
}
