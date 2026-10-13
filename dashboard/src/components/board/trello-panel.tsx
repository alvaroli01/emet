"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronDown, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import type { BoardRow, Member } from "@/lib/boards";

type TMember = { id: string; username: string; fullName: string };
type MapRow = { trello_member_id: string; trello_username: string; profile_id: string };

/** Admins only: link this board to a Trello board (off by default). */
export function TrelloPanel({ board, members }: { board: BoardRow; members: Member[] }) {
  const t = useTranslations("trello");
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState(board.trello_board_id ?? "");
  const [busy, setBusy] = useState(false);
  const [tMembers, setTMembers] = useState<TMember[]>([]);
  const [map, setMap] = useState<MapRow[]>([]);

  useEffect(() => {
    if (!open || !board.trello_sync_enabled || !board.trello_board_id) return;
    fetch(`/api/trello/members?trelloBoardId=${board.trello_board_id}`).then((r) => r.json()).then((b) => setTMembers(b.members ?? []));
    createClient().from("trello_member_map").select("*").then(({ data }) => setMap((data as MapRow[]) ?? []));
  }, [open, board.trello_sync_enabled, board.trello_board_id]);

  async function call(url: string, body: object) {
    setBusy(true);
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const out = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) toast("error", out.error === "not-configured" ? t("notConfigured") : t("error", { error: out.error ?? res.status }));
    else { if (out.count !== undefined) toast("ok", t("synced", { count: out.count })); else toast("ok", t("saved")); router.refresh(); }
  }

  async function setMapping(m: TMember, profileId: string) {
    const supabase = createClient();
    const { error } = profileId
      ? await supabase.from("trello_member_map").upsert({ trello_member_id: m.id, trello_username: m.username, profile_id: profileId })
      : await supabase.from("trello_member_map").delete().eq("trello_member_id", m.id);
    if (error) return toast("error", t("error", { error: error.message }));
    setMap((cur) => [...cur.filter((x) => x.trello_member_id !== m.id), ...(profileId ? [{ trello_member_id: m.id, trello_username: m.username, profile_id: profileId }] : [])]);
    toast("ok", t("saved"));
  }

  return (
    <div className="mt-2 rounded-2xl border border-dashed border-line">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-muted hover:text-ink">
        <span className="font-medium">{t("title")}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${board.trello_sync_enabled ? "bg-ok/15 text-ok-text" : "bg-surface-2"}`}>
          {board.trello_sync_enabled ? t("on") : t("off")}
        </span>
        <ChevronDown size={15} className={`ml-auto transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-4 border-t border-line px-4 py-4 text-sm">
          <p className="text-xs text-muted">{t("hint")}</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-56 flex-1">
              <span className="mb-1 block text-xs font-medium">{t("boardId")}</span>
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://trello.com/b/…" className="input py-1.5" />
            </label>
            <button disabled={busy} onClick={() => call("/api/trello/settings", { boardId: board.id, enabled: true, trelloBoard: link })}
                    className="rounded-lg bg-brand px-3 py-2 font-medium text-brand-contrast disabled:opacity-50">
              {board.trello_sync_enabled ? t("save") : t("on")}
            </button>
            {board.trello_sync_enabled && (
              <>
                <button disabled={busy} onClick={() => call("/api/trello/sync", { boardId: board.id })}
                        className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 disabled:opacity-50">
                  <RefreshCw size={14} className={busy ? "animate-spin" : ""} /> {t("resync")}
                </button>
                <button disabled={busy} onClick={() => call("/api/trello/settings", { boardId: board.id, enabled: false })}
                        className="rounded-lg px-3 py-2 text-muted hover:text-ink disabled:opacity-50">
                  {t("off")}
                </button>
              </>
            )}
          </div>

          {board.trello_sync_enabled && tMembers.length > 0 && (
            <div>
              <p className="text-xs font-medium">{t("mapping")}</p>
              <p className="mb-2 text-xs text-muted">{t("mappingHint")}</p>
              <ul className="space-y-1.5">
                {tMembers.map((m) => (
                  <li key={m.id} className="flex items-center gap-2">
                    <span className="flex-1 truncate">@{m.username} <span className="text-muted">· {m.fullName}</span></span>
                    <select value={map.find((x) => x.trello_member_id === m.id)?.profile_id ?? ""} onChange={(e) => setMapping(m, e.target.value)}
                            aria-label={t("member")} className="input w-44 py-1">
                      <option value="">—</option>
                      {members.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                    </select>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
