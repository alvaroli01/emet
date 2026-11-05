---
tags: [emet, system, wep, playbook]
updated: 2026-11-05
---

# Wep render photos — playbook

Status: ✅ Approved by the client · first full delivery 5 Nov 2026 (26 photos) · part of [[Wep (3D renders & virtual tours)]] · 3D side in [[Wep 3D pipeline]]

How we turn a blueprint into **ultra-realistic still photos** of a home that isn't built yet. This replaced the 360° tour on the first job: the agency wanted photos to sell the flat to buyers, not a 3D tour. Everything is €0.

## The pipeline (what works)
1. **Blender base render = the truth for layout.** Model the room in `plan/flat.json` → `blender/build_scene.py` → `out/flat.blend`. Anything whose *position* matters (walls, doors, windows, lamps, bed, closets, toilet, shower, vanity) goes into the model. AI places new objects wrongly.
2. **Render a quick preview, not 4K.** 1280×720 is enough because the AI redraws it anyway:
   ```
   O=(--wb 5000 --exposure 1.4 --fill 1.5 --res 1280 720)   # zsh: pass as an array, not a string
   blender -b out/flat.blend -P blender/render_view.py -- out/stills/NN_room_v1.png \
     --eye X Y 1.45 --target X Y 1.2 --lens 11 "${O[@]}" [--hide curtain.003 ...]
   ```
   - Camera **1.45 m** high, **ultra-wide 11 mm** lens, tight in a corner, so rooms look big (Alvaro's choice; 1.65 m looked too high).
   - Two views per room: window→door and door→window (opposite corners).
   - Use `--hide` for objects right in front of the lens.
3. **AI realism pass** on the render. Attach: the base render, the client's finish/reference photo, and an already-approved photo for consistency. Prompt pattern: *"Make image 1 a real, clean low-ISO interior photo. Keep the camera, walls, doors, windows and every object's position exactly. Materials and finishes from image 2…"*
   - **Google Flow** (flow.google.com, Nano Banana Pro, 0 credits): best quality. Has a daily limit; 2K download still works after hitting it. 4K is paid.
   - **ChatGPT** (Alvaro's Go plan): the backup when Flow is limited. Keep **both views of a room in the same chat** so they match. Output ~1678×937.
   - **Gemini app** (gemini.google.com, "Crear imagen", 16:9) as a third option. The Gemini **API** free tier gives 0 images. Don't use it.
4. **Fix pass.** One change per prompt, and always say "keep everything else pixel-identical".
5. **Deliver.** Number the photos in walk-through order in `out/final/Entrega completa/`, upload them to the client's Drive folder, and keep old versions in each room's `old/` folder.

## Rules that save time
- **Sibling views must match.** Attach the approved view and say *"every object matches image 2 exactly"*. To copy one object exactly (bed, stools, niche), **crop it from the approved photo** and attach the crop.
- Don't attach a whole *other room* as a reference. The AI copies its layout (it added extra tables).
- Never ask for "camera grain". It adds particles Alvaro dislikes. Ask for a *clean low-ISO photo*.
- The sofa always faces the TV, so keep the TV in frame.
- Interior doors and frames are white, window frames black, the entry wardrobe walnut (first job's finishes).
- **When the AI keeps failing the same small fix (2–3 tries), stop and edit the pixels yourself in Python (PIL + numpy).** Example from 5 Nov: in *Baño principal vista 1* the shower niche kept crossing the black glass line. Fixed locally: cut the good niche out of an AI version along its perspective outline, scale it, paste it into the clean wall, and remove the old niche with a fill that blends the 4 border edges plus real wall grain. Start from the last *good* image, never from a failed edit.
- Don't upscale the client's final photos unless asked (Alvaro: send as-is). If 4K is needed: Upscayl (`high-fidelity-4x`, `-s 2`) → crop to 3840×2160.

## Browser tricks (Claude in Chrome)
- **Upload to Flow / Drive:** patch `HTMLInputElement.prototype.click` so it doesn't open the native picker, click "Subir archivo", then use `file_upload` on the file input. Drive takes max ~10 MB per call → batch the photos.
- **Download from ChatGPT:** JS `fetch` of the last `img[alt^="Generated image"]` → blob → `<a download>`. File lands in `~/Downloads`.
- **Replacing a photo on Drive:** move the old file to the trash first, then upload. Uploading the same name otherwise creates a duplicate.

## Where things live
| What | Where |
|---|---|
| Repo (public, never commit client files) | `~/Desktop/3d-modeling-emet` (github.com/alvaroli01/3d-modeling-emet) |
| Client inputs (blueprints, notes, ref photos) | `~/Desktop/Wep 3D Modeling/` |
| Base renders, ref crops | `out/stills/` |
| Final photos per room + `old/` | `out/final/<room>/` |
| Delivery set (26 photos, numbered) | `out/final/Entrega completa/` |
| Client Drive | "Wep · Demos render vivienda" → `Entrega completa` (Emet account) |

## First job: timeline
- 3 Nov: agency wants still photos, not a tour. 4 demo photos (living/kitchen ×2, bedroom 1 ×2) → **client liked them** (4 Nov).
- 4 Nov: rest of the flat: main bedroom + walk-in + study, bathrooms, hallway, bedroom 2. Many layout changes from the agency (walk-in closets, north wing +1.55 m, main door moved).
- 5 Nov: kitchen/living extra views, bathrooms made to match across views, **26 photos delivered on Drive**.
- Still open: what the agency means by "un lavabo y un lavamanos" in the small bathroom (we assumed shower + WC + small basin). #open

Related: [[Wep 3D pipeline]] · [[Wep (3D renders & virtual tours)]] · Back to [[🏔️ emet Dashboard]]
