"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { HeartHandshake } from "lucide-react";
import { useToast } from "@/components/toast";

/** "Lend my AI key to Scout": opt-in team key pool. Scout uses at most 60% of a lent key's daily allowance. */
export function LendKey({ hasKey, lend: initial, usedToday, lenders }: { hasKey: boolean; lend: boolean; usedToday: number; lenders: string[] }) {
  const t = useTranslations("scout");
  const router = useRouter();
  const toast = useToast();
  const [lend, setLend] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !lend;
    setLend(next); setBusy(true);
    const res = await fetch("/api/ai-key", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lend: next }) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) { setLend(!next); toast("error", t("stepError")); return; }
    router.refresh();
  }

  return (
    <section className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <HeartHandshake size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-medium">{t("lendTitle")}</p>
          <p className="mt-0.5 text-xs text-muted">{hasKey ? t("lendHelp") : t("lendNeedKey")}</p>
          {lend && <p className="mt-1 text-xs text-muted">{t("lendUsed", { n: Math.round(usedToday / 1000) })}</p>}
          <p className="mt-1 text-xs text-muted">{lenders.length ? t("lenders", { count: lenders.length, names: lenders.join(", ") }) : t("lendersNone")}</p>
        </div>
      </div>
      <button type="button" role="switch" aria-checked={lend} aria-label={t("lendTitle")} disabled={!hasKey || busy} onClick={toggle}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${lend ? "bg-brand" : "bg-surface-2 ring-1 ring-line"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${lend ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </section>
  );
}
