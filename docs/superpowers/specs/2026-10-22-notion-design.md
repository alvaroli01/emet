# Notion inside emet HQ

Date: 2026-10-22 · Owner: Alvaro · Status: draft for review

## Goal
Each member can use their own Notion (uni or personal) from inside the dashboard: read, search, edit, create, and see Notion deadlines next to their emet work. €0 (the Notion API is free).

## Decisions (Alvaro)
- **Per person:** every member connects their own Notion, like the Groq key. Nobody else (admins included) can see it.
- **Everything:** see pages, Notion deadlines in my week, send dashboard content to Notion, Ask emet reads Notion, and use the whole Notion from the dashboard (edit too).
- **Not possible:** Notion blocks being embedded (no iframe of notion.so), so the dashboard has its own Notion screen built on the official API. Blocks the API can't edit (synced blocks, some embeds, buttons, forms) are shown read-only, with **Open in Notion**.

## Connecting (OAuth)
- emet registers one free **public Notion integration** "emet HQ". The settings below are Alvaro's one-time setup, walked through at build time.
  - Redirect URL: `https://emet-hq.vercel.app/api/notion/callback` (plus localhost for development)
  - Capabilities: read content, update content, insert content, read comments, insert comments, read user info without email
  - Website, privacy and terms pages: on emet-hq
- Vercel env: `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`. Without them the Notion card says "not set up yet".
- **Connect Notion** (My connections card) → Notion's own page picker → callback → the access token is stored **encrypted** (AES-256-GCM, `AI_KEY_SECRET`).
- A `state` value guards against forged callbacks (signed, 10-minute lifetime, bound to the member).
- People can connect several workspaces (e.g. uni + personal), one row each. Disconnect deletes the row.
- If a workspace admin blocks outside apps, Notion refuses at the picker. The card explains this.

## Step 1: read, search, deadlines, save, ask

### Base camp → Notion tab
- The sidebar lists workspaces, then a page tree of the top pages shared with emet and their children, loaded as you open them, plus **Search** (Notion search API).
- **Page view:** blocks rendered as headings, text with bold/italic/links/colour, bullet/numbered/to-do/toggle lists, quote, callout, code, divider, image, file, bookmark, table, child page/database links and column layout. Anything else gets a grey "Open in Notion" chip.
- **Database view:** a table of rows with properties (title, text, number, select, multi-select, status, date, checkbox, people, URL), sorted by the database's own order. Open a row = page view.
- Phone: list first, then the page fills the screen with a back button (same rules as the phone version).

### Notion deadlines in my week
- In settings, pick one **deadlines database** per connection. The dashboard detects its title, date and status/checkbox columns, and you can change them.
- Items from 14 days back to 60 days ahead show:
  - in **Today → Your week** and **Base camp → My week**, in purple, with "Notion"
  - in **My Tasks** under "From Notion"
  - as links to the Notion page
- Fetched live with a 5-minute cache, the same pattern as Google Calendar.

### Save to Notion
- In settings, pick a **"Save to" page** per connection.
- A **Save to Notion** button appears on:
  - meeting notes and transcripts (Meeting log and Base camp docs)
  - Idea Lab analyses (with council)
  - project updates
- Markdown is converted to Notion blocks (headings, lists, to-dos, quotes, code, links, tables), in chunks of 100 blocks.
- The link is remembered, so the button then reads **Open in Notion** (`notion_exports`).

### Ask emet reads Notion
- Ask emet adds the asker's Notion context:
  - deadlines for the next 60 days
  - search hits for the question's key words (top 5 pages, about 1,500 characters each)
- Context is capped at about 8K characters to stay within the free AI limits.

## Step 2: edit and create
- **Edit text in place:** click a paragraph, heading or list item to edit it, then save (`PATCH /blocks/{id}`).
- **Add a block** below (text, heading, bullet, number, to-do, quote, divider), delete a block, and tick to-dos.
- **New page** under any page you can edit, and **New row** in a database.
- **Edit database properties** in the table: text, number, select/status (Notion's own options), date, checkbox, URL.
- **Tick a Notion deadline done** from My Tasks or My week: sets the mapped status to its "done" option, or the checkbox.
- **Comments:** read a page's comments and add one.
- **Files:** upload an image or file into a page (Notion file upload API, size limits as Notion allows).
- **Conflicts:** before saving a block we check its `last_edited_time`. If someone changed it in Notion meanwhile, the dashboard shows "changed in Notion, reload" and doesn't overwrite.

## Data (migration 0033)
- `notion_connections`: id, owner_id → profiles, workspace_id, workspace_name, workspace_icon, bot_id, token_iv, token_data, deadlines_db, deadlines_map jsonb, save_parent, created_at.
  - Owner-only RLS (select/insert/update/delete).
  - Grants: authenticated + service_role select (rule 9).
  - Unique per (owner_id, workspace_id).
- `notion_exports`: owner_id, kind (meeting/doc/idea/project_update), source_id, notion_page_id, url, created_at. Owner-only.
- No Notion content is stored in our database; it's fetched live, plus a short in-memory cache.

## Server
- `src/lib/notion/`:
  - `client.ts`: fetch wrapper with Notion-Version (current version checked at build time), 429 → wait `retry-after`, 401 → mark the connection "reconnect".
  - `blocks.ts`: render model and markdown → blocks, pure and tested.
  - `props.ts`: property read/write, pure and tested.
  - `deadlines.ts`: database rows → week items, pure and tested.
- Routes: `/api/notion/connect`, `/callback`, `/disconnect`, `/settings`, `/search`, `/page/[id]`, `/blocks/[id]` (step 2), `/database/[id]`, `/export`.
  - All use the caller's own token.
  - None is reachable without the caller's session.

## UI
- My connections: a **Notion** card listing connected workspaces (name and icon), **Connect another**, settings (deadlines database, columns, Save-to page) and **Disconnect**.
- Base camp → **Notion** tab, plus the Notion items in the week and My Tasks.
- 7 languages.

## Security
- Tokens are encrypted and never sent to the browser.
- Routes act only as the logged-in member with their own token.
- OAuth `state` is signed.
- Exported pages are created only under the member's chosen parent.
- Content shown in the dashboard is escaped, so there's no raw HTML from Notion.

## Testing
- Node tests:
  - block rendering for every supported type, and unsupported types → chip
  - markdown → blocks (lists, to-dos, tables, chunking)
  - property read/write per type
  - deadline mapping (date ranges, status "done")
  - OAuth state sign/verify, expiry and wrong member
- DB tests: owner-only on both tables; admins can't read others' rows.
- Browser: connect a real Notion (Alvaro's), browse, read, search, see deadlines in the week, Save to Notion; step 2 edit, tick and create.

## Out of scope
- Real-time collaborative editing (we save per block).
- Notion AI.
- Workspace admin features.
- Moving pages between parents.
- Inline database views other than a table.
