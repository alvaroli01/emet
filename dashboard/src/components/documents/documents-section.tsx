"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Building2, Lock } from "lucide-react";
import { Drive } from "./drive";

/** Own profile only: company documents (read only; leaders manage them in Team Leader) and My folder (private). */
export function DocumentsSection({ meId, isLeader }: { meId: string; isLeader: boolean }) {
  const t = useTranslations("documents");
  const [tab, setTab] = useState<"company" | "personal">("company");
  return (
    <section id="documents" className="panel scroll-mt-24 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <div role="tablist" className="flex gap-1 rounded-full bg-surface-2 p-1">
          {(["company", "personal"] as const).map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                    className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium ${tab === k ? "bg-solid text-ink shadow" : "text-muted hover:text-ink"}`}>
              {k === "company" ? <Building2 size={14} /> : <Lock size={14} />} {t(`tabs.${k}`)}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-3 text-xs text-muted">
        {tab === "personal" ? t("private") : isLeader
          ? <Link href="/g/team-leader?tab=documents" className="text-link underline underline-offset-2">{t("manage")}</Link> : t("readOnly")}
      </p>
      {tab === "company" ? <Drive key="c" scope="company" canEdit={false} meId={meId} /> : <Drive key="p" scope="personal" canEdit meId={meId} />}
    </section>
  );
}
