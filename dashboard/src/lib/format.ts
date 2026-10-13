// Locale-aware formatting helpers (money in €, dates, relative times).
// English uses British conventions (30 June 2027) — the team is in Europe.
const L = (locale: string) => (locale === "en" ? "en-GB" : locale);

export function eur(v: number, locale: string, digits = 0) {
  return new Intl.NumberFormat(L(locale), {
    style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(v);
}

export function eurShort(v: number, locale: string) {
  if (Math.abs(v) < 1000) return eur(v, locale);
  return new Intl.NumberFormat(L(locale), {
    style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 1, minimumFractionDigits: 0,
  }).format(v);
}

export function pct(v: number | null, locale: string) {
  return v === null ? "—" : new Intl.NumberFormat(L(locale), { style: "percent", maximumFractionDigits: 0 }).format(v);
}

export function num(v: number, locale: string) {
  return new Intl.NumberFormat(L(locale)).format(v);
}

export function shortDate(d: string | Date, locale: string) {
  const date = typeof d === "string" ? new Date(d.length === 10 ? d + "T12:00:00Z" : d) : d;
  return date.toLocaleDateString(L(locale), { day: "numeric", month: "short", timeZone: "Europe/Madrid" });
}

export function longDate(d: string | Date, locale: string) {
  const date = typeof d === "string" ? new Date(d.length === 10 ? d + "T12:00:00Z" : d) : d;
  return date.toLocaleDateString(L(locale), { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" });
}

export function dateTime(d: string, locale: string) {
  return new Date(d).toLocaleString(L(locale), {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid",
  });
}

export function timeAgo(iso: string, locale: string, now = Date.now()) {
  const s = Math.round((Date.parse(iso) - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(L(locale), { numeric: "auto" });
  const abs = Math.abs(s);
  if (abs < 45) return rtf.format(0, "second");
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
  return rtf.format(Math.round(s / 86400), "day");
}

/** Today's date in Madrid as YYYY-MM-DD */
export function todayISO() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
}
