# Bible Strong Study World — PROTOTYPE

Question: does joystick movement with collision and selective foreground occlusion feel convincing on the illustrated archipelago, especially on a phone?

## Run

From the Bible Strong monorepo root:

```sh
yarn dev:world
```

Open http://localhost:5186. On a phone on the same network, use the Network address printed by Vite. No account, API keys, AI service or database is required. The app is the `@bible-strong/world` workspace under `apps/bible-strong-world`.

## Edit navigation zones

Use **Éditer les zones / Edit zones** at the bottom of the screen. The editor loads Leaflet + Geoman Free on demand, over the same image with pixel coordinates (Leaflet latitude is `-y`, longitude is `x`).

- Select a green/red shape or its name in the list. Drag the large handles; drag a midpoint to insert a vertex. Right-click a vertex to remove it.
- Use **Déplacer la zone entière** to drag a whole shape.
- Draw a new green allowed area or red obstacle by placing vertices and clicking the first point to close. Enter also completes a shape. Cancel stops drawing.
- Rename, change allowed/blocked type, delete, undo or redo edits. Undo history keeps up to 80 edits in the current editor session.
- **Tester au joystick** applies the working document immediately. Red always overrides green; avatar clearance is checked against polygon edges. If the current position becomes blocked, the avatar is relocated to the nearest sampled accessible point. An entirely unwalkable document cannot be tested.
- **Sauvegarder** validates the draft and writes it directly to `public/navigation/archipelago.json` through the local Vite development server. Refresh reads that project file; no browser `localStorage` draft is used. Unsaved edits prompt before leaving the page.
- **Exporter JSON** remains an optional portable backup. **Importer JSON** validates the map dimensions/version, shape types, IDs, coordinates and polygon intersections before replacing the working draft. Invalid imports leave the current draft intact. Import is undoable; use **Sauvegarder** afterward to write the imported document to the project file.

Existing ellipse obstacles were converted to 24-vertex polygons. Navigation is independent of the SAM foreground cutouts. Changing a red/green zone changes collisions, not image occlusion.

Detailed objects add 98 smaller ground footprints (16 vertices each), with `detail-…` IDs and descriptive place/object names. Saved and imported revision-1 documents receive this new set once, while keeping all custom green zones, existing red edits and deleted legacy shapes. Revision 2 is retained on save/export: deleting or reshaping a new obstacle remains respected on the next load. A migrated document is written to the project only when **Sauvegarder** is used.

## Controls

- Drag the fixed bottom-left NippleJS joystick: analog direction/speed. Mouse also works.
- Arrow keys, WASD or ZQSD on a computer.
- Pinch with two fingers on mobile, or use the mouse wheel/trackpad on desktop, to zoom. The camera toolbar remains available for overview/follow, zoom in/out and return to plaza.
- Three existing avatar snapshots: Nova, Citrus, Strobi.
- Approach the six resources and press Discover to open a placeholder information panel.
- Diagnostic toggle (or `?debug`) shows walkable polygons, obstacle footprints and foreground bounds. Green = ground, red = obstacles, yellow = cutout bounding boxes (not the actual alpha contours). Live position and frame rate are shown.
- Input is reset on joystick release, cancellation, blur and document visibility changes. Dialogs pause movement.

## Technical choices

- Phaser 3.90.0 renders a fixed 1671 × 941 illustration; its screen-space coordinates are also the navigation coordinates. Isometric projection is already baked into the artwork.
- The source map is normalized to exactly 6684 × 3764 (4× the logical world), then generated as a 1671 × 941 WebP preview plus 512 px WebP tiles at 2× and 4×. The preview appears immediately; the runtime loads only camera-adjacent tiles, prefetches a one-tile border, selects a level from camera/device density, and evicts tiles after eight seconds outside the working set. The full upscale is never loaded by the browser as one texture.
- NippleJS 1.0.4 (MIT) owns touch/pointer tracking. Movement never uses click-to-move or automatic pathfinding.
- React owns the interface, the editable navigation document and session-only visited places. The Phaser loop owns position and animation. State is published to React at about 10 Hz.
- `src/world.ts` contains the initial annotations and geometry functions. Runtime movement uses the current navigation document, checking the avatar footprint against the union of green polygons and distances to red polygon edges, then sliding along blocked edges with short substeps.
- Foreground cutouts are precomputed with SAM 2.1 Hiera Tiny (ONNX community export), using local crops, foreground/background points and bounding boxes. Visually reviewed candidates override model confidence for thin rails and scrolls. Small disconnected noise is removed; table interiors are made opaque. All RGB pixels remain from the original illustration. The original background stays underneath. Occlusion is sorted by ground contact Y, independently of avatar bounce; selected front bridge rails are always foreground.
- The 91 RGBA cutouts live in `public/assets/occlusion`; their source-imported metadata lives in `src/generated`. They replace the old polygon clipping entirely. No segmentation model runs or downloads in the browser. The 73 detailed additions cover vegetation on all six resource islands and the plaza, ground book piles, cabinets, shelves, benches, pillars, the Themes medallions and the Comparisons flower arches. Grouped foliage uses a shared depth anchor; this remains a fixed-artwork approximation, not a reconstructed 3D scene. Entire buildings and roof lattices are not fully isolated. Navigation and ground anchors are still manual annotations.
- The runtime terrain now comes from the supplied 6672 × 3760 Magnific upscale. The generation step normalizes it to the exact 4× world dimensions before producing the progressive assets. The earlier 1671 × 941 concept image remains under `scripts/assets` only as the alignment source for the reviewed foreground cutouts and offline segmentation tools; it is not copied into the production build.
- English, French and Simplified Chinese UI copy is bundled; resource content and avatar-editor integration are outside this first movement prototype.

