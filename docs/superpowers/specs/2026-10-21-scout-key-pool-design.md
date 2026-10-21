# Scout — no more daily-limit stops (key pool + Mistral backup + fewer tokens)

Date: 2026-10-21 · Owner: Alvaro · Status: draft for review

## Problem
Scout runs on the searcher's own free Groq account. Groq limits are per **account** (organization):
gpt-oss-120b, gpt-oss-20b and qwen3.8-27b each give 200K tokens/day (8K/min). A few searches use that up and
Scout then waits 15+ minutes or until tomorrow. Must stay €0, no cards.

## 1. Team key pool (opt-in)
- New switch next to "Connect your Groq key": **"Lend my AI key to Scout"** (off by default). Text explains:
  only Scout uses it, never Ask/Idea Lab/notes; nobody can see the key; turn off any time; shows
  "Scout used N tokens of your key today".
- `ai_keys.lend_scout boolean not null default false` — owner sets it (existing owner-only RLS).
- Only `/api/scout/step` and `/api/scout/check` use the pool, after checking `can_scout()`. They read lent keys
  with the service role (grant `select` on `ai_keys` to `service_role`). Keys are decrypted only on the server,
  never returned, never logged.
- Order: the searcher's own key first, then lent keys with the fewest Scout tokens used today.
- `ai_key_usage(owner_id, day, model, tokens, limited_until, bad)` — written only by the service role;
  owner can read their own rows (for the "used today" line). A key that hits a 429 on a model gets
  `limited_until = now + retry-after` so later steps skip it straight away. A key Groq rejects (401/403) is marked
  `bad` for the day and skipped (its owner sees "Groq rejected your key").
- `call()` takes a key ring instead of one key: for each key, for each model → skip if limited/bad, try, on 429
  mark and move on. It only reports "limit" when every key × model is out; the wait is the shortest
  `limited_until`. Tokens from `usage.total_tokens` are added to `ai_key_usage`.
- Other features (Ask, Lab, notes) keep using only your own key — unchanged.
- **Never break the lender's own work:** Scout uses a *lent* key only up to **60%** of each model's daily
  allowance (120K of 200K tokens, counted in `ai_key_usage`), so the owner always keeps ≥80K/model for their own
  Ask, Idea Lab, notes and their own Scout searches. Your *own* key has no cap (as today).
- **It learns:** `limited_until`, `bad` and today's tokens are stored, so every step (and every person's search)
  skips keys that are out without trying them again, and picks the next one at once. A new day (UTC, Groq's reset)
  starts fresh.
- **Any time:** a search never fails because one key is out; it moves to the next key, then to Mistral, and only
  waits when everything is out (shortest wait shown).

## 2. Mistral backup (free Experiment plan, no card)
- One team account; key in Vercel env `MISTRAL_API_KEY` (Alvaro creates it). Scout works without it.
- Used only when every Groq key/model is out, and only for calls without web search: plan, relevance, judge.
  Same JSON prompts, `response_format: json_object`. Plan/relevance: `mistral-small-latest`;
  judge: `mistral-medium-latest` (Mistral's docs name Medium 3.5 as the replacement for Large; the IDs are checked
  with `GET /v1/models` once the key exists).

## Accuracy guarantee
- The **judge (final score) runs only on gpt-oss-120b** across all pool keys — no fallback to smaller Groq models
  any more — then `mistral-medium-latest`; if both are out it waits instead of scoring with a weaker model.
- Web check and relevance keep their current models (20b first), which only gather/filter, not score.
- Mistral's free plan allows ~2 requests/min, so a 429 from it is treated like any other limit (wait shown).
- Only public business info and the project brief are sent (free-plan data may be used for training).

## 3. Fewer tokens per place
- ~~Skip the web search when the website gave ≥3 pages~~ — dropped (Alvaro: "ALWAYS super accurate"): the web
  search brings outside sources and reviews the website can't, and the pool makes the saving unnecessary.
- Record `usage.total_tokens` per call so the log can show "~N tokens" per search and we can see what costs most.
- The judge stays on gpt-oss-120b first (accuracy) — no downgrade.

## Data (migration 0032)
`ai_keys.lend_scout`, `ai_key_usage` table (+ RLS: owner select; grants: select to authenticated, all to
service_role), `grant select on ai_keys to service_role`, and `scout_lenders()` (security definer, members only,
returns just the lenders' names — never keys or usage).

## UI
- Key settings card: the lend switch + "used today" line (7 languages).
- Scout: when the pool is being used the log says "Using the team's shared keys (N available)"; when everything
  is out: "All team keys and the backup are used up — continues in M min".
- Scout page: "N people lend their key to Scout" with their names (so the team knows whom to thank), no usage numbers
  of other people.

## Testing
- Node tests: key-ring order (own first, then least used), skipping limited/bad keys, the 60% cap on lent keys
  (own key uncapped), judge only on 120b/mistral-medium, "limit" only when all out with the shortest wait, Mistral used only without tools and only after Groq is out.
- DB tests: a member can toggle only their own `lend_scout`; nobody (admins included) can read another member's key
  or usage rows as `authenticated`.
- Live: run one Scout search after the change and check the log + `ai_key_usage`.
