# Notion Step 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each member connects their own Notion (OAuth) and, inside emet HQ, can browse/search/read it, see one Notion deadlines database in their week and My Tasks, save dashboard content to Notion, and have Ask emet read it.

**Architecture:** Raw `fetch` to the Notion API (`Notion-Version: 2026-03-11`) through one small client with token refresh; all calls server-side with the member's own encrypted token. Pure modules (state signing, block → render model, markdown → blocks, properties, deadlines) are unit-tested; routes and UI are thin. No Notion content is stored — fetched live with a short cache.

**Tech Stack:** Next.js App Router, Supabase (RLS), node:test, Notion public integration (OAuth).

**Spec:** `docs/superpowers/specs/2026-10-22-notion-design.md`

All paths relative to `dashboard/`. Tests: `npm test`; DB tests: `PGBIN=$(dirname $(readlink -f $(which psql))) bash supabase/tests/run-local.sh`.

## Global Constraints
- €0; Notion API only (no paid services). Works without `NOTION_CLIENT_ID/SECRET` (card says "not set up yet").
- Tokens (access + refresh) encrypted with `encryptKey` (AES-256-GCM, `AI_KEY_SECRET`); never sent to the browser.
- Every route uses the caller's session and only the caller's own connections (RLS owner-only).
- `Notion-Version: 2026-03-11`: rows via `POST /v1/data_sources/{id}/query`; pages in a data source use parent `{type:"data_source_id"}`; search object filter values `"page"`/`"data_source"`; `in_trash` (not `archived`); block insert uses `position`.
- Notion rate limit ~3 req/s per connection: 429 → wait `retry-after` (max 2 retries).
- New tables: explicit grants + RLS (repo rule 9). UI in 7 languages. Phone rules: phone-only styles under 640px.
- README + CHANGELOG + Obsidian vault (rule 10). Diff → "push it".

## Review Focus
- Forged OAuth callback (state from another member / expired / tampered) must be refused.
- Expired access token: refresh once, save the new pair; refresh fails → connection marked "reconnect", no crash.
- Notion content rendered as text only (no raw HTML) — rich text with links must not allow `javascript:` URLs.
- Member with several workspaces: deadlines + search merge; one failing workspace doesn't break the others.
- Deadlines database deleted/unshared in Notion → week shows nothing from it + settings say "can't read it", page still loads.

---

### Task 1: Database (connections + exports)
**Files:** Create `supabase/migrations/0033_notion.sql`; append to `supabase/tests/permissions_test.sql`.

- [ ] Failing DB tests (append; Rocco = 3, Emily = 6, Alvaro = 1):
```sql
-- ── Notion: each member's own connections and exports ───────
set role authenticated;
select t.login(3);
select t.check('Member saves a Notion connection', $$insert into notion_connections (workspace_id, workspace_name, token_iv, token_data) values ('ws1', 'Uni', 'iv', 'enc')$$, 'ok');
select t.check('...and remembers an export', $$insert into notion_exports (kind, source_id, notion_page_id, url) values ('meeting', gen_random_uuid(), 'p1', 'https://notion.so/p1')$$, 'ok');
select t.login(6);
select t.assert('Nobody else sees the connection', t.num('select count(*) from notion_connections') = 0);
select t.assert('...or the export', t.num('select count(*) from notion_exports') = 0);
select t.check('...or can change it', $$update notion_connections set workspace_name = 'x'$$, 'denied');
select t.login(1);
select t.assert('Admins cannot see it either', t.num('select count(*) from notion_connections') = 0);
reset role;
```
Run → FAIL (relation does not exist).
- [ ] Migration:
```sql
-- Notion (2026-10-22): each member connects their OWN Notion workspace(s) by OAuth. Tokens are encrypted
-- (AES-256-GCM, AI_KEY_SECRET) and readable only by their owner and the server; admins included can't see them.
create table if not exists public.notion_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default public.my_profile_id() references public.profiles(id) on delete cascade,
  workspace_id text not null,
  workspace_name text,
  workspace_icon text,
  bot_id text,
  token_iv text not null,
  token_data text not null,          -- encrypted JSON {access_token, refresh_token}
  needs_reconnect boolean not null default false,
  deadlines_ds text,                 -- data source id of the chosen deadlines database
  deadlines_map jsonb,               -- {"title":"Name","date":"Due","done":"Status"|"Done","doneValue":"Done"}
  save_parent text,                  -- page id new exports go under
  created_at timestamptz not null default now(),
  unique (owner_id, workspace_id)
);
grant select, insert, update, delete on public.notion_connections to authenticated;
grant select, update on public.notion_connections to service_role;
alter table public.notion_connections enable row level security;
create policy notion_connections_owner on public.notion_connections for all to authenticated
  using (owner_id = (select public.my_profile_id())) with check (owner_id = (select public.my_profile_id()));

create table if not exists public.notion_exports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default public.my_profile_id() references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('meeting', 'doc', 'idea', 'project_update')),
  source_id uuid not null,
  notion_page_id text not null,
  url text not null,
  created_at timestamptz not null default now(),
  unique (owner_id, kind, source_id)
);
grant select, insert, update, delete on public.notion_exports to authenticated;
alter table public.notion_exports enable row level security;
create policy notion_exports_owner on public.notion_exports for all to authenticated
  using (owner_id = (select public.my_profile_id())) with check (owner_id = (select public.my_profile_id()));
```
- [ ] DB tests → all pass. Commit.

