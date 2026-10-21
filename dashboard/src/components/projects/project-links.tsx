"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ClipboardList, ExternalLink, FileText, FolderOpen, Link2, NotebookText, Palette, PenTool, Presentation, Sheet, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { timeAgo } from "@/lib/format";
import { cleanUrl, linkKind, type LinkKind } from "@/lib/projects";
import type { Member } from "@/lib/boards";
import type { ProjectLink } from "./project-page";

const ICON: Record<LinkKind, { Icon: typeof FileText; color: string }> = {
  doc: { Icon: FileText, color: "#4f8cff" }, sheet: { Icon: Sheet, color: "#34a853" }, slides: { Icon: Presentation, color: "#f4b400" },
  drive: { Icon: FolderOpen, color: "#9aa0a6" }, form: { Icon: ClipboardList, color: "#a142f4" }, canva: { Icon: Palette, color: "#00c4cc" },
  notion: { Icon: NotebookText, color: "#e8e8e8" }, figma: { Icon: PenTool, color: "#f24e1e" }, other: { Icon: Link2, color: "#9aa0a6" },
};

export function LinkIcon({ url, size = 18 }: { url: string; size?: number }) {
  const { Icon, color } = ICON[linkKind(url)];
  return <Icon size={size} className="shrink-0" style={{ color }} aria-hidden />;
}

/** Shared links (Google Docs, Sheets, Slides, Drive, Canva…): any member adds one; one click opens it in a new tab. */
export function ProjectLinks({ projectId, links, people, meId, isLeader }: { projectId: string; links: ProjectLink[]; people: Map<string, Member>; meId: string; isLeader: boolean }) {
  const t = useTranslations("projects");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const clean = cleanUrl(url);
    if (!clean) { toast("error", t("badLink")); return; }
    setBusy(true);
    const { error } = await supabase.from("project_links").insert({ project_id: projectId, title: title.trim() || new URL(clean).hostname, url: clean });
    setBusy(false);
    if (error) { toast("error", t("error")); return; }
    setTitle(""); setUrl(""); router.refresh();
  }
  async function remove(id: string) {
    const { error } = await supabase.from("project_links").delete().eq("id", id);
    if (error) toast("error", t("error")); else router.refresh();
  }

  return (
    <section className="panel space-y-4 p-5">
      <form onSubmit={add} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={t("linkTitle")} aria-label={t("linkTitle")} className="input" />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://docs.google.com/…" aria-label={t("linkUrl")} className="input" inputMode="url" required />
        <button disabled={busy || !url.trim()} className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-contrast disabled:opacity-60">{t("addLink")}</button>
      </form>
      <ul className="divide-y divide-line/60 rounded-2xl bg-surface-2/40 ring-1 ring-line">
        {links.map((l) => (
          <li key={l.id} className="flex items-center gap-2 p-2.5">
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-2.5">
              <LinkIcon url={l.url} />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-medium"><span className="truncate">{l.title}</span><ExternalLink size={12} className="shrink-0 text-muted" /></span>
                <span className="block truncate text-xs text-muted">{t(`kinds.${linkKind(l.url)}`)} · {people.get(l.created_by ?? "")?.full_name ?? "—"} · {timeAgo(l.created_at, locale)}</span>
              </span>
            </a>
            {(isLeader || l.created_by === meId) && (
              <button onClick={() => remove(l.id)} aria-label={t("delete")} title={t("delete")} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-bad-text"><Trash2 size={14} /></button>
            )}
          </li>
        ))}
        {!links.length && <li className="p-6 text-center text-sm text-muted">{t("noLinks")}</li>}
      </ul>
    </section>
  );
}
