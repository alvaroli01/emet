"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronRight, Download, FileImage, FileText, File as FileIcon, Folder as FolderIcon, FolderPlus, Loader2, Pencil, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { shortDate } from "@/lib/format";
import {
  breadcrumb, childrenOf, descendants, fileKind, formatSize, isNew, isTooBig, storagePath,
  type DocFile, type Folder, type Scope,
} from "@/lib/documents";

type Editing = { kind: "folder" | "file"; id: string; name: string } | null;
type Confirm = { kind: "folder" | "file"; id: string; name: string; n: number } | null;
const KIND_ICON = { pdf: FileText, image: FileImage, other: FileIcon } as const;

/**
 * A small drive: folders inside folders, files you open or download.
 * Company scope: everyone reads; leaders (canEdit) add, rename and delete — the database enforces this too.
 * Personal scope: only the owner, with full control.
 */
export function Drive({ scope, canEdit, meId }: { scope: Scope; canEdit: boolean; meId: string }) {
  const t = useTranslations("documents");
  const locale = useLocale();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [files, setFiles] = useState<DocFile[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [folderId, setFolderId] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [progress, setProgress] = useState<{ n: number; total: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const now = useMemo(() => Date.now(), []);

  const load = useCallback(async () => {
    // Personal: RLS already returns only my rows; the owner filter just keeps the query explicit
    let fq = supabase.from("doc_folders").select("id, name, parent_id, created_at").eq("scope", scope);
    let dq = supabase.from("doc_files").select("id, name, folder_id, size, mime, path, uploaded_by, created_at").eq("scope", scope);
    if (scope === "personal") { fq = fq.eq("owner_id", meId); dq = dq.eq("owner_id", meId); }
    const [fo, fi] = await Promise.all([fq, dq]);
    if (fo.error || fi.error) { toast("error", t("error")); setFolders([]); return; }
    setFolders(fo.data as Folder[]); setFiles(fi.data as DocFile[]);
    if (scope === "company") {
      const ids = [...new Set((fi.data as DocFile[]).map((f) => f.uploaded_by).filter(Boolean))] as string[];
      if (ids.length) {
        const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        setNames(new Map((data ?? []).map((p) => [p.id, p.full_name])));
      }
    }
  }, [supabase, scope, meId, t, toast]);
  useEffect(() => { load(); }, [load]);

  // If the open folder disappears (deleted elsewhere), go back to the top
  useEffect(() => { if (folders && folderId && !folders.some((f) => f.id === folderId)) setFolderId(null); }, [folders, folderId]);

  if (!folders) return <Loader2 size={18} className="animate-spin text-muted" />;
  const path = breadcrumb(folders, folderId);
  const here = childrenOf(folders, files, folderId, locale);
  const owner = scope === "personal" ? meId : null;

  async function createFolder() {
    const name = newFolder?.trim();
    if (!name) { setNewFolder(null); return; }
    const { error } = await supabase.from("doc_folders").insert({ scope, owner_id: owner, parent_id: folderId, name });
    if (error) toast("error", t("error")); else { setNewFolder(null); load(); }
  }

  async function upload(list: FileList | File[]) {
    const all = [...list];
    const ok = all.filter((f) => { if (isTooBig(f.size)) { toast("error", t("tooBig", { name: f.name })); return false; } return true; });
    for (let i = 0; i < ok.length; i++) {
      const f = ok[i];
      setProgress({ n: i + 1, total: ok.length });
      const id = crypto.randomUUID();
      const p = storagePath(scope, owner, id, f.name);
      const mime = f.type || "application/octet-stream";
      const row = await supabase.from("doc_files").insert({ id, scope, owner_id: owner, folder_id: folderId, name: f.name, size: f.size, mime, path: p });
      if (row.error) { toast("error", t("uploadError")); continue; }
      const up = await supabase.storage.from("documents").upload(p, f, { contentType: mime });
      if (up.error) {
        await supabase.from("doc_files").delete().eq("id", id);     // nothing half-saved
        toast("error", t(/exceed|quota|storage|size/i.test(up.error.message) ? "full" : "uploadError"));
      }
    }
    setProgress(null);
    load();
  }

  async function open(f: DocFile) {
    const kind = fileKind(f.mime, f.name);
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(f.path, 300, kind === "other" ? { download: f.name } : undefined);
    if (error || !data) { toast("error", t("error")); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function rename() {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return;
    const { error } = await supabase.from(editing.kind === "folder" ? "doc_folders" : "doc_files").update({ name }).eq("id", editing.id);
    if (error) toast("error", t("error")); else { setEditing(null); load(); }
  }

  function askDelete(kind: "folder" | "file", id: string, name: string) {
    const n = kind === "folder" ? (() => { const d = descendants(folders!, files, id); return d.folderIds.length - 1 + d.paths.length; })() : 0;
    setConfirm({ kind, id, name, n });
  }

  async function remove() {
    if (!confirm) return;
    const paths = confirm.kind === "folder" ? descendants(folders!, files, confirm.id).paths : [files.find((f) => f.id === confirm.id)!.path];
    if (paths.length) await supabase.storage.from("documents").remove(paths);
    const { error } = await supabase.from(confirm.kind === "folder" ? "doc_folders" : "doc_files").delete().eq("id", confirm.id);
    if (error) toast("error", t("error"));
    setConfirm(null); load();
  }

  const rowBtn = "grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink";
  const empty = !here.folders.length && !here.files.length;

  return (
    <div
      onDragOver={canEdit ? (e) => { e.preventDefault(); setDragging(true); } : undefined}
      onDragLeave={canEdit ? () => setDragging(false) : undefined}
      onDrop={canEdit ? (e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) upload(e.dataTransfer.files); } : undefined}
      className={`rounded-2xl transition ${dragging ? "ring-2 ring-brand/70 ring-offset-2 ring-offset-transparent" : ""}`}>
      {/* Path + actions */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <nav aria-label={t("title")} className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
          <button onClick={() => setFolderId(null)} className={`rounded-lg px-1.5 py-0.5 hover:bg-surface-2 ${path.length ? "text-muted" : "font-semibold"}`}>{t(`top.${scope}`)}</button>
          {path.map((f, i) => (
            <span key={f.id} className="flex items-center gap-1">
              <ChevronRight size={14} className="text-muted" />
              <button onClick={() => setFolderId(f.id)} className={`max-w-48 truncate rounded-lg px-1.5 py-0.5 hover:bg-surface-2 ${i === path.length - 1 ? "font-semibold" : "text-muted"}`}>{f.name}</button>
            </span>
          ))}
        </nav>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={() => setNewFolder("")} className="flex items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-line"><FolderPlus size={15} /> {t("newFolder")}</button>
            <button onClick={() => picker.current?.click()} disabled={!!progress} className="flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-sm font-medium text-brand-contrast disabled:opacity-60">
              {progress ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} {t("upload")}
            </button>
            <input ref={picker} type="file" multiple hidden onChange={(e) => { if (e.target.files?.length) upload(e.target.files); e.target.value = ""; }} />
          </div>
        )}
      </div>

      {progress && <p role="status" className="mb-2 text-sm text-muted">{t("uploading", { n: progress.n, total: progress.total })}</p>}
      {confirm && (
        <div role="alertdialog" className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-bad/10 p-3 text-sm ring-1 ring-bad/40">
          <span className="flex-1">{confirm.kind === "folder" && confirm.n > 0 ? t("confirmFolder", { n: confirm.n }) : t("confirmFile", { name: confirm.name })}</span>
          <button onClick={() => setConfirm(null)} className="rounded-lg px-3 py-1.5 hover:bg-surface-2">{t("cancel")}</button>
          <button onClick={remove} className="rounded-lg bg-bad px-3 py-1.5 font-medium text-white">{t("delete")}</button>
        </div>
      )}

      <ul className="divide-y divide-line/60 rounded-2xl bg-surface-2/40 ring-1 ring-line">
        {newFolder !== null && (
          <li className="flex items-center gap-2 p-2.5">
            <FolderIcon size={18} className="shrink-0 text-[#ffc23d]" />
            <input autoFocus value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder={t("folderName")} aria-label={t("folderName")}
                   onKeyDown={(e) => { if (e.key === "Enter") createFolder(); if (e.key === "Escape") setNewFolder(null); }} className="input min-w-0 flex-1" />
            <button onClick={createFolder} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-brand-contrast">{t("save")}</button>
            <button onClick={() => setNewFolder(null)} className="rounded-lg px-3 py-1.5 text-sm hover:bg-surface-2">{t("cancel")}</button>
          </li>
        )}

        {here.folders.map((f) => (
          <li key={f.id} className="group flex items-center gap-2 p-2.5">
            {editing?.id === f.id ? (
              <RenameRow value={editing.name} onChange={(name) => setEditing({ ...editing, name })} onSave={rename} onCancel={() => setEditing(null)} t={t} />
            ) : (<>
              <button onClick={() => setFolderId(f.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                <FolderIcon size={18} className="shrink-0 text-[#ffc23d]" fill="currentColor" fillOpacity={0.25} />
                <span className="truncate text-sm font-medium">{f.name}</span>
              </button>
              {canEdit && (<>
                <button onClick={() => setEditing({ kind: "folder", id: f.id, name: f.name })} aria-label={t("rename")} title={t("rename")} className={rowBtn}><Pencil size={14} /></button>
                <button onClick={() => askDelete("folder", f.id, f.name)} aria-label={t("delete")} title={t("delete")} className={`${rowBtn} hover:text-bad-text`}><Trash2 size={14} /></button>
              </>)}
            </>)}
          </li>
        ))}

        {here.files.map((f) => {
          const kind = fileKind(f.mime, f.name), Icon = KIND_ICON[kind];
          return (
            <li key={f.id} className="flex items-center gap-2 p-2.5">
              {editing?.id === f.id ? (
                <RenameRow value={editing.name} onChange={(name) => setEditing({ ...editing, name })} onSave={rename} onCancel={() => setEditing(null)} t={t} />
              ) : (<>
                <button onClick={() => open(f)} title={kind === "other" ? t("download") : t("open")} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                  <Icon size={18} className={`shrink-0 ${kind === "pdf" ? "text-[#ff7a7a]" : kind === "image" ? "text-[#7ab8ff]" : "text-muted"}`} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{f.name}</span>
                      {isNew(f.created_at, now) && <span className="shrink-0 rounded-full bg-brand/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#ffb27a]">{t("new")}</span>}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {[formatSize(f.size, locale), scope === "company" && f.uploaded_by && names.get(f.uploaded_by) ? t("by", { name: names.get(f.uploaded_by)! }) : null, shortDate(f.created_at.slice(0, 10), locale)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </button>
                {kind === "other" && <Download size={14} className="shrink-0 text-muted" aria-hidden />}
                {canEdit && (<>
                  <button onClick={() => setEditing({ kind: "file", id: f.id, name: f.name })} aria-label={t("rename")} title={t("rename")} className={rowBtn}><Pencil size={14} /></button>
                  <button onClick={() => askDelete("file", f.id, f.name)} aria-label={t("delete")} title={t("delete")} className={`${rowBtn} hover:text-bad-text`}><Trash2 size={14} /></button>
                </>)}
              </>)}
            </li>
          );
        })}

        {empty && newFolder === null && (
          <li className="p-6 text-center text-sm text-muted">
            {scope === "personal" ? t("empty.mine") : canEdit ? t("empty.company") : t("empty.companyRead")}
            {canEdit && <span className="mt-1 block text-xs">{t("drop")}</span>}
          </li>
        )}
      </ul>
    </div>
  );
}

function RenameRow({ value, onChange, onSave, onCancel, t }: {
  value: string; onChange: (v: string) => void; onSave: () => void; onCancel: () => void; t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <input autoFocus value={value} onChange={(e) => onChange(e.target.value)} aria-label={t("rename")}
             onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }} className="input min-w-0 flex-1" />
      <button onClick={onSave} disabled={!value.trim()} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-brand-contrast disabled:opacity-60">{t("save")}</button>
      <button onClick={onCancel} className="rounded-lg px-3 py-1.5 text-sm hover:bg-surface-2">{t("cancel")}</button>
    </div>
  );
}
