---
tags: [emet, project, zyro-chat, ai]
updated: 2026-10-23
---

# 💬 Zyro Chat

> **ES:** Zyro Chat es una plataforma de IA para negocios de Bilbao: todos los canales (mensajes, llamadas, redes) en una sola bandeja, la IA responde y agenda las citas sin solapes, y 12 "empleados IA" hacen el trabajo repetitivo. Proyecto de Alvaro con Sebastian, Manuel y Julen.

![Zyro Chat site](<../05 Resources/zyro-chat/pitch-video/screenshots (hi-res)/01_site_hero.png>)

**What it is:** an "AI-powered online presence platform for Bilbao's businesses". Businesses lose clients because messages and calls go unanswered. Zyro Chat puts every channel in **one inbox**, lets AI answer, and **books appointments into the client's spreadsheet with no double-booking**. On top of that, **12 AI employees** do repetitive work (positioned against Sintra.ai's "AI Employees").

**Code, run guide and full technical README:** [[05 Resources/zyro-chat/README|Zyro Chat demo site README]] (folder `05 Resources/zyro-chat/`). Double-click `Start Zyro Chat.command` to run it, or open `Open Zyro Chat.html` (works without Node).

| | |
|---|---|
| Team | Alvaro Ibáñez, Sebastian Zacca, Manuel Lanza, Julen Dufour (not the emet team; nobody on the team codes) |
| Contact | zyrochat@gmail.com · website zyrochat.es · handle @zyrochat.es (as listed in the deck) |
| Brand | Zyro Blue `#3346FF` · Ion Cyan `#18C5F2` · off-white `#FAFBFF` · Space Grotesk + Inter + JetBrains Mono |
| Target verticals (may change) | Real estate, notaries, restaurants, fashion stores |
| Pricing | Not published; prospects email zyrochat@gmail.com and pricing is discussed in person |
| Status (Oct 2026) | Investor pitch in preparation (Canva deck, 5-minute slot incl. a ~2-minute product video) |

## How the idea was found
Alvaro had unanswered messages in his own online store, and then talked to local business owners who have the same problem.

## The product (demo site)
React + Vite + TypeScript, Tailwind, Framer Motion, three.js 3D hero. All metrics, customers and testimonials are **illustrative placeholders**, labelled as demo content.

### Business dashboard (a paying customer, `#/app/overview`)
Overview + live activity · **Unified inbox** (Instagram, Messenger, WhatsApp, TikTok, Google Business, email, website chat, Meta & Google lead forms) with AI autopilot / take-over · **Bookings sheet** (Excel-style, CSV export, week view, double-booking prevention) · **Calls** (AI receptionist transcripts) · Connections · AI employees · Business settings.

![Unified inbox](<../05 Resources/zyro-chat/pitch-video/screenshots (hi-res)/06_inbox.png>)
![Bookings sheet](<../05 Resources/zyro-chat/pitch-video/screenshots (hi-res)/07_sheet.png>)
![No double-booking](<../05 Resources/zyro-chat/pitch-video/screenshots (hi-res)/09_conflict.png>)
![AI receptionist calls](<../05 Resources/zyro-chat/pitch-video/screenshots (hi-res)/10_calls.png>)

### Zyro team owner panel (`#/admin/overview`)
All clients · add a client and generate their login · each client's inbox, bookings, calls, connections and info · all inboxes across clients · escalation queue · "Open client dashboard".

![Owner overview](<../05 Resources/zyro-chat/pitch-video/screenshots (hi-res)/13_owner_overview.png>)
![Add a client](<../05 Resources/zyro-chat/pitch-video/screenshots (hi-res)/16_owner_add_client.png>)

Customers get a **login after buying** (no public sign-up); the Zyro team has a separate owner login. Demo businesses: Osteria Luce (restaurant), Hudson & Park Realty (real estate), Mercer Notary Services (notary), Lumora Boutique (fashion). A live demo feed sends a sample message or call every ~15 s.

### The 12 AI employees
| | | | |
|---|---|---|---|
| ![[05 Resources/zyro-chat/src/assets/agents/aria.svg\|60]] **Aria**, Customer Support | ![[05 Resources/zyro-chat/src/assets/agents/leo.svg\|60]] **Leo**, Business Development | ![[05 Resources/zyro-chat/src/assets/agents/kit.svg\|60]] **Kit**, E-commerce Manager | ![[05 Resources/zyro-chat/src/assets/agents/kai.svg\|60]] **Kai**, Data Analyst |
| ![[05 Resources/zyro-chat/src/assets/agents/mara.svg\|60]] **Mara**, Email Marketer | ![[05 Resources/zyro-chat/src/assets/agents/milo.svg\|60]] **Milo**, Copywriter | ![[05 Resources/zyro-chat/src/assets/agents/nico.svg\|60]] **Nico**, SEO Specialist | ![[05 Resources/zyro-chat/src/assets/agents/nova.svg\|60]] **Nova**, Social Media Manager |
| ![[05 Resources/zyro-chat/src/assets/agents/sage.svg\|60]] **Sage**, Sales Manager | ![[05 Resources/zyro-chat/src/assets/agents/remy.svg\|60]] **Remy**, Recruiter | ![[05 Resources/zyro-chat/src/assets/agents/sol.svg\|60]] **Sol**, Personal Growth Coach | ![[05 Resources/zyro-chat/src/assets/agents/otto.svg\|60]] **Otto**, Virtual Assistant |

Each one has a workspace with a **Watch demo** (scripted "screen recording") and **Try it** (mock chat). Avatars: DiceBear "Micah" style by Micah Lanier (CC BY 4.0); keep the credit.

![Agent workspace](<../05 Resources/zyro-chat/pitch-video/screenshots (hi-res)/03_agent_workspace.png>)

**AI Staff** (the Shopify fashion-boutique version) starts with 4 employees: product descriptions & SEO, customer support, ad creative & copy, daily performance report. **€0 AI:** no paid AI API; the brain switches between the free Gemini tier and local Ollama. Product videos are made by hand in Veo 3 from AI-written prompts, and the Meta Ads connection is read-only for now.

## Pitch video (≈2:00)
Voiceover script, storyboard, shot prompts, 14 storyboard frames and 18 hi-res screenshots are in `05 Resources/zyro-chat/pitch-video/` (all shown in the [[05 Resources/zyro-chat/README|README]]).

> "Every day, great businesses lose customers. Not because of what they sell… but because nobody answered." … "Zyro Chat. Never miss a customer again."

![Title card](<../05 Resources/zyro-chat/pitch-video/frames/S02_title_card.png>)
![End card](<../05 Resources/zyro-chat/pitch-video/frames/S14_end_card.png>)

## Links with emet
- The emet HQ dashboard's 14 Oct "Calm" redesign was inspired by Zyro chat → [[Design history]]
- Same city and customers as emet's own client hunt → [[Scout (lead finder)]]

## Open
- [ ] Replace the illustrative metrics, customers and testimonials before any public use #open
- [ ] Add the Canva pitch deck link and the final product video when ready #open
- [ ] Put the code in its own GitHub repo if the team wants to build on it together #open

Back to [[Projects & ideas]] · [[🏔️ emet Dashboard]]
