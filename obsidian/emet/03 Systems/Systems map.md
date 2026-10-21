---
tags: [emet, system]
updated: 2026-10-21
---

# Systems map

```mermaid
graph TD
  HQ[emet HQ] --> T[Today]
  HQ --> O[Overview]
  HQ --> B[Task boards + Team tasks]
  HQ --> C[Base camp]
  HQ --> F[Finance]
  HQ --> M[Marketing]
  HQ --> L[Idea lab]
  L --> CO[Council]
  L -->|strong idea| S[Scout]
  S -->|contacted| CU[Customer prospects]
  F -->|how did they hear?| M
  HQ --> ML[Meeting log]
  ML -->|30 days| GD[(Google Drive)]
  F --> GS[(emet Books sheet)]
  HQ --> DB[(Supabase)]
  DB -->|weekly| BK[(emet-backups)]
```

| System | Note |
|---|---|
| [[emet HQ (dashboard)]] | The app |
| [[Today]] · [[Overview (company dashboard)]] | Home + company view |
| [[Task boards]] · [[Team tasks]] | Work |
| [[Base camp]] | Private |
| [[Finance tab]] · [[Marketing section]] | Teams |
| [[Idea lab]] · [[Idea lab council]] · [[Scout (lead finder)]] | Find what to sell + who to sell to |
| [[Meeting log]] · [[Workspace tools]] | Collaboration |
| [[Backups & reliability]] · [[Shared Claude skills]] | Behind the scenes |

Back to [[🏔️ emet Dashboard]]
