/** Documents: pure helpers shared by the Team Leader tool, the profile's Documents section and the tests. */
export type Scope = "company" | "personal";
export type Folder = { id: string; name: string; parent_id: string | null; created_at: string };
export type DocFile = { id: string; name: string; folder_id: string | null; size: number; mime: string; path: string; uploaded_by: string | null; created_at: string };

export const MAX_BYTES = 26214400; // 25 MB — matches the bucket and the table check
export const isTooBig = (bytes: number) => bytes > MAX_BYTES;
export const isNew = (createdAt: string, now: number) => now - Date.parse(createdAt) < 7 * 864e5;

/** A name that is safe as one storage path segment; the real name stays in the table. */
export function safeName(name: string): string {
  let s = name.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\.\.+/g, "").replace(/[\/\\?#%*:|"<>]/g, "_")
    .replace(/\p{Extended_Pictographic}/gu, "_").replace(/^[_.\s]+/, "").trim();
  if (!s) return "file";
  if (s.length > 120) { const dot = s.lastIndexOf("."); const ext = dot > 0 && s.length - dot <= 10 ? s.slice(dot) : ""; s = s.slice(0, 120 - ext.length) + ext; }
  return s;
}

export function storagePath(scope: Scope, ownerId: string | null, fileId: string, name: string): string {
  return scope === "company" ? `company/${fileId}/${safeName(name)}` : `personal/${ownerId}/${fileId}/${safeName(name)}`;
}

export function breadcrumb(folders: Folder[], folderId: string | null): Folder[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const out: Folder[] = [];
  for (let id = folderId, n = 0; id && n < 50; n++) { const f = byId.get(id); if (!f) break; out.unshift(f); id = f.parent_id; }
  return out;
}

export function childrenOf(folders: Folder[], files: DocFile[], folderId: string | null, locale = "en") {
  const cmp = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, locale, { sensitivity: "base", numeric: true });
  return { folders: folders.filter((f) => f.parent_id === folderId).sort(cmp), files: files.filter((f) => f.folder_id === folderId).sort(cmp) };
}

export function descendants(folders: Folder[], files: DocFile[], folderId: string) {
  const folderIds = [folderId];
  for (let i = 0; i < folderIds.length; i++) for (const f of folders) if (f.parent_id === folderIds[i]) folderIds.push(f.id);
  const set = new Set(folderIds);
  return { folderIds, paths: files.filter((f) => f.folder_id && set.has(f.folder_id)).map((f) => f.path) };
}

export function fileKind(mime: string, name: string): "pdf" | "image" | "other" {
  if (mime === "application/pdf" || /\.pdf$/i.test(name)) return "pdf";
  if (mime.startsWith("image/")) return "image";
  return "other";
}

export function formatSize(bytes: number, locale: string): string {
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes, u = 0;
  while (v >= 1024 && u < units.length - 1) { v /= 1024; u++; }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: u === 0 ? 0 : 1 }).format(v)} ${units[u]}`;
}
