"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { RotateCcw, Home } from "lucide-react";

/**
 * If anything on a page fails, show this inside the app (menu still works) instead of a blank "Application error".
 * The error is logged to the browser console for debugging.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("common");
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div role="alert" className="mx-auto mt-16 max-w-md rounded-3xl border border-line bg-surface p-8 text-center">
      <p className="text-4xl" aria-hidden>🙈</p>
      <h1 className="mt-3 text-xl font-semibold">{t("errorTitle")}</h1>
      <p className="mt-2 text-muted">{t("errorText")}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button onClick={reset} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand px-5 font-medium text-brand-contrast"><RotateCcw size={17} /> {t("tryAgain")}</button>
        <a href="/today" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-line px-5 font-medium"><Home size={17} /> {t("goHome")}</a>
      </div>
    </div>
  );
}
