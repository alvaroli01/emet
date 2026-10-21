"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { LogOut, ChevronDown, UserRound, Plug } from "lucide-react";
import { Avatar } from "@/components/ui";
import { LanguageSwitcher } from "@/components/preferences";

/** Your avatar opens a small menu with language, theme and log out — keeps the top bar to the essentials. */
export function UserMenu({ name, avatar, subtitle, profileId }: { name: string; avatar: string | null; subtitle: string; profileId: string }) {
  const t = useTranslations("shell");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => { if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);
  return (
    <div ref={box} className="relative">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu" aria-label={t("account")}
              className="flex min-h-11 items-center gap-2 rounded-full py-1 pr-2 pl-1 transition hover:bg-surface-2">
        <Avatar name={name} src={avatar} size={32} />
        <span className="hidden max-w-36 text-left leading-tight md:block">
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="block truncate text-xs text-muted">{subtitle}</span>
        </span>
        <ChevronDown size={14} className={`hidden text-muted transition-transform md:block ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="menu" className="absolute top-full right-0 z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-line bg-solid p-1.5 shadow-[var(--shadow-lift)]">
          <div className="px-3 py-2.5 md:hidden">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-muted">{subtitle}</p>
          </div>
          <Link href={`/team/${profileId}`} role="menuitem" onClick={() => setOpen(false)}
                className="flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm hover:bg-surface-2">
            <UserRound size={16} /> {t("myProfile")}
          </Link>
          <Link href={`/team/${profileId}#connections`} role="menuitem" onClick={() => setOpen(false)}
                className="flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm hover:bg-surface-2">
            <Plug size={16} /> {t("connections")}
          </Link>
          <div className="flex items-center justify-between gap-2 rounded-xl px-1.5 py-1">
            <LanguageSwitcher profileId={profileId} />
          </div>
          <div className="my-1 h-px bg-line" />
          <form action="/auth/signout" method="post">
            <button role="menuitem" className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-sm text-bad-text hover:bg-surface-2">
              <LogOut size={16} /> {t("logOut")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