## Verify

```sh
yarn workspace @bible-strong/world test
yarn workspace @bible-strong/world build
```

Focused geometry tests check land/water/table collision, every detailed footprint, walking behind a canopy, bounded diagonal speed, release, long-frame collision, usable resource markers, reachability of all six stations and non-destructive saved-document migration. Browser QA additionally exercises joystick input, bridge traversal, release, keyboard, camera and phone-sized rendering. Physical iPhone/Android validation is still needed.

Sources: https://github.com/yoannmoinet/nipplejs and https://github.com/phaserjs/phaser.

## Regenerate the offline masks

Use a tools-only Python environment with `onnxruntime`, `numpy`, `Pillow` and `opencv-python-headless`. Download `vision_encoder.onnx`, `vision_encoder.onnx_data`, `prompt_encoder_mask_decoder.onnx` and `prompt_encoder_mask_decoder.onnx_data` from https://huggingface.co/onnx-community/sam2.1-hiera-tiny-ONNX/tree/814a066640debee5a91e70aa401fb8e17e030503/onnx into a local model directory.

```sh
python scripts/segment-occluders.py --models /absolute/path/to/models
```

The script writes the PNGs under `public/assets/occlusion`, metadata under `src/generated`, and ignored `segmentation-qa/` candidate/contact sheets. Model weights are not part of this repository. Always inspect the candidates before accepting new masks.

`scripts/detail-objects.json` holds the additional object prompts, reviewed candidate overrides, ground Y anchors and small collision ellipses. The segmentation script generates `detail-footprints.json` from these annotations. `--only id1,id2` regenerates selected masks without dropping other entries from the manifest. `scripts/inspect-map.py` and `scripts/review-details.py` produce offline coordinate/prompt/contact sheets. Run `scripts/validate-occluders.py` from the tools venv to verify nonempty alpha, unique IDs, image bounds and texture scaling.

Regenerate the progressive map from an upscale with:

```sh
yarn workspace @bible-strong/world tiles /absolute/path/to/upscale.png
```

This command preserves the logical 1671 × 941 coordinate system, writes the lightweight preview and 2×/4× tiles under `public/assets/map`, and updates `src/generated/map-tiles.json`. The high-resolution source remains outside the repository.

## Benchmark the new occlusion masks

Put `FAL_KEY=…` in the ignored repository-root `.env`, then run the ten-object SAM 3 pilot against the same upscale used for the map:

```sh
yarn workspace @bible-strong/world segment:benchmark --source=/absolute/path/to/upscale.png
```

Use `--only=object-id` to retry one target. The script normalizes the source to the exact 6684 × 3764 tile raster, uploads one crop per object with a one-hour lifetime, sends text + box + positive/negative points to `fal-ai/sam-3/image`, and writes an ignored review report under `segmentation-qa/sam3-benchmark/index.html`. It never modifies production occluders. fal billing must have a positive balance before uploads are accepted.

Run the complete cached review with `--all`, then build source-aligned 2× production candidates with `yarn segment:build`. The builder uses only SAM 3 masks: it fills the outer contour for compact objects, preserves openings in arches and railings, removes detached fragments, and fills internal mask holes. Results are written under ignored `segmentation-qa/sam3-production/`. Production sprites use exact RGB pixels from the normalized upscale; only their alpha comes from SAM 3 and deterministic contour cleanup.

No production-ready or measured mobile performance guarantee is implied by this prototype.
