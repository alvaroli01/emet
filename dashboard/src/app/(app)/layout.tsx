import { getTranslations } from "next-intl/server";
import { LogOut } from "lucide-react";
import { getSession } from "@/lib/session";
import { Sidebar, BottomNav } from "@/components/nav";
import { SyncIndicator } from "@/components/sync-indicator";
import { LanguageSwitcher, LocaleSync, ThemeToggle } from "@/components/preferences";
import { Avatar } from "@/components/ui";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("shell");
  const tg = await getTranslations("group.names");
  const { me, myGroup, groups } = await getSession();

  return (
    <div className="flex min-h-dvh">
      <LocaleSync saved={me.locale} />
      <Sidebar groups={groups} myGroupId={me.group_id} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-line bg-bg/85 px-4 py-2.5 backdrop-blur lg:px-8">
          <span className="whitespace-nowrap font-semibold tracking-tight lg:hidden">emet HQ</span>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <SyncIndicator />
            <LanguageSwitcher profileId={me.id} />
            <ThemeToggle />
            <div className="ml-1 flex items-center gap-2.5">
              <Avatar name={me.full_name} src={me.avatar_url} />
              <div className="hidden text-right leading-tight sm:block">
                <p className="text-sm font-medium">{me.full_name}</p>
                <p className="text-xs text-muted">
                  {myGroup ? `${myGroup.emoji} ${me.role_title ?? tg(myGroup.slug)}` : t("noGroupYet")}
                </p>
              </div>
            </div>
            <form action="/auth/signout" method="post">
              <button aria-label={t("logOut")} title={t("logOut")} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-ink">
                <LogOut size={17} />
              </button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 lg:px-8 lg:pb-12">{children}</main>
      </div>
      <BottomNav groups={groups} myGroupId={me.group_id} />
    </div>
  );
}
