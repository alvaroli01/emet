"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { formatSize } from "@/lib/documents";

const TOTAL = 1024 ** 3; // Supabase free plan: 1 GB of storage, shared with meeting recordings

/** Leaders: how much of the free 1 GB the documents use (only the total, never whose files). */
export function StorageBar() {
  const t = useTranslations("documents");
  const locale = useLocale();
  const supabase = useMemo(() => createClient(), []);
  const [used, setUsed] = useState<number | null>(null);
  useEffect(() => { supabase.rpc("documents_storage_used").then(({ data }) => setUsed(Number(data ?? 0))); }, [supabase]);
  if (used === null) return null;
  const pct = Math.min(1, used / TOTAL);
  return (
    <div className="rounded-xl bg-surface-2/60 p-3">
      <p className="mb-1.5 text-xs text-muted">{t("storage", { used: formatSize(used, locale), total: "1 GB" })}</p>
      <div className="h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)}>
        <div className={`h-full rounded-full ${pct > 0.9 ? "bg-bad" : pct > 0.7 ? "bg-[#ffc23d]" : "bg-ok"}`} style={{ width: `${Math.max(pct * 100, 1)}%` }} />
      </div>
    </div>
  );
}
