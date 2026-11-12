---
tags: [emet, system]
updated: 2026-11-12
---

# Security

Status: ✅ Baseline done 12 Nov 2026 · part of [[emet HQ (dashboard)]]

**How we check:** the shared skills `vibe-security`, `security-review`, `owasp-top-10-testing` and `supabase-audit-rls` (in `.claude/skills/`, see [[Shared Claude skills]]). Ask Claude "run a security audit on emet".

## What protects emet
- **Database:** every table has Row Level Security; logged-out visitors can't read any table **or call any function** (migration 0068, 12 Nov). New functions are closed to them automatically.
- **Files:** all storage buckets are private except `avatars`.
- **API routes:** every route checks the login (or a secret for cron / Trello / push / calendar feeds) before doing anything.
- **Headers** (`dashboard/next.config.ts`): other sites can't put emet in a frame (clickjacking), no MIME sniffing, no full URLs leaked to other sites, only emet pages may use mic + location.
- **Stored AI keys:** AES-256-GCM, never sent back to the browser.

## Fixed on 12 Nov 2026
- Outsiders could call DB functions and read leader/member ids, strike counts.
- A member could have deleted a whole Trello board via the Trello sync route — now only real cards on a synced board.
- `login?next=/\evil.com` could send someone to another site after login.

## Still open (low risk)
- Scout reads any website pasted as a place's site (no block on private IPs).
- Push notifications go to any https endpoint a member registers.
- Project invite tokens don't expire.
- Cron secrets are compared with plain `===`.

Related: [[Backups & reliability]] · [[Tech stack]]
