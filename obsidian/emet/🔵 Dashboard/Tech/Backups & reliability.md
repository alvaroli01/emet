---
tags: [emet, system]
updated: 2026-10-21
---

# Backups & reliability

Status: ✅ Live · part of [[emet HQ (dashboard)]]

- **Weekly encrypted backups** every Sunday via GitHub Actions → private repo `alvaroli01/emet-backups` (AES-256, last 12 weeks, passphrase kept by Alvaro). First backup verified
- **Daily keep-alive** (Vercel Cron `api/health`) so the free database never pauses
- Note-taker audio auto-deleted after **60 days**; transcripts kept forever
- Meeting audio → Google Drive after **30 days**

Back to [[Systems map]]
