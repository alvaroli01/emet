# Documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Company documents (leaders manage them in Team Leader, everyone reads them on their own profile) and a private My folder per person.

**Architecture:** Two tables (`doc_folders`, `doc_files`) with `scope` company/personal and RLS; files in a private Supabase Storage bucket `documents` with mirrored storage policies; opened via 5-minute signed URLs. One client `Drive` component serves the Team Leader tool (edit), the profile's Company tab (read only) and My folder (edit). A trigger notifies everyone about new company files.

**Tech Stack:** Next.js App Router, Supabase (Postgres RLS + Storage), next-intl (7 languages), node:test, plpgsql permission tests.

**Spec:** `docs/superpowers/specs/2026-10-21-documents-design.md`

## Global Constraints

- €0: Supabase free Storage (1 GB shared with recordings). Max 25 MB per file (26214400 bytes). Any file type.
- Leader = `public.is_admin()` (Team Leader group or admin). Member = `public.is_member()`.
- Personal rows/files: only the owner, **admins included** — no admin exception.
- Never public links: signed URLs valid 300 s.
- Other people's profiles show no Documents section.
- All UI strings in all 7 `dashboard/messages/*.json`.
- Repo rules: README + CHANGELOG line; show the diff and wait for "push it" before any push; deploy only with Alvaro's OK.

## Review Focus

1. **File names with `/`, `..`, `#`, `?`, emoji or 300 chars** — stored under a safe path, displayed with the original name, download keeps the original name. Test in Task 2.
2. **Two files with the same name in one folder** — both kept (paths contain the file id). Test in Task 2 (`storagePath` uniqueness by id).
3. **Deleting a folder with sub-folders and files** — rows cascade in the DB and the storage objects are removed too (no orphans eating the 1 GB). Covered in Task 3 (delete collects all descendant file paths first).
4. **A member hitting the storage API directly** (bypassing the UI) to upload to `company/…` or read `personal/<someone>/…` — denied by storage policies. Test in Task 1.
5. **Leader removed from Team Leader** — immediately loses edit rights (policies call `is_admin()` live). Covered by Task 1 tests using the same function.

---

## File map

- Create `dashboard/supabase/migrations/0026_documents.sql`; modify `dashboard/supabase/tests/permissions_test.sql`.
- Create `dashboard/src/lib/documents.ts` + `documents.test.ts`.
- Create `dashboard/src/components/documents/drive.tsx`, `dashboard/src/components/documents/documents-section.tsx`, `dashboard/src/components/documents/storage-bar.tsx`.
- Modify `dashboard/src/app/(app)/g/[slug]/page.tsx` (leader tool), `dashboard/src/app/(app)/team/[id]/page.tsx` + `dashboard/src/components/team/member-dashboard.tsx` (section on own profile), `dashboard/src/components/shell/user-menu.tsx` ("My profile").
- Create `dashboard/src/app/(app)/me/documents/page.tsx` (redirect).
- Modify 7 `messages/*.json`, `README.md`, `CHANGELOG.md`.

---

### Task 1: Tables, storage bucket, policies, notification

**Files:** Create `dashboard/supabase/migrations/0026_documents.sql`; modify `dashboard/supabase/tests/permissions_test.sql` (append before the final cleanup / end of file, after the Google Calendar block).

**Interfaces — Produces:** tables `doc_folders(id, scope, owner_id, parent_id, name, created_by, created_at)`, `doc_files(id, scope, owner_id, folder_id, name, size, mime, path, uploaded_by, created_at)`; bucket `documents`; function `public.documents_storage_used() returns bigint`; notification kind `company_doc` with `data.name`, link `/me/documents`.

- [ ] **Step 1: Failing DB tests** (append; users: 1 Alvaro admin · 2 Stefan Finance · 3 Rocco Marketing · 4 Lassi Team Leader)

