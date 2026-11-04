"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";

export type ProjectInvite = { id: string; token: string; created_at: string };

export function ProjectInvites({ projectId, invites, meId, isLeader }: { projectId: string; invites: ProjectInvite[]; meId: string; isLeader: boolean }) {
  const t = useTranslations("projects");
  const toast = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  async function createInvite() {
    if (!isLeader) return;
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("project_invites").insert({ project_id: projectId });
    if (error) {
      toast("error", "Failed to create invite");
    } else {
      toast("ok", "Invite created");
      setIsCreating(false);
    }
    setLoading(false);
  }

  async function deleteInvite(id: string) {
    if (!isLeader) return;
    const supabase = createClient();
    const { error } = await supabase.from("project_invites").delete().eq("id", id);
    if (error) {
      toast("error", "Failed to delete invite");
    } else {
      toast("ok", "Invite deleted");
    }
  }

  function copyLink(token: string) {
    const link = `${baseUrl}/join?token=${token}`;
    navigator.clipboard.writeText(link);
    toast("ok", "Link copied!");
  }

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <h2 className="mb-4 font-semibold">{t("invites")}</h2>
        {invites.length > 0 ? (
          <ul className="space-y-3">
            {invites.map((invite) => (
              <li key={invite.id} className="flex items-center justify-between rounded-lg bg-surface-2 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs text-muted">{invite.token}</p>
                  <p className="text-xs text-muted">{new Date(invite.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => copyLink(invite.token)} className="rounded-lg p-2 hover:bg-surface-1" title="Copy link">
                    <Copy size={14} />
                  </button>
                  {isLeader && (
                    <button onClick={() => deleteInvite(invite.id)} className="rounded-lg p-2 text-muted hover:bg-surface-1 hover:text-bad-text">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t("noInvites")}</p>
        )}
      </section>

      {isLeader && (
        <section className="panel p-5">
          {!isCreating ? (
            <button onClick={() => setIsCreating(true)} className="rounded-lg bg-brand px-4 py-2 font-medium text-brand-contrast hover:opacity-90">
              {t("createInvite")}
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={createInvite} disabled={loading} className="rounded-lg bg-brand px-4 py-2 font-medium text-brand-contrast disabled:opacity-50">
                {loading ? t("creating") : t("create")}
              </button>
              <button onClick={() => setIsCreating(false)} className="rounded-lg px-4 py-2 hover:bg-surface-2">
                {t("cancel")}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
