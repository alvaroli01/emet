import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, isLocale, matchLocale } from "./config";

// Language = the member's saved choice (cookie, synced from their profile),
// otherwise the browser's language, otherwise English. No /en/… URLs needed.
export default getRequestConfig(async () => {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(saved) ? saved : matchLocale((await headers()).get("accept-language"));
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "Europe/Madrid",
  };
});
