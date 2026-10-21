"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { FileImage, FileText, File as FileIcon, Loader2, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { shortDate } from "@/lib/format";
import { fileKind, formatSize, isTooBig, safeName } from "@/lib/documents";
import type { Member } from "@/lib/boards";
import type { ProjectFile } from "./project-page";

const KIND_ICON = { pdf: FileText, image: FileImage, other: FileIcon } as const;

/** The project's files (25 MB each, private bucket "projects", opened with 5-minute links). */
export function ProjectFiles({ projectId, files, people, meId, isLeader }: { projectId: string; files: ProjectFile[]; people: Map<string, Member>; meId: string; isLeader: boolean }) {
  const t = useTranslations("projects");
  const td = useTranslations("documents");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const picker = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function upload(list: FileList | File[]) {
    setBusy(true);
    for (const f of [...list]) {
      if (isTooBig(f.size)) { toast("error", td("tooBig", { name: f.name })); continue; }
      const id = crypto.randomUUID(), path = `${projectId}/${id}/${safeName(f.name)}`, mime = f.type || "application/octet-stream";
      const row = await supabase.from("project_files").insert({ id, project_id: projectId, name: f.name, size: f.size, mime, path });
      if (row.error) { toast("error", td("uploadError")); continue; }
      const up = await supabase.storage.from("projects").upload(path, f, { contentType: mime });
      if (up.error) { await supabase.from("project_files").delete().eq("id", id); toast("error", td(/exceed|quota|storage|size/i.test(up.error.message) ? "full" : "uploadError")); }
    }
    setBusy(false); router.refresh();
  }
  async function open(f: ProjectFile) {
    const kind = fileKind(f.mime, f.name);
    const { data, error } = await supabase.storage.from("projects").createSignedUrl(f.path, 300, kind === "other" ? { download: f.name } : undefined);
    if (error || !data) { toast("error", t("error")); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  }
  async function remove(f: ProjectFile) {
    await supabase.storage.from("projects").remove([f.path]);
    const { error } = await supabase.from("project_files").delete().eq("id", f.id);
    if (error) toast("error", t("error")); else router.refresh();
  }

  return (
    <section className={`panel space-y-4 p-5 transition ${dragging ? "ring-2 ring-brand/70" : ""}`}
             onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
             onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) upload(e.dataTransfer.files); }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">{td("drop")}</p>
        <button onClick={() => picker.current?.click()} disabled={busy} className="flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-sm font-medium text-brand-contrast disabled:opacity-60">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} {td("upload")}
        </button>
        <input ref={picker} type="file" multiple hidden onChange={(e) => { if (e.target.files?.length) upload(e.target.files); e.target.value = ""; }} />
      </div>
      <ul className="divide-y divide-line/60 rounded-2xl bg-surface-2/40 ring-1 ring-line">
        {files.map((f) => {
          const kind = fileKind(f.mime, f.name), Icon = KIND_ICON[kind];
          return (
            <li key={f.id} className="flex items-center gap-2 p-2.5">
              <button onClick={() => open(f)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                <Icon size={18} className={`shrink-0 ${kind === "pdf" ? "text-[#ff7a7a]" : kind === "image" ? "text-[#7ab8ff]" : "text-muted"}`} />
                <span className="min-w-0"><span className="block truncate text-sm font-medium">{f.name}</span>
                  <span className="block truncate text-xs text-muted">{formatSize(f.size, locale)} · {people.get(f.uploaded_by ?? "")?.full_name ?? "—"} · {shortDate(f.created_at.slice(0, 10), locale)}</span></span>
              </button>
              {(isLeader || f.uploaded_by === meId) && (
                <button onClick={() => remove(f)} aria-label={t("delete")} title={t("delete")} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-bad-text"><Trash2 size={14} /></button>
              )}
            </li>
          );
        })}
        {!files.length && <li className="p-6 text-center text-sm text-muted">{t("noFiles")}</li>}
      </ul>
    </section>
  );
}
