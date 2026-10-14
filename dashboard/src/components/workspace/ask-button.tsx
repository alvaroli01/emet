"use client";

import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";

/** Opens the ⌘K palette, where any question becomes "Ask emet". */
export function AskButton() {
  const t = useTranslations("today");
  return (
    <button onClick={() => window.dispatchEvent(new Event("emet:palette"))}
            className="flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-brand-contrast shadow-[var(--shadow)] transition active:scale-[0.98]">
      <Sparkles size={15} /> {t("ask")}
    </button>
  );
}
