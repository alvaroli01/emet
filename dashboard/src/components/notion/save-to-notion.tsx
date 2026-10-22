"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { BookOpen, ExternalLink, Loader2 } from "lucide-react";
import { useToast } from "@/components/toast";

/** "Save to Notion" for one item; once saved it becomes "Open in Notion". Hidden when Notion isn't connected. */
export function SaveToNotion({ kind, id, meId }: { kind: "meeting" | "doc" | "idea" | "project_update"; id: string; meId?: string }) {
  const t = useTranslations("notion");
  const toast = useToast();
  const [s, setS] = useState<{ url: string | null; connected: boolean; canSave: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch(`/api/notion/export?kind=${kind}&id=${id}`).then((r) => (r.ok ? r.json() : null)).then((j) => { if (alive) setS(j); }).catch(() => {});
    return () => { alive = false; };
  }, [kind, id]);

  if (!s?.connected) return null;
  if (s.url) return <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-medium hover:text-ink"><ExternalLink size={13} /> {t("openInNotion")}</a>;
  if (!s.canSave) return <Link href={meId ? `/team/${meId}#connections` : "#"} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-xs text-muted hover:text-ink"><BookOpen size={13} /> {t("pickSavePage")}</Link>;

  async function save() {
    setBusy(true);
    const res = await fetch("/api/notion/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, id }) }).catch(() => null);
    setBusy(false);
    const j = await res?.json().catch(() => ({}));
    if (!res?.ok || !j?.url) { toast("error", t("saveFailedNotion")); return; }
    setS((x) => (x ? { ...x, url: j.url } : x));
    toast("ok", t("savedNotion"));
  }
  return (
    <button type="button" onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-medium hover:text-ink disabled:opacity-60">
      {busy ? <Loader2 size={13} className="animate-spin" /> : <BookOpen size={13} />} {t("saveToNotion")}
    </button>
  );
}
