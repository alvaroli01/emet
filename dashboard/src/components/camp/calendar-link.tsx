"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarPlus, Copy, RotateCcw, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";

/** "Add to my calendar": a private feed of your due dates and agenda for Google / Apple / Outlook. */
export function CalendarLink() {
  const t = useTranslations("camp.calendar");
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => { supabase.from("calendar_feeds").select("token").maybeSingle().then(({ data }) => setToken(data?.token ?? null)); }, [supabase]);

  async function create(reset = false) {
    setToken(undefined);
    if (reset) await supabase.from("calendar_feeds").delete().not("token", "is", null);
    const { data, error } = await supabase.from("calendar_feeds").insert({}).select("token").single();
    if (error) { toast("error", t("error")); setToken(null); return; }
    setToken(data.token);
    if (reset) toast("ok", t("resetDone"));
  }

  const https = token ? `${window.location.origin}/api/calendar/${token}.ics` : "";
  const webcal = https.replace(/^https?:/, "webcal:");
  return (
    <section className="panel p-5">
      <h2 className="flex items-center gap-2 font-semibold"><CalendarPlus size={17} /> {t("title")}</h2>
      <p className="mt-1 mb-4 text-sm text-muted">{t("hint")}</p>
      {token === undefined ? <Loader2 size={16} className="animate-spin text-muted" /> : !token ? (
        <button onClick={() => create()} className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-contrast">{t("create")}</button>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <a href={`https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noopener noreferrer"
               className="rounded-xl bg-brand px-3.5 py-2 text-sm font-medium text-brand-contrast">{t("google")}</a>
            <a href={webcal} className="rounded-xl bg-surface-2 px-3.5 py-2 text-sm font-medium hover:bg-line">{t("apple")}</a>
            <button onClick={async () => { await navigator.clipboard.writeText(https); toast("ok", t("copied")); }}
                    className="flex items-center gap-1.5 rounded-xl bg-surface-2 px-3.5 py-2 text-sm font-medium hover:bg-line"><Copy size={14} /> {t("copy")}</button>
          </div>
          <p className="text-xs text-muted">{t("private")}{" "}
            <button onClick={() => confirm(t("confirmReset")) && create(true)} className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-ink"><RotateCcw size={11} /> {t("reset")}</button>
          </p>
        </div>
      )}
    </section>
  );
}
