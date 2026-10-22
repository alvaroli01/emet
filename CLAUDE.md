# Instructions for Claude in this repo

1. Read `README.md` first — it is the source of truth for the team, goals (€30K revenue / €15K profit by June 2027), roles and systems.
2. Run `git pull` before changing anything; this repo is shared by 15 people and their Claudes.
3. Every change must also update `README.md` (systems, decisions, open questions) and add a line to `CHANGELOG.md`.
4. Before any `git push`, show your human the full diff (`git diff --staged`) and wait for an explicit "push it".
5. Add to other people's work; don't rewrite or delete it without their OK.
6. **€0 budget:** only use free plans, free tiers and free APIs. If something would cost money, stop and say so instead of adding it.
7. Write docs and talk with the team in English or Spanish. Only the team dashboard must support all 7 languages (English, Spanish, German, French, Finnish, Portuguese (Brazil), Russian).
8. Team profiles in `docs/team-profiles.md` are preliminary and some members dispute them — never treat them as final roles.
9. **New database tables need explicit grants** (Supabase rule from 2026-10-30: new `public` tables are no longer exposed automatically). In every migration that creates a table: `grant select, insert, update, delete on public.<table> to authenticated;` plus `alter table … enable row level security;` and its policies. If server code that uses `SUPABASE_SERVICE_ROLE_KEY` (calendar feed, health cron, invites, Drive, Trello, go-links) reads it, also grant it to `service_role`. `app_secrets` is deliberately not granted to `authenticated`.
10. **Keep the Obsidian vault (`obsidian/emet/`) current:** after any change run `python3 obsidian/sync-from-repo.py` (copies CHANGELOG, README decisions, README and the specs index into the vault) and update the hand-written notes it touches — the system's note in `03 Systems/` and today's note in `04 History/Days/` (create it if missing). When someone says "open the emet vault", read `obsidian/emet/🏔️ emet Dashboard.md` and follow its links for the full picture.
