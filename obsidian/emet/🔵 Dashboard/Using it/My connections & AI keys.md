---
tags: [emet, system]
updated: 2026-10-22
---

# My connections & AI keys

Status: ✅ Live · part of [[emet HQ (dashboard)]] · Avatar menu → **My connections** (your profile)

One place for everything emet connects to for you; anything not connected shows its steps right there.

| Connection | What it does | Notes |
|---|---|---|
| Groq (main AI) | Free key that powers Ask emet, [[Idea lab]], notes and [[Scout (lead finder)]] | Each member's own free account (200K tokens/day per model) |
| Mistral (backup AI) | Free key (Experiment plan, no card); Scout's last resort when every Groq key is out | Never used for web search |
| Lend my key to Scout | Opt-in switch; Scout rotates through lent keys | Lent keys capped at 60% of each model's daily allowance, so the owner keeps the rest |
| Google Calendar | Secret iCal link → events in Today and Base camp | Read only, private |

- Keys are encrypted (AES-256-GCM); nobody, admins included, can see another member's key or link.
- Scout tries: own key → lent keys (least used today first) → Mistral; final score only from gpt-oss-120b or Mistral Medium, else it waits.
- Tables: `ai_keys.lend_scout`, `ai_key_usage`, `backup_keys` (migration 0032).

Back to [[Systems map]]