```sql
-- ── Documents: company (leaders write, everyone reads) + private My folder ──
select t.login(4);  -- Lassi, Team Leader
select t.check('Leader creates a company folder', $$insert into doc_folders (scope, name) values ('company', 'Contracts')$$, 'ok');
select t.check('Leader adds a company file', $$insert into doc_files (scope, folder_id, name, size, path) select 'company', id, 'Team Contract.pdf', 1000, 'company/x/Team Contract.pdf' from doc_folders where name = 'Contracts'$$, 'ok');
select t.check('Leader uploads it to storage', $$insert into storage.objects (bucket_id, name) values ('documents', 'company/x/Team Contract.pdf')$$, 'ok');
select t.login(3);  -- Rocco, member
select t.assert('Member sees the company folder and file', t.num($$select count(*) from doc_files where scope = 'company'$$) = 1 and t.num($$select count(*) from doc_folders where scope = 'company'$$) = 1);
select t.assert('Member can open the company file in storage', t.num($$select count(*) from storage.objects where bucket_id = 'documents' and name like 'company/%'$$) = 1);
select t.check('Member cannot create a company folder', $$insert into doc_folders (scope, name) values ('company', 'Mine')$$, 'denied');
select t.check('Member cannot add a company file', $$insert into doc_files (scope, name, size, path) values ('company', 'x.pdf', 1, 'company/y/x.pdf')$$, 'denied');
select t.check('Member cannot rename a company file', $$update doc_files set name = 'hacked' where scope = 'company'$$, 'denied');
select t.check('Member cannot delete a company file', $$delete from doc_files where scope = 'company'$$, 'denied');
select t.check('Member cannot upload into company storage', $$insert into storage.objects (bucket_id, name) values ('documents', 'company/z/evil.pdf')$$, 'denied');
select t.check('Member cannot delete company storage', $$delete from storage.objects where bucket_id = 'documents' and name like 'company/%'$$, 'denied');
select t.assert('Member was notified about the new company document', t.num($$select count(*) from notifications where kind = 'company_doc' and data->>'name' = 'Team Contract.pdf'$$) = 1);
select t.check('Member keeps a private folder', $$insert into doc_folders (scope, owner_id, name) values ('personal', my_profile_id(), 'Uni')$$, 'ok');
select t.check('Member adds a private file', $$insert into doc_files (scope, owner_id, folder_id, name, size, path) select 'personal', my_profile_id(), id, 'cv.pdf', 10, 'personal/' || my_profile_id() || '/f/cv.pdf' from doc_folders where name = 'Uni'$$, 'ok');
select t.check('Member uploads the private file to storage', $$insert into storage.objects (bucket_id, name) values ('documents', 'personal/' || my_profile_id() || '/f/cv.pdf')$$, 'ok');
select t.check('Private file cannot go into a company folder', $$insert into doc_files (scope, owner_id, folder_id, name, size, path) select 'personal', my_profile_id(), id, 'a', 1, 'personal/' || my_profile_id() || '/g/a' from doc_folders where name = 'Contracts'$$, 'denied');
select t.check('Member cannot make a private folder for someone else', $$insert into doc_folders (scope, owner_id, name) select 'personal', id, 'x' from profiles where full_name = 'Stefan'$$, 'denied');
select t.check('Files over 25 MB are refused', $$insert into doc_files (scope, owner_id, name, size, path) values ('personal', my_profile_id(), 'big', 26214401, 'personal/' || my_profile_id() || '/h/big')$$, 'denied');
select t.login(2);  -- Stefan
select t.assert('Other member cannot see Rocco''s private folder or files', t.num($$select count(*) from doc_folders where scope = 'personal'$$) = 0 and t.num($$select count(*) from doc_files where scope = 'personal'$$) = 0);
select t.assert('Other member cannot open Rocco''s private file in storage', t.num($$select count(*) from storage.objects where bucket_id = 'documents' and name like 'personal/%'$$) = 0);
select t.check('Other member cannot put a file into Rocco''s private storage', $$insert into storage.objects (bucket_id, name) select 'documents', 'personal/' || id || '/q/x' from profiles where full_name = 'Rocco'$$, 'denied');
select t.login(1);  -- Alvaro, admin
select t.assert('Admin cannot see members'' private files', t.num($$select count(*) from doc_files where scope = 'personal'$$) = 0);
select t.assert('Admin cannot open members'' private storage', t.num($$select count(*) from storage.objects where bucket_id = 'documents' and name like 'personal/%'$$) = 0);
select t.assert('Storage total counts every document', public.documents_storage_used() = 1010);
select t.login(4);
select t.check('Leader deletes the company folder (file goes with it)', $$delete from doc_folders where name = 'Contracts'$$, 'ok');
select t.assert('Company file was removed with its folder', t.num($$select count(*) from doc_files where scope = 'company'$$) = 0);
```

