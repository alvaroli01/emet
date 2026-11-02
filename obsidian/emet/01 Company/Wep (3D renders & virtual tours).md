---
tags: [emet, company, wep, project]
updated: 2026-11-02
---

# Wep: 3D renders & virtual tours

> Alvaro's photoreal 3D render and virtual-tour business, run with emet. First product that emet actually delivers to a client. How it is built → [[Wep 3D pipeline]]

## What we sell
- **Photoreal virtual tours of properties.** They work like Matterport: you walk through by clicking anywhere, and there is a **3D dollhouse** and a **clickable floor plan**. Reference: century21.es/comprar/C0026-02688.
- **Unbuilt or renovation jobs:** we model the flat from the blueprint at its **real measurements**, furnish it, and render every viewpoint as a 360° image. The buyer sees the finished home before the work is done.
- **Existing homes:** real 360° photos would go in the same tour viewer (not done yet).
- **Delivered as a web link** (hosted free), plus still renders on request.
- **Customers:** estate agencies (inmobiliarias), developers and renovation companies selling flats off-plan or before the renovation.
- **Price:** not set yet #open

## How a job runs
1. The client gives us the blueprint, their notes and reference photos of the finishes they want.
2. We draw the plan in `plan/flat.json` (walls, doors, windows, rooms, furniture, tour spots). It is checked against the blueprint scale, about 80 px/m.
3. We build the 3D scene in Blender, test-render a few views, compare them with the reference photos and fix the differences.
4. We render all 360° views (about 3.5 min each on the M4 GPU, ~43 views ≈ 2.5 h), then the floor plan and the dollhouse.
5. We publish the tour and send the client the link. They give feedback and we repeat from step 2.

## First job: renovated flat (30 Oct–2 Nov 2026)
- Inputs (blueprints, notes, 3 reference photos from the estate agency) are on Alvaro's Desktop in `Wep 3D Modeling/`.
- The agency asked for: the finishes and materials in their photos, laminate floor in the whole flat (we chose light), and bathroom floors kept as tile.
- Changes from the agency: both bathroom doors side by side on the hallway, and the hallway closed off from the kitchen at the armario.
- Kitchen as in their photo:
  - walnut fronts and walnut column units up to the ceiling, with brass bars
  - white marble worktop and a waterfall island with a black sink and a brass gooseneck tap
  - beige stone wall and three glass-and-brass pendants
- Main bathroom:
  - dark grey stone vanity wall and floor, beige stone walls
  - cream double vanity on black legs, arched black mirrors
- Bathroom 2:
  - grey glossy vertical tiles over light grey stone, with an LED cove
  - charcoal vanity and black fittings
- Live link: wep-tour.netlify.app. Visitor access is still team-only, so it has to be made public before the client sees it. #open

## Open
- [ ] Price list per m² / per job #open
- [ ] Make the Netlify site public; the dollhouse (~44 MB) is slow on phones #open
- [ ] Real-photo tours for existing homes #open

Related: [[Projects & ideas]] · [[Wep 3D pipeline]] · Back to [[🏔️ emet Dashboard]]
