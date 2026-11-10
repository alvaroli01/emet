---
tags: [emet, system, wep]
updated: 2026-11-02
---

# Wep 3D pipeline

Status: ✅ Working, with the first client tour rendering · used by [[Wep (3D renders & virtual tours)]]

All €0 and CC0. Code lives in its own **public** repo, github.com/alvaroli01/3d-modeling-emet (`~/Desktop/3d-modeling-emet`, branch `feat/flat-tour`). Client files, renders and downloaded assets are git-ignored and never committed.

## Pieces
| Step | Tool | Where |
|---|---|---|
| Plan of the flat (walls, openings, rooms, furniture, spots) | JSON + checks + SVG preview | `plan/flat.json`, `plan/validate.py`, `plan/preview.py` |
| Extra tour spots on a 0.5 m grid (click-anywhere movement) | Python | `plan/spots.py` |
| Free textures and models | Poly Haven + ambientCG (CC0); BlenderKit free assets (add-on login in Blender) | `tools/fetch_assets.py`, `tools/fetch_blenderkit.py`, `assets.json`, `blenderkit.json` |
| 3D scene: walls, floors, doors, windows, furniture, materials, light | Blender 5.2 (Cycles, Metal GPU) | `blender/build_scene.py`, `furniture.py`, `materials.py` |
| 360° views (4096 px, 96 samples), floor plan, dollhouse (.glb) | Blender | `blender/render_panos.py`, `render_floorplan.py`, `export_dollhouse.py` |
| Web tour: walk, dollhouse, floor plan | Photo Sphere Viewer 5 + three.js (CDN, pinned) | `web/`, `tools/make_tour.py`, `tools/stage_web.sh` |
| Hosting | Netlify free (`wep-tour`) or Vercel free | `netlify deploy --prod --dir web` |

## Commands
```
python3 -m plan.spots plan/flat.json                      # regenerate auto spots
blender -b -P blender/build_scene.py -- plan/flat.json out/flat.blend
blender -b out/flat.blend -P blender/render_panos.py -- out/panos --samples 96 --width 4096 --force
blender -b out/flat.blend -P blender/render_floorplan.py -- out --samples 64
blender -b out/flat.blend -P blender/export_dollhouse.py -- out/dollhouse.glb --tex 256 --max-polys 2500
bash tools/stage_web.sh                                   # copy renders into web/ + tour.json
python3 -m http.server -d web 8080                        # look locally
```
Quick test before a full render: `--samples 24 --width 2048 --ids s03 s12`.

## Lessons
- Always compare test renders with the client's reference photos before the long render. Matching the materials is not enough; the layout of the pieces matters too (2 Nov feedback).
- Keep the real measurements. Rooms feel more spacious from a wider viewer field of view (110°), light floors, white walls and brighter exposure, not from bigger rooms.
- The full render takes about 2.5 h and needs memory: close heavy apps, or the system can stop it.

Still photos (what the client actually bought): [[Wep render photos (playbook)]]

Related: [[Systems map]] · [[Wep (3D renders & virtual tours)]] · Back to [[🏔️ emet Dashboard]]
