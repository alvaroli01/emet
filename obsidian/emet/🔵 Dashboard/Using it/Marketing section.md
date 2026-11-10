---
tags: [emet, system]
updated: 2026-10-21
---

# Marketing section

Status: ✅ Live · part of [[emet HQ (dashboard)]]

Spec: `docs/marketing-build-prompt.md` (from a 4-part research report). Migration 0017. Manual logging now; Instagram sync later (needs Business/Creator account).
- **Pulse:** profit vs €15K pace, posts/week, **hit rate** (7-day views ≥ 2× our own median), share + save rate, DMs that bought, revenue by channel, do more / do less by tag
- **My week:** numbers to log at 24 h / 48 h / 7 days, content due, briefs, design requests
- **Content** pipeline idea → posted, glossary tags, leaderboard
- **Briefs** (leader approves → content) and **Campaigns** (objective, target, post-mortem)
- **What works:** scale / iterate / kill, performance by tag, experiments, swipe file
- **Attribution:** emet short links `/go/…` with UTMs, click counts, QR codes; discount codes per channel; DM inquiries; funnel
- **Prediction agent** (2026-10-28): MiroFish inside the tab — upload a brief, say what to predict, AI agents react. Azure for Students VM `mirofish` (group `emet-mirofish`, Spain Central), signed 12-hour pass, backup to HF dataset `alvaroibnz/mirofish-data`. Setup: `mirofish-space/README.md`. Keep runs small (free keys). English by default; MP3/MP4/M4A/WAV/MOV (≤500 MB) are transcribed with ffmpeg + Groq Whisper (`patch.py`, `media.py`)

Back to [[Systems map]]
