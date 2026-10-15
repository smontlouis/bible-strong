# Plaza ground for the portal

Generated with codex-imagegen (`edit`, 1536 × 960, high quality) from a 4× crop at logical
`(840, 455, 200, 125)` of the normalized map with `central-table-half.webp` and
`community-board.webp` already applied, so the repaired plaza stays repaired.

The tile generator composites `plaza-portal-ground.webp` at `(840, 455)` after both. Its alpha
covers only the former south-east tree and shrubs, feathered over about 2.5 logical units. Their
cutouts (`plaza-south-east-tree`, `plaza-south-east-shrubs`) and footprints were removed; the
portal to Valence 1876 stands there (`src/world-portal.ts`).

## Generation prompt

Use case: precise-object-edit
Asset type: source-aligned illustrated game map patch.
Input image: edit target, a crop of the World map.
Primary request: Remove completely the round teal tree on the right and the whole cluster of green and teal shrubs and grass tufts below and left of it, on the lower right of the circular plaza. Reconstruct in their place the pale cream sandstone paving of the plaza, continuing the faint concentric circular joints and sparse irregular stone joints exactly as in the rest of the plaza, and continue the grey stone curb at the plaza edge and the strip of grass along the water in the same style as the left part of the crop. Remove their shadows too.
Style: match the exact flat hand-drawn cartoon illustration, crisp dark outlines, simple soft shading.
Constraints: preserve canvas dimensions, camera, scale, and ALL other scenery pixel-aligned: the round table with the open book at top left, the wooden pier and its posts at the bottom left, the water, the signpost and the wooden rail on the right edge. No new objects, no characters, no lettering, no border. Output the same crop composition without zooming or reframing.
