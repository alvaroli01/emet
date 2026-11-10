---
tags: [emet, system, wep, website]
updated: 2026-11-10
---

# wepemet website

> The public business website for [[Wep (3D renders & virtual tours)|Wep]], branded **wepemet**. It sells three services: render photos, virtual tours and websites for property sales.

## Where it lives
- **Live:** https://wep-emet.pages.dev (Cloudflare Pages, account minipecas5@gmail.com). An older copy is at https://wep-emet.vercel.app (Vercel team emet12), last updated 6 Nov.
- **Code:** private GitHub repo https://github.com/alvaroli01/wep-emet-web, default branch `astro` (`main` = the old pre-Astro version). Local copy at `~/Desktop/wep-emet-web`. Pushed on 10 Nov.
- Spec and plan are in the `3d-modeling-emet` repo under `docs/superpowers/*/2026-11-06-wep-emet-website*`.

## What's on it
- Spanish at `/` and English at `/en/`, with an ES | EN switch.
- Pages: home, `/renders`, `/tours`, `/proyectos`, `/nosotros` (team + story), `/webs`, plus legal notice, privacy and cookies.
- Clean white, Apple-like style. Logo "plano → E sólida" rebuilt in vector (Manrope ExtraBold + gold #C9A15B).
- Team page: Alvaro (CEO), Mario (web), Francisco (360° models), Gordon (software/servers). Timeline: Phuket → Marbella & País Vasco → today.
- "Why wepemet" uses sourced facts (Texas Tech / Matterport: up to 31% faster sales, 4–9% better price, 92% of buyers).
- The tour page shows 8 rooms rendered from the photo-matched 3D model.
- **Webs section** (10 Nov) shows two example sites side by side:
  - **Promoción de obra nueva** (`/demo-web/`): a straight-on tower where you hover or tap to pick a floor, then the camera flies into a lit window. Inside is a photo tour of the client photos (round 2 set, not upscaled).
  - **Web de empresa inmobiliaria** (`/demo-empresa/`): an anonymised copy of Alvaro's corporate demo with a made-up brand "Nordia". `tools/demo_empresa.py` builds it and asserts that nothing of the real client is left.
  - A 6-step "Cómo se hace" breakdown with the demos' real code. On phones it shows tap-to-open poster cards instead of iframes.

## How to work on it
- Built with Astro. Pages are in `src/pages/[...slug].astro` + `src/views/*`, data in `src/data/{strings,config,photos}.json`, and images + tour in `public/` (refresh with `npm run assets`).
- `npm run build` runs the Astro build plus the `tools/check.py` gate, which refuses TODOs and missing legal data. Run `python3 -m pytest tests` after the build (52 tests, including Playwright).
- Deploy with `npm run deploy` (needs a wrangler login). **Never** run `wrangler pages project create`: it adds a Cloudflare adapter that breaks the static build.
- Push: plain `git push` fails because global git config forces SSH. Push with the gh token instead (command in Claude's memory, "Wep 3D").

## Open
- [ ] Real NIF: `legal_id` is "En trámite" in `src/data/config.json`. Replace it and redeploy #open
- [ ] `/demo-empresa/` still uses some of the real client's property/hero photos (`assets/real`). Swap them for our renders? #open
- [ ] Cal.com username is empty #open
- [ ] Own domain (~€10/yr), optional #open
- [ ] Update or retire the Vercel copy #open

Related: [[Wep (3D renders & virtual tours)]] · [[Wep 3D pipeline]] · [[Wep render photos (playbook)]] · Back to [[🏔️ emet Dashboard]]
