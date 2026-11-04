"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Check, Copy, Link2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { timeAgo } from "@/lib/format";

export type ProjectInvite = { id: string; token: string; created_at: string };

/** Invite links for Ollin people: whoever opens one types their name + Gmail, logs in and sees only this project. */
export function ProjectInvites({ projectId, invites }: { projectId: string; invites: ProjectInvite[] }) {
  const t = useTranslations("projects");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/join/${token}`);
      setCopied(token);
      toast("ok", t("copied"));
    } catch { toast("error", t("error")); }
  }

  async function create() {
    setBusy(true);
    const { data, error } = await createClient().from("project_invites").insert({ project_id: projectId }).select("token").single();
    setBusy(false);
    if (error) { toast("error", t("error")); return; }
    await copy(data.token);
    router.refresh();
  }

  async function remove(id: string) {
    const { error } = await createClient().from("project_invites").delete().eq("id", id);
    if (error) { toast("error", t("error")); return; }
    router.refresh();
  }

  return (
    <section className="panel space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl">
          <h2 className="font-semibold">{t("tabs.invites")}</h2>
          <p className="mt-1 text-sm text-muted">{t("invitesHelp")}</p>
        </div>
        <button onClick={create} disabled={busy} className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-contrast disabled:opacity-50">
          <Link2 size={15} /> {t("createInvite")}
        </button>
      </div>
      {invites.length ? (
        <ul className="space-y-2">{invites.map((i) => (
          <li key={i.id} className="flex items-center gap-2 rounded-xl bg-surface-2 p-3 text-sm">
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted">/join/{i.token}</span>
            <span className="hidden text-xs text-muted sm:inline">{timeAgo(i.created_at, locale)}</span>
            <button onClick={() => copy(i.token)} aria-label={t("copyLink")} title={t("copyLink")} className="grid size-8 place-items-center rounded-lg hover:bg-line">
              {copied === i.token ? <Check size={14} /> : <Copy size={14} />}
            </button>
            <button onClick={() => remove(i.id)} aria-label={t("deleteInvite")} title={t("deleteInvite")} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-line hover:text-bad-text">
              <Trash2 size={14} />
            </button>
          </li>
        ))}</ul>
      ) : <p className="text-sm text-muted">{t("noInvites")}</p>}
    </section>
  );
}