- [ ] **Step 2: Run** `PGBIN=$(dirname $(readlink -f $(which psql))) bash supabase/tests/run-local.sh` → FAIL (relation "doc_folders" does not exist).

- [ ] **Step 3: Migration** `0026_documents.sql`

```sql
-- Documents: company documents (team leaders add them in Team Leader, everyone can open them) and each person's
-- private My folder. Files live in the private "documents" bucket: company/<file id>/<name> and
-- personal/<profile id>/<file id>/<name>. Personal files are only ever visible to their owner — admins included.
create table public.doc_folders (
  id         uuid primary key default gen_random_uuid(),
  scope      text not null check (scope in ('company', 'personal')),
  owner_id   uuid references public.profiles(id) on delete cascade,
  parent_id  uuid references public.doc_folders(id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 120),
  created_by uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((scope = 'company') = (owner_id is null))
);
create index doc_folders_parent_idx on public.doc_folders (parent_id);
create index doc_folders_owner_idx on public.doc_folders (owner_id);

create table public.doc_files (
  id          uuid primary key default gen_random_uuid(),
  scope       text not null check (scope in ('company', 'personal')),
  owner_id    uuid references public.profiles(id) on delete cascade,
  folder_id   uuid references public.doc_folders(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 200),
  size        bigint not null check (size between 0 and 26214400),
  mime        text not null default 'application/octet-stream',
  path        text not null unique,
  uploaded_by uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  check ((scope = 'company') = (owner_id is null))
);
create index doc_files_folder_idx on public.doc_files (folder_id);
create index doc_files_owner_idx on public.doc_files (owner_id);

-- A folder/file must live in a folder of the same scope and owner
create or replace function public.trg_doc_same_place() returns trigger language plpgsql set search_path = public as $$
declare p record; pid uuid;
begin
  pid := case when tg_table_name = 'doc_folders' then new.parent_id else new.folder_id end;
  if pid is null then return new; end if;
  select scope, owner_id into p from public.doc_folders where id = pid;
  if not found or p.scope <> new.scope or p.owner_id is distinct from new.owner_id then
    raise exception 'documents: folder belongs somewhere else';
  end if;
  return new;
end $$;
create trigger doc_folders_same_place before insert or update on public.doc_folders for each row execute function public.trg_doc_same_place();
create trigger doc_files_same_place before insert or update on public.doc_files for each row execute function public.trg_doc_same_place();

grant select, insert, update, delete on public.doc_folders, public.doc_files to authenticated;
alter table public.doc_folders enable row level security;
alter table public.doc_files enable row level security;
do $$ declare t text; begin
  foreach t in array array['doc_folders', 'doc_files'] loop
    execute format($f$create policy %1$s_read on public.%1$s for select to authenticated
      using ((scope = 'company' and public.is_member()) or owner_id = (select public.my_profile_id()))$f$, t);
    execute format($f$create policy %1$s_insert on public.%1$s for insert to authenticated
      with check ((scope = 'company' and public.is_admin()) or (scope = 'personal' and owner_id = (select public.my_profile_id())))$f$, t);
    execute format($f$create policy %1$s_update on public.%1$s for update to authenticated
      using ((scope = 'company' and public.is_admin()) or owner_id = (select public.my_profile_id()))
      with check ((scope = 'company' and public.is_admin()) or (scope = 'personal' and owner_id = (select public.my_profile_id())))$f$, t);
    execute format($f$create policy %1$s_delete on public.%1$s for delete to authenticated
      using ((scope = 'company' and public.is_admin()) or owner_id = (select public.my_profile_id()))$f$, t);
  end loop;
end $$;

-- Total size of all documents (both scopes) for the leaders' storage bar — only the number, never whose files
create or replace function public.documents_storage_used() returns bigint language sql stable security definer set search_path = public as $$
  select coalesce(sum(size), 0)::bigint from public.doc_files where public.is_member()
$$;
grant execute on function public.documents_storage_used() to authenticated;

-- Everyone hears about a new company document
create or replace function public.trg_notify_company_doc() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(array(select id from public.profiles where active), 'company_doc',
    jsonb_build_object('name', new.name), '/me/documents', new.uploaded_by);
  return new;
end $$;
create trigger notify_company_doc after insert on public.doc_files for each row when (new.scope = 'company')
  execute function public.trg_notify_company_doc();

-- Storage: private bucket, 25 MB per file, any type
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('documents', 'documents', false, 26214400) on conflict (id) do nothing;
    create policy documents_read on storage.objects for select to authenticated using (bucket_id = 'documents' and (
      ((storage.foldername(name))[1] = 'company' and public.is_member())
      or ((storage.foldername(name))[1] = 'personal' and (storage.foldername(name))[2] = (select public.my_profile_id())::text)));
    create policy documents_insert on storage.objects for insert to authenticated with check (bucket_id = 'documents' and (
      ((storage.foldername(name))[1] = 'company' and public.is_admin())
      or ((storage.foldername(name))[1] = 'personal' and (storage.foldername(name))[2] = (select public.my_profile_id())::text)));
    create policy documents_delete on storage.objects for delete to authenticated using (bucket_id = 'documents' and (
      ((storage.foldername(name))[1] = 'company' and public.is_admin())
      or ((storage.foldername(name))[1] = 'personal' and (storage.foldername(name))[2] = (select public.my_profile_id())::text)));
  end if;
end $$;
```

