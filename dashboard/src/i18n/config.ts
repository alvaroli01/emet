export const LOCALES = ["en", "es", "de", "fr", "fi", "pt-BR", "ru"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "emet-locale";

/** Each language written in itself, for the switcher */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
  de: "Deutsch",
  fr: "Français",
  fi: "Suomi",
  "pt-BR": "Português (Brasil)",
  ru: "Русский",
};

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** Best match for an Accept-Language header, falling back to English. */
export function matchLocale(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const wanted = header.split(",").map((part) => part.split(";")[0].trim().toLowerCase());
  for (const w of wanted) {
    const exact = LOCALES.find((l) => l.toLowerCase() === w);
    if (exact) return exact;
    const base = w.split("-")[0];
    if (base === "pt") return "pt-BR";
    const byBase = LOCALES.find((l) => l.toLowerCase() === base);
    if (byBase) return byBase;
  }
  return DEFAULT_LOCALE;
}
