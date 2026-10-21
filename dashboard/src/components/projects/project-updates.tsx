"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { Avatar } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import type { Member } from "@/lib/boards";
import type { ProjectUpdate } from "./project-page";

/** Short updates from the project's people, newest first. */
export function ProjectUpdates({ projectId, updates, people, meId, isLeader }: { projectId: string; updates: ProjectUpdate[]; people: Map<string, Member>; meId: string; isLeader: boolean }) {
  const t = useTranslations("projects");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("project_updates").insert({ project_id: projectId, body: body.trim() });
    setBusy(false);
    if (error) { toast("error", t("error")); return; }
    setBody(""); router.refresh();
  }
  async function remove(id: string) {
    const { error } = await supabase.from("project_updates").delete().eq("id", id);
    if (error) toast("error", t("error")); else router.refresh();
  }

  return (
    <section className="panel space-y-4 p-5">
      <form onSubmit={post} className="space-y-2">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={2000} placeholder={t("updatePlaceholder")} aria-label={t("tabs.updates")} className="input w-full" />
        <div className="flex justify-end"><button disabled={busy || !body.trim()} className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-contrast disabled:opacity-60">{t("post")}</button></div>
      </form>
      <ul className="space-y-3">
        {updates.map((u) => {
          const who = people.get(u.created_by ?? "");
          return (
            <li key={u.id} className="flex gap-3 rounded-2xl bg-surface-2/40 p-3 ring-1 ring-line">
              <Avatar name={who?.full_name ?? "?"} src={who?.avatar_url} size={32} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted"><span className="font-semibold text-ink">{who?.full_name ?? "—"}</span> · {timeAgo(u.created_at, locale)}</p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm">{u.body}</p>
              </div>
              {(isLeader || u.created_by === meId) && (
                <button onClick={() => remove(u.id)} aria-label={t("delete")} title={t("delete")} className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-bad-text"><Trash2 size={14} /></button>
              )}
            </li>
          );
        })}
        {!updates.length && <li className="p-6 text-center text-sm text-muted">{t("noUpdates")}</li>}
      </ul>
    </section>
  );
}