- [ ] **Step 4: Run** the DB tests → all PASS (fix the SQL until they do; never weaken a test).
- [ ] **Step 5: Commit** `git add supabase && git commit -m "Documents: tables, private storage, policies, notification"`

---

### Task 2: Pure helpers

**Files:** Create `dashboard/src/lib/documents.ts`, `dashboard/src/lib/documents.test.ts`.

**Interfaces — Produces:**
```ts
export type Scope = "company" | "personal";
export type Folder = { id: string; name: string; parent_id: string | null; created_at: string };
export type DocFile = { id: string; name: string; folder_id: string | null; size: number; mime: string; path: string; uploaded_by: string | null; created_at: string };
export const MAX_BYTES = 26214400;
export const isTooBig = (bytes: number) => bytes > MAX_BYTES;
export function safeName(name: string): string;
export function storagePath(scope: Scope, ownerId: string | null, fileId: string, name: string): string;
export function breadcrumb(folders: Folder[], folderId: string | null): Folder[];
export function childrenOf(folders: Folder[], files: DocFile[], folderId: string | null, locale?: string): { folders: Folder[]; files: DocFile[] };
export function descendants(folders: Folder[], files: DocFile[], folderId: string): { folderIds: string[]; paths: string[] };
export function fileKind(mime: string, name: string): "pdf" | "image" | "other";
export function formatSize(bytes: number, locale: string): string;
export const isNew = (createdAt: string, now: number) => now - Date.parse(createdAt) < 7 * 864e5;
```

