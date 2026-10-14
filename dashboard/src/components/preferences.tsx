"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Languages, Moon, Sun } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LOCALES, LOCALE_COOKIE, LOCALE_NAMES, type Locale } from "@/i18n/config";

const YEAR = 60 * 60 * 24 * 365;
const setCookie = (k: string, v: string) => { document.cookie = `${k}=${v}; path=/; max-age=${YEAR}; samesite=lax`; };

/** Language picker in the top bar. The choice is saved on the member's profile (and a cookie for speed). */
export function LanguageSwitcher({ profileId }: { profileId?: string }) {
  const t = useTranslations("prefs");
  const locale = useLocale();
  const router = useRouter();

  async function change(next: Locale) {
    setCookie(LOCALE_COOKIE, next);
    router.refresh();
    if (profileId) await createClient().from("profiles").update({ locale: next }).eq("id", profileId);
  }

  return (
    <label className="relative inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-muted hover:bg-surface-2 hover:text-ink" title={t("language")}>
      <Languages size={17} aria-hidden />
      <span aria-hidden>{locale === "pt-BR" ? "PT" : locale.toUpperCase()}</span>
      <span className="hidden md:inline" aria-hidden>· {LOCALE_NAMES[locale as Locale]}</span>
      <select value={locale} onChange={(e) => change(e.target.value as Locale)} aria-label={t("language")}
              className="absolute inset-0 cursor-pointer opacity-0">
        {LOCALES.map((l) => <option key={l} value={l}>{l === "pt-BR" ? "PT" : l.toUpperCase()} · {LOCALE_NAMES[l]}</option>)}
      </select>
    </label>
  );
}

/** Applies the language saved on the profile when someone logs in on a new device. */
export function LocaleSync({ saved }: { saved: string | null }) {
  const locale = useLocale();
  const router = useRouter();
  useEffect(() => {
    if (saved && saved !== locale && (LOCALES as readonly string[]).includes(saved)) {
      setCookie(LOCALE_COOKIE, saved);
      router.refresh();
    }
    // only on first load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}


/** Light / dark / follow device */
export function ThemeToggle() {
  const t = useTranslations("prefs");
  // Dark glass is the default; light glass is opt-in and remembered in a cookie
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => { setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark"); }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    setCookie("emet-theme", next);
  }

  const Icon = theme === "light" ? Sun : Moon;
  return (
    <button onClick={toggle} title={t(`theme.${theme}`)} aria-label={t(`theme.${theme}`)}
            className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-ink">
      <Icon size={17} />
    </button>
  );
}
