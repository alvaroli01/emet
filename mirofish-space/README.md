# MiroFish for emet

[MiroFish](https://github.com/666ghj/MiroFish) (AGPL-3.0, by 666ghj / Shanda), at a pinned commit with two small changes in `patch.py` (English by default; MP3/MP4/M4A/WAV/MOV uploads up to 500 MB are transcribed by `media.py` with ffmpeg + Groq Whisper on the same LLM key), used by
the emet Marketing team from **emet → Marketing → Prediction agent**. Only people sent from emet (a signed 12-hour pass) get
past the gate (`gate.mjs`). Saved work is also copied to a private Hugging Face dataset (`sync.py`).

## Where it runs (2026-10-28)
Azure for Students (Alvaro's Mondragon account, no card): resource group `emet-mirofish`, VM `mirofish`,
`Standard_B2ats_v2` (free 750 h/month, 1 GB RAM + 4 GB swap), Ubuntu 24.04, 64 GB P6 disk, Spain Central (the student account only allows denmarkeast, norwayeast, switzerlandnorth, austriaeast, spaincentral),
address `https://emet-mirofish.spaincentral.cloudapp.azure.com` (Caddy, free HTTPS). SSH: `ssh -i ~/.ssh/emet-mirofish azureuser@<that name>`.
Hugging Face Docker Spaces became paid in 2026 and the Oracle sign-up failed, so not those.

## Set up or update
1. Copy this folder to the VM: `rsync -a -e "ssh -i ~/.ssh/emet-mirofish" mirofish-space/ azureuser@<name>:mirofish-space/`
2. On the VM create `~/mirofish.env` (chmod 600) with the secrets below.
3. `sh ~/mirofish-space/setup-vm.sh <name>`: swap, Docker, builds this Dockerfile, runs it, Caddy HTTPS.

In Vercel set `MIROFISH_URL=https://<name>` and `MIROFISH_SECRET` (same value as `GATE_SECRET`). The daily
`/api/health` job opens `/healthz` and notifies the admins if MiroFish doesn't answer.

## `~/mirofish.env`
| Name | What |
|---|---|
| `LLM_API_KEY` | shared team key (free Groq key) |
| `LLM_BASE_URL` | `https://api.groq.com/openai/v1` |
| `LLM_MODEL_NAME` | `openai/gpt-oss-120b` |
| `ZEP_API_KEY` | free Zep Cloud key |
| `HF_TOKEN` | Hugging Face token with write access to the backup dataset |
| `DATA_REPO` | `alvaroibnz/mirofish-data` |
| `GATE_SECRET` | 64 random hex characters (`openssl rand -hex 32`), same as `MIROFISH_SECRET` in Vercel |
