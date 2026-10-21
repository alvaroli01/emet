# Documents — design

Date: 2026-10-21 · Owner: Alvaro · Status: approved in chat, waiting for spec review

## Goal

One place for the company's shared files and each person's own files, inside emet, €0:
- **Company documents** — leaders upload them in the Team Leader area; everyone can open them.
- **My folder** — each person's private files.

## Decisions (from the chat)

- **Folders**, like a simple drive (folders inside folders), not one labelled list.
- **Leaders manage company documents in Team Leader → Tools → "Company documents"** (leaders-only tool, like
  "Assign tasks"). "Leader" = `public.is_admin()` (Team Leader group or admin).
- **Everyone reads them on their own profile:** avatar menu → new **"My profile"** → `/team/<my id>` → new
  **Documents** section with tabs **Company documents** (read only; leaders get a "Manage in Team Leader" link) and
  **My folder** (full control, private).
- **Other people's profiles show no Documents section.**
- **New company file → notification to everyone** ("New company document: “{name}”"), like team tasks.

## 1. Data (migration `0026_documents.sql`)

```sql
create table public.doc_folders (
  id         uuid primary key default gen_random_uuid(),
  scope      text not null check (scope in ('company', 'personal')),
  owner_id   uuid references public.profiles(id) on delete cascade,   -- personal only; null for company
  parent_id  uuid references public.doc_folders(id) on delete cascade, -- null = top level
  name       text not null check (char_length(btrim(name)) between 1 and 120),
  created_by uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((scope = 'company') = (owner_id is null))
);
create table public.doc_files (
  id          uuid primary key default gen_random_uuid(),
  scope       text not null check (scope in ('company', 'personal')),
  owner_id    uuid references public.profiles(id) on delete cascade,
  folder_id   uuid references public.doc_folders(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 200),
  size        bigint not null check (size between 0 and 26214400),   -- 25 MB
  mime        text not null default 'application/octet-stream',
  path        text not null unique,                                  -- storage path in bucket "documents"
  uploaded_by uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  check ((scope = 'company') = (owner_id is null))
);
```

A folder/file's `scope` and `owner_id` must match its parent folder's (trigger), so a personal file can't sit in a
company folder or someone else's folder.

**RLS (both tables):**
- company rows: `select` for any active member (`public.is_member()`); `insert/update/delete` only `public.is_admin()`.
- personal rows: everything only when `owner_id = my_profile_id()` (admins included — no exception).

**Storage:** private bucket `documents`, `file_size_limit` 25 MB, any type. Paths: `company/<file id>/<name>` and
`personal/<profile id>/<file id>/<name>`. Storage policies mirror the table rules from the first path segments:
company → read for members, write/delete for `is_admin()`; personal → only when segment 2 = `my_profile_id()`.
Files are opened through **signed URLs valid 5 minutes** (never public).

**Notification:** trigger `after insert on doc_files when scope = 'company'` →
`public.notify(<all active members>, 'company_doc', {name}, '/team/<recipient's own id>#documents', uploaded_by)`.
Link: since `notify` uses one link for all, link to `/me/documents`, a tiny route that redirects to `/team/<my id>#documents`.

## 2. Code

- `src/lib/documents.ts` (pure, tested): `breadcrumb(folders, folderId)` → path from top; `childrenOf(folders, files, folderId)` → sorted folders then files;
  `isTooBig(bytes)`; `storagePath(scope, ownerId, fileId, name)` with the name made safe (no `/`, `..`, control chars);
  `fileKind(mime, name)` → `"pdf" | "image" | "other"` (pdf/image open in a new tab, other downloads); `formatSize(bytes, locale)`.
- `src/components/documents/drive.tsx` — one client component `Drive({ scope, canEdit, meId })`: breadcrumb, folders
  then files (icon, name, size, uploader, date, "New" if < 7 days), open/download, and — when `canEdit` — New folder,
  Upload (button + drag and drop, several files), Rename, Delete (confirm when a folder isn't empty). Upload order:
  insert row → upload to storage → on storage failure delete the row (nothing half-saved).
- `src/components/documents/documents-section.tsx` — profile section with the two tabs (`id="documents"`).
- Team Leader tool in `src/app/(app)/g/[slug]/page.tsx`, beside `assignTool`: `Drive scope="company" canEdit` +
  storage bar ("Documents use X of 1 GB"; sum of `doc_files.size`, both scopes, via a `security definer` function
  `documents_storage_used()` that returns only the total).
- `src/components/team/member-dashboard.tsx` gets the section only when `p.id === me.id`.
- `src/components/shell/user-menu.tsx`: "My profile" item above Language.
- `src/app/(app)/me/documents/route.ts` (or page) → redirect to `/team/<my id>#documents`.
- All strings in the 7 `messages/*.json`; notification text `notifications.company_doc`.

## 3. Errors

- Over 25 MB: refused in the browser before uploading ("… is bigger than 25 MB").
- Upload/storage failure: toast + the row is removed. Rename to empty: refused.
- Storage full (Supabase error): toast "Storage is full — ask a leader to delete old files".

## 4. Testing

- `supabase/tests/permissions_test.sql`: member reads company folders/files but can't insert/update/delete them;
  leader can; personal rows invisible and untouchable to other members **and admins**; a personal file can't be put in
  a company folder or another person's folder; a member gets a notification when a leader adds a company file.
- `src/lib/documents.test.ts`: breadcrumb, sorting, size check, safe storage paths (`../x`, `a/b`, emoji, long names), file kind.
- Browser: leader uploads in Team Leader → member sees it on their profile + notification; My folder private.

## Out of scope

Moving files between folders, file versions, sharing a personal file with someone, previews inside the page,
Ask emet reading document contents, Google Drive sync.