### Task 2: OAuth state (pure)
**Files:** `src/lib/notion/state.ts`, `src/lib/notion/state.test.ts`.
**Produces:** `signState(memberId: string, now?: number): string`, `verifyState(state: string, memberId: string, now?: number): boolean` — HMAC-SHA256 with `AI_KEY_SECRET` over `memberId.issuedAtMs.nonce`, base64url, 10-minute lifetime.
- [ ] Tests: round-trip ok; other member → false; after 10 min → false; tampered signature → false; garbage → false. Watch fail → implement (node:crypto `createHmac`, `timingSafeEqual`) → pass → commit.

### Task 3: Blocks → render model, markdown → blocks (pure)
**Files:** `src/lib/notion/blocks.ts`, `src/lib/notion/blocks.test.ts`.
**Produces:**
```ts
export type Span = { text: string; bold?: boolean; italic?: boolean; strike?: boolean; code?: boolean; underline?: boolean; color?: string; href?: string };
export type RNode =
  | { kind: "heading"; level: 1 | 2 | 3; spans: Span[]; id: string }
  | { kind: "paragraph" | "quote" | "callout"; spans: Span[]; id: string; icon?: string }
  | { kind: "bullet" | "number" | "todo" | "toggle"; spans: Span[]; checked?: boolean; id: string; children: RNode[] }
  | { kind: "code"; text: string; language: string; id: string }
  | { kind: "divider"; id: string }
  | { kind: "image" | "file" | "bookmark"; url: string; caption: Span[]; id: string }
  | { kind: "table"; rows: Span[][][]; header: boolean; id: string }
  | { kind: "child"; title: string; target: string; db: boolean; id: string }
  | { kind: "columns"; columns: RNode[][]; id: string }
  | { kind: "unsupported"; type: string; id: string };
export function spans(rich: unknown): Span[];            // Notion rich_text[] → Span[] (href only http(s)/mailto/notion pages)
export function toRender(blocks: unknown[]): RNode[];      // children already attached as block.children
export function markdownToBlocks(md: string): object[];    // headings, -, 1., - [ ], >, ```, ---, | tables |, **b** *i* `c` [l](u); rich text ≤ 2000 chars per item
export function chunk<T>(xs: T[], n?: number): T[][];      // 100 per request
```
- [ ] Tests: every supported type maps; unknown type → unsupported; `javascript:` link dropped; numbered list continuity; to-do checked; table rows; markdown → blocks for each construct; text > 2000 split; 250 blocks → 3 chunks. Watch fail → implement → pass → commit.

### Task 4: Properties + deadlines (pure)
**Files:** `src/lib/notion/props.ts`, `src/lib/notion/deadlines.ts`, tests for both.
**Produces:**
```ts
// props.ts
export type PropValue = { type: string; text: string; date?: { start: string; end: string | null }; checked?: boolean; url?: string };
export function readProp(p: unknown): PropValue;          // title, rich_text, number, select, multi_select, status, date, checkbox, people, url, email, phone_number, formula, created_time, last_edited_time
export function titleOf(page: unknown): string;
// deadlines.ts
export type DeadlineMap = { title: string; date: string; done?: string; doneValue?: string };
export function detectMap(schema: Record<string, { type: string; status?: { options: { name: string }[]; groups?: { name: string; option_ids: string[] }[] } }>): DeadlineMap | null;
export type NotionDeadline = { id: string; title: string; day: string; start: string | null; end: string | null; done: boolean; url: string };
export function toDeadlines(rows: unknown[], map: DeadlineMap, tz?: string): NotionDeadline[];  // Madrid time; all-day when date has no time
```
- [ ] Tests: each property type read; detectMap picks title + first date + status ("Done"/"Complete" group) or checkbox; null when no date column; toDeadlines all-day vs timed (Europe/Madrid), done detection, rows without date skipped. Watch fail → implement → pass → commit.

### Task 5: Client + connection helpers (server)
**Files:** `src/lib/notion/client.ts`, `src/lib/notion/server.ts`.
**Produces:**
```ts
// client.ts
export const NOTION_VERSION = "2026-03-11";
export class NotionError extends Error { status: number }
export async function notion(conn: Conn, path: string, init?: { method?: string; body?: unknown }): Promise<any>; // refresh on 401 once, 429 wait (≤2), throws NotionError
// server.ts
export type Conn = { id: string; workspace_id: string; workspace_name: string | null; workspace_icon: string | null; access: string; refresh: string | null; deadlines_ds: string | null; deadlines_map: DeadlineMap | null; save_parent: string | null };
export async function myConnections(sb: SupabaseClient): Promise<Conn[]>;    // decrypts; skips needs_reconnect
export async function saveTokens(sb: SupabaseClient, id: string, t: { access_token: string; refresh_token?: string }): Promise<void>;
export function oauthConfigured(): boolean;
export async function exchangeCode(code: string): Promise<TokenResponse>;   // POST /v1/oauth/token, Basic auth, redirect_uri
export async function refreshTokens(refresh: string): Promise<TokenResponse>;
export async function loadMyNotionDeadlines(sb: SupabaseClient, from: string, to: string): Promise<{ status: "not_connected" | "connected" | "unreachable"; items: NotionDeadline[] }>;
```
- [ ] Test (`client.test.ts`, stub `fetch`): 401 → refresh → retried with new token and `onTokens` called; second 401 → NotionError 401; 429 waits retry-after then succeeds. Watch fail → implement → pass → commit.

### Task 6: Connect / callback / disconnect / settings + My connections card
**Files:** `src/app/api/notion/{connect,callback,disconnect,settings}/route.ts`, `src/components/camp/notion-card.tsx`, edit `src/components/camp/ai-connections.tsx` (MyConnections adds `<NotionCard />`), messages ×7 (`notion.*`).
- connect: session → `signState(me)` → redirect to `https://api.notion.com/v1/oauth/authorize?client_id=…&response_type=code&owner=user&redirect_uri=…&state=…`.
- callback: `verifyState` (refuse otherwise) → `exchangeCode` → upsert `notion_connections` (encrypted `{access_token, refresh_token}`, workspace fields, `needs_reconnect=false`) → redirect `/team/<me>#connections?notion=ok`; `error` param → `?notion=cancelled`.
- disconnect: delete own row by id.
- settings GET: list own connections (no tokens) + for each, Notion search of data sources (for the deadlines picker) and pages (for Save-to picker); POST: save `deadlines_ds` (+ `detectMap` from `GET /v1/data_sources/{id}` unless a map is posted) and `save_parent`.
- NotionCard: "not set up yet" when not configured; connected workspaces (icon + name, "Reconnect" if needs_reconnect), Connect another, deadlines database select + column selects, Save-to page select, Disconnect; steps shown when not connected (like the other cards).
- Public pages Notion requires for a public integration: `src/app/privacy/page.tsx` and `src/app/terms/page.tsx` (short, plain English: what emet HQ reads from Notion, that it's per member, tokens encrypted, disconnect any time, no selling of data; contact: Alvaro) — allowed without login in `src/middleware.ts`.
- [ ] Manual check with stubbed env in dev: card renders, connect redirects to notion.com with the right params; /privacy and /terms open logged out. Commit.

### Task 7: Base camp → Notion tab (browse, search, read)
**Files:** `src/app/api/notion/{search,page/[id],database/[id]}/route.ts`, `src/components/notion/{notion-tab,notion-page,notion-render,notion-db}.tsx`, edit `src/app/(app)/camp/page.tsx` (tab `notion`), messages ×7.
- search: `POST /v1/search` across own connections (query, page_size 20), returns `{id, title, icon, kind: page|data_source, workspace, url}`; no query = recently edited.
- page: `GET /v1/pages/{id}` + blocks `GET /v1/blocks/{id}/children` (paginate, depth ≤ 3 for toggles/lists/columns, ≤ 300 blocks) → `toRender`; 60 s in-memory cache keyed by owner+id.
- database: `GET /v1/data_sources/{id}` (schema) + `POST /v1/data_sources/{id}/query` (page_size 50, cursor) → rows via `readProp`.
- UI: left list (search box + results / recent + child pages) and right page view; phone: list → page full screen with back. Render spans as React text (no HTML), links `target=_blank rel=noopener`. "Open in Notion" on every page. Empty state → connect card link.
- [ ] Browser check (dev, real connection after Alvaro's app setup — until then a stubbed JSON fixture page). Commit.

### Task 8: Deadlines in the week + My Tasks + Ask emet
**Files:** edit `src/app/(app)/today/page.tsx`, `src/app/(app)/camp/page.tsx`, `src/app/(app)/my-tasks/page.tsx`, `src/components/home/week-calendar.tsx` (kind `"notion"`, purple), `src/components/home/phone-week.tsx` (notion flag), `src/components/camp/personal-dashboard.tsx` (status `"notion"`), `src/lib/my-schedule.ts` (+ `notion` items, type `notion`), `src/app/api/ask/route.ts` (+ deadlines + top-5 search excerpts ≤ 8K chars).
- [ ] Test (`my-schedule.test.ts`): notion items appear with type notion, in range only. Watch fail → implement → pass. Browser check Today/Base camp/My Tasks. Commit.

### Task 9: Save to Notion
**Files:** `src/app/api/notion/export/route.ts`, `src/components/notion/save-to-notion.tsx`, buttons in Meeting log doc view, Base camp doc view, Idea lab idea view, project updates; messages ×7.
- export POST `{kind, source_id}`: load the source with the caller's RLS (must be readable by them), build markdown (title + body; idea = analysis + council verdict), pick connection with `save_parent` (first one; picker if several), `POST /v1/pages` (parent page_id, title, first 100 blocks) then append remaining chunks (`PATCH /v1/blocks/{id}/children`, `position: {type:"end"}`), insert `notion_exports`, return url. Existing export → return its url.
- Button: "Save to Notion" → spinner → "Open in Notion". No connection / no save page → link to My connections.
- [ ] Browser check on one meeting doc. Commit.

### Task 10: Docs, review, live
- [ ] README (systems row + decision), CHANGELOG, vault (`sync-from-repo.py` + `03 Systems/Notion.md` + day note).
- [ ] Final whole-branch review (fresh reviewer); fix Critical/Important with a failing test first.
- [ ] Alvaro: create the public integration at notion.so/profile/integrations (name "emet HQ", type Public, redirect URIs, capabilities per spec, website/privacy/terms URLs) → `NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET` in Vercel (+ `.env.local`).
- [ ] Show diff → "push it" → migration 0033 in the Supabase SQL editor → deploy → live check with Alvaro's Notion.