- [ ] **Step 1: Failing tests** `src/lib/documents.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { isTooBig, safeName, storagePath, breadcrumb, childrenOf, descendants, fileKind, formatSize, isNew } from "./documents.ts";

test("25 MB limit", () => {
  assert.equal(isTooBig(26214400), false);
  assert.equal(isTooBig(26214401), true);
});

test("safe storage names keep the file recognisable", () => {
  assert.equal(safeName("Team Contract.pdf"), "Team Contract.pdf");
  assert.equal(safeName("../../etc/passwd"), "etc_passwd");
  assert.equal(safeName("a/b\\c?d#e%f.pdf"), "a_b_c_d_e_f.pdf");
  assert.equal(safeName("Presupuesto ñandú 🎉.xlsx"), "Presupuesto ñandú _.xlsx");
  assert.equal(safeName("   "), "file");
  const long = safeName("x".repeat(300) + ".pdf");
  assert.ok(long.length <= 120 && long.endsWith(".pdf"));
});

test("storage paths: company vs personal, unique by file id", () => {
  assert.equal(storagePath("company", null, "f1", "a.pdf"), "company/f1/a.pdf");
  assert.equal(storagePath("personal", "p9", "f2", "a.pdf"), "personal/p9/f2/a.pdf");
  assert.notEqual(storagePath("company", null, "f1", "a.pdf"), storagePath("company", null, "f3", "a.pdf"));
});

const F = (id: string, name: string, parent_id: string | null) => ({ id, name, parent_id, created_at: "2026-10-01T00:00:00Z" });
const D = (id: string, name: string, folder_id: string | null) => ({ id, name, folder_id, size: 1, mime: "application/pdf", path: `company/${id}/${name}`, uploaded_by: null, created_at: "2026-10-01T00:00:00Z" });
const folders = [F("a", "Contracts", null), F("b", "2026", "a"), F("c", "Guides", null), F("d", "Old", "b")];
const files = [D("1", "z.pdf", null), D("2", "B.pdf", "a"), D("3", "a.pdf", "a"), D("4", "deep.pdf", "d")];

test("breadcrumb from the top", () => {
  assert.deepEqual(breadcrumb(folders, "d").map((f) => f.name), ["Contracts", "2026", "Old"]);
  assert.deepEqual(breadcrumb(folders, null), []);
});

test("folders first, then files, alphabetical", () => {
  const top = childrenOf(folders, files, null);
  assert.deepEqual(top.folders.map((f) => f.name), ["Contracts", "Guides"]);
  assert.deepEqual(top.files.map((f) => f.name), ["z.pdf"]);
  assert.deepEqual(childrenOf(folders, files, "a").files.map((f) => f.name), ["a.pdf", "B.pdf"]);
});

test("deleting a folder finds every file inside, however deep", () => {
  const d = descendants(folders, files, "a");
  assert.deepEqual(d.folderIds.sort(), ["a", "b", "d"]);
  assert.deepEqual(d.paths.sort(), ["company/2/B.pdf", "company/3/a.pdf", "company/4/deep.pdf"]);
});

test("pdf and images open, the rest downloads", () => {
  assert.equal(fileKind("application/pdf", "x"), "pdf");
  assert.equal(fileKind("", "Report.PDF"), "pdf");
  assert.equal(fileKind("image/png", "x.png"), "image");
  assert.equal(fileKind("application/vnd.ms-excel", "x.xls"), "other");
});

test("sizes and the New badge", () => {
  assert.equal(formatSize(900, "en"), "900 B");
  assert.equal(formatSize(1536, "en"), "1.5 KB");
  assert.equal(formatSize(26214400, "en"), "25 MB");
  const now = Date.parse("2026-10-21T12:00:00Z");
  assert.equal(isNew("2026-10-15T12:00:01Z", now), true);
  assert.equal(isNew("2026-10-14T12:00:00Z", now), false);
});
```

- [ ] **Step 2: Run** `node --test src/lib/documents.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement** `src/lib/documents.ts`

```ts
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
```

- [ ] **Step 4: Run** → PASS. Adjust implementation (not tests) until green.
- [ ] **Step 5: Commit** `git add src/lib/documents.ts src/lib/documents.test.ts && git commit -m "Documents: pure helpers"`

---

### Task 3: Drive component + strings

**Files:** Create `dashboard/src/components/documents/drive.tsx`, `dashboard/src/components/documents/storage-bar.tsx`; modify 7 `messages/*.json` (new top-level `documents` block + `notifications` kind `company_doc` + `shell.myProfile`).

**Interfaces — Consumes:** Task 2 helpers; tables/bucket from Task 1. **Produces:** `Drive({ scope, canEdit, meId }: { scope: Scope; canEdit: boolean; meId: string })`, `StorageBar()`.

Behaviour (client component, `createClient()` from `@/lib/supabase/client`, `useToast`, `useTranslations("documents")`):
- Load: `doc_folders` and `doc_files` filtered by `scope` (+ `owner_id = meId` for personal), plus `profiles(id, full_name)` names for uploaders (company only). Keep `folderId` in state (null = top).
- Header row: breadcrumb buttons (`t("top.company")` / `t("top.personal")` › folder › …), and when `canEdit`: **New folder** (inline input, Enter to save), **Upload** (hidden `<input type=file multiple>`).
- Drop zone when `canEdit`: the whole list accepts dropped files (highlight ring while dragging).
- Upload each file: if `isTooBig` → toast `t("tooBig", { name })`, skip. Else `id = crypto.randomUUID()`, `path = storagePath(scope, scope === "personal" ? meId : null, id, file.name)`; `insert doc_files {id, scope, owner_id, folder_id, name: file.name, size, mime: file.type || "application/octet-stream", path}`; then `storage.from("documents").upload(path, file, { contentType: file.type || undefined })`; if that fails → `delete doc_files where id` and toast `t(/exceeded|quota|storage/i.test(msg) ? "full" : "uploadError")`. Show a progress line "Uploading 2 of 3…".
- Rows: folders (Folder icon, click → open), then files (icon by `fileKind`, name, `formatSize`, uploader name (company), date `shortDate`, "New" badge if `isNew`). Click a file → `storage.from("documents").createSignedUrl(path, 300, kind === "other" ? { download: name } : undefined)` → `window.open(url, "_blank", "noopener")`.
- When `canEdit`, each row has Rename (inline input → `update name`) and Delete. Deleting a folder: `descendants()` → if it has files or sub-folders, ask with an in-page confirm row (not `window.confirm`) showing `t("confirmFolder", { n })`; then `storage.remove(paths)` (ignore missing) and `delete doc_folders where id` (cascade). Deleting a file: `storage.remove([path])` then `delete doc_files`.
- Empty states: `t("empty.company")` / `t(canEdit ? "empty.mine" : "empty.companyRead")`.
- `StorageBar`: `rpc("documents_storage_used")` → bar `used / 1 GB` with `t("storage", { used: formatSize(...), total: "1 GB" })`, amber over 70%, red over 90%.

- [ ] **Step 1: English strings** (`messages/en.json`, new top-level key):

```json
"documents": {
  "title": "Documents",
  "tabs": { "company": "Company documents", "personal": "My folder" },
  "top": { "company": "Company documents", "personal": "My folder" },
  "tool": "Company documents",
  "newFolder": "New folder",
  "folderName": "Folder name",
  "upload": "Upload",
  "drop": "Drop files here to upload them",
  "uploading": "Uploading {n} of {total}…",
  "rename": "Rename",
  "delete": "Delete",
  "save": "Save",
  "cancel": "Cancel",
  "confirmFolder": "Delete this folder and the {n} items inside it?",
  "confirmFile": "Delete “{name}”?",
  "new": "New",
  "by": "by {name}",
  "open": "Open",
  "download": "Download",
  "tooBig": "“{name}” is bigger than 25 MB",
  "uploadError": "Couldn’t upload. Try again.",
  "full": "Storage is full — delete old files first",
  "error": "Something went wrong. Try again.",
  "empty": { "company": "No company documents yet. Create a folder or upload a file.", "companyRead": "No company documents yet — team leaders add them here.", "mine": "Your private folder is empty. Upload anything you want to keep here — only you can see it." },
  "private": "Only you can see My folder — not even admins.",
  "readOnly": "Team leaders add these in Team Leader.",
  "manage": "Manage in Team Leader",
  "storage": "Documents use {used} of {total}"
}
```

plus `notifications.<kinds map>.company_doc`: `"New company document: “{name}”"` next to `team_task` (find the exact parent key with `grep -n '"team_task"' messages/en.json`), and `shell.myProfile`: `"My profile"`. Translate everything into es, de, fr, fi, pt-BR, ru. Validate JSON of all 7 files.

- [ ] **Step 2: Write** `drive.tsx` and `storage-bar.tsx` to the behaviour above, reusing existing classes (`panel`, `input`, `rounded-xl bg-brand … text-brand-contrast`, `bg-surface-2`, `text-muted`, `ring-line`).
- [ ] **Step 3:** `npx tsc --noEmit && npx eslint src/components/documents` → clean.
- [ ] **Step 4: Commit** `git add src/components/documents messages && git commit -m "Documents: Drive component (7 languages)"`

---

### Task 4: Wire it in (Team Leader tool, profile section, avatar menu, redirect)

**Files:** modify `dashboard/src/app/(app)/g/[slug]/page.tsx` (~line 85), `dashboard/src/app/(app)/team/[id]/page.tsx`, `dashboard/src/components/team/member-dashboard.tsx`, `dashboard/src/components/shell/user-menu.tsx`; create `dashboard/src/components/documents/documents-section.tsx`, `dashboard/src/app/(app)/me/documents/page.tsx`.

- [ ] **Step 1: Team Leader tool** — next to `assignTool`:

```tsx
  const td = await getTranslations("documents");
  const docsTool = slug === "team-leader" && session.isAdmin ? [{
    id: "documents", group: "work" as const, label: td("tool"), icon: <FolderOpen size={16} />,
    node: <div className="space-y-3"><StorageBar /><Drive scope="company" canEdit meId={session.me.id} /></div>,
  }] : [];
```
and `...docsTool,` right after `...assignTool,` in `allTools`; imports `FolderOpen` (lucide), `Drive`, `StorageBar`.

- [ ] **Step 2: Section** `documents-section.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Building2, Lock } from "lucide-react";
import { Drive } from "./drive";

/** Own profile only: company documents (read only; leaders manage them in Team Leader) and My folder (private). */
export function DocumentsSection({ meId, isLeader }: { meId: string; isLeader: boolean }) {
  const t = useTranslations("documents");
  const [tab, setTab] = useState<"company" | "personal">("company");
  return (
    <section id="documents" className="panel scroll-mt-24 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <div role="tablist" className="flex gap-1 rounded-full bg-surface-2 p-1">
          {(["company", "personal"] as const).map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                    className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium ${tab === k ? "bg-solid text-ink shadow" : "text-muted hover:text-ink"}`}>
              {k === "company" ? <Building2 size={14} /> : <Lock size={14} />} {t(`tabs.${k}`)}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-3 text-xs text-muted">
        {tab === "personal" ? t("private") : isLeader
          ? <Link href="/g/team-leader?tool=documents" className="text-link underline underline-offset-2">{t("manage")}</Link> : t("readOnly")}
      </p>
      {tab === "company" ? <Drive key="c" scope="company" canEdit={false} meId={meId} /> : <Drive key="p" scope="personal" canEdit meId={meId} />}
    </section>
  );
}
```
(Check how the group page selects a tool from the URL — `grep -n "searchParams\|tool=" src/components/shell/tool-workspace.tsx` — and use that exact query parameter in the "Manage" link.)

- [ ] **Step 3: Profile** — `team/[id]/page.tsx`: get `me, isAdmin` from `getSession()`; pass `isMe={person.id === me.id}` and `isLeader={isAdmin}` to `MemberDashboard`. In `member-dashboard.tsx` add those props and, at the end of the outer container (after the last grid), `{isMe && <DocumentsSection meId={p.id} isLeader={isLeader} />}`.
- [ ] **Step 4: Avatar menu** — in `user-menu.tsx`, above the language row:

```tsx
          <Link href={`/team/${profileId}`} role="menuitem" onClick={() => setOpen(false)}
                className="flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm hover:bg-surface-2">
            <UserRound size={16} /> {t("myProfile")}
          </Link>
```
(imports `Link` from `next/link`, `UserRound` from lucide).
- [ ] **Step 5: Redirect** `me/documents/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

/** Notifications about new company documents link here; it opens your own profile's Documents. */
export default async function MyDocuments() {
  const { me } = await getSession();
  redirect(`/team/${me.id}#documents`);
}
```
- [ ] **Step 6:** `npx tsc --noEmit && npm test && npx eslint src` → clean. Commit `git commit -am "Documents: Team Leader tool, profile section, My profile link"` (add new files first).

---

### Task 5: Docs, local check, live

- [ ] **Step 1: README** — add a systems row "Documents" (what, where, limits, privacy) and a decisions-log row "2026-10-21 | Company documents are managed by leaders in Team Leader and read by everyone on their own profile; My folder is private even from admins; 25 MB per file in the free 1 GB | Alvaro". **CHANGELOG** top line.
- [ ] **Step 2:** full checks: `npm test`, DB tests, `tsc`, `eslint` → all green.
- [ ] **Step 3: Local browser check** (`npm run dev`) — with Alvaro's OK, run `0026_documents.sql` in the Supabase SQL editor first (local uses the live database; additive only). Then: Team Leader → Company documents: make a folder, upload a PDF and a .docx, rename, open (PDF opens in a tab, .docx downloads), delete a folder with a file inside; My profile → Documents shows them read-only; My folder upload/open/delete; a 30 MB file is refused.
- [ ] **Step 4:** show Alvaro, then on "push it": merge to main, push, deploy (rsync to scratchpad, `npx vercel deploy --prod --yes`), check live.
