# Water and perimeter artwork

The playable map, progressive tiles, occluders and navigation coordinates remain 1671 × 941. `WorldBackground` adds a 200-unit decorative margin and a world-anchored repeating water texture. Overview fits the extended artwork. The water sprite covers the current camera viewport, including portrait and wide screens, without allocating an infinite texture.

Production assets:

- `public/assets/map/water.webp`: 512 × 512 lossless repeat with identical opposite edge pixels.
- `public/assets/map/shore.webp`: 2071 × 1341 transparent overlay, placed at (-200, -200). It completes selected silhouettes and blends water across the original perimeter over 48 units. The interior is transparent. It renders above terrain tiles and below foreground occluders.

The reviewed completion windows cover the northern roof, rock and coral tree, western rock, eastern tree, southern coastline and southeastern rock. Generated objects disconnected from the original boundary are discarded. The extensions are decorative and do not add walkable terrain or occluders.

## Rebuild

Generated with the built-in imagegen tool on 2026-09-20. Original generated images remain outside the repository. The first unconstrained outpaint was rejected because it changed landmark placement. The accepted input was the existing preview padded with 200 magenta pixels on all sides; the output was normalized to that canvas before extracting only the perimeter. AI output is approximate and must be reviewed against the source at the joins.

```sh
node scripts/build-world-background.mjs /absolute/path/to/aligned-outpaint.png /absolute/path/to/water-source.png
```

Accepted generated source filenames:

- Outpaint: `exec-d76b176d-331a-402c-a7a8-f3a72934a514.png`
- Water: `exec-76f96f7b-d03b-4cd6-8e5c-04be62aad328.png`

They were saved under `/Users/stephane/.codex/generated_images/01a0bebf-b148-79c0-ab31-213c2ce38163/`. Runtime assets are self-contained in the repository; that directory is only needed to repeat the offline build. Rebuild the background after changing the map source, then visually review the completion windows and water color mask. This command does not regenerate or replace the progressive terrain.

## Final generation prompts

### Perimeter (edit target: magenta-padded preview)

> Precise outpainting edit. Replace ONLY the magenta (#ff00ff) region in this image. The entire non-magenta center rectangle is protected: copy it unchanged at its exact current location and scale. Keep the same canvas dimensions and framing. Continue existing clipped objects naturally into the magenta: blue roof top, red tree top, upper rocks, right tree canopy, bottom purple island rock coastline, bottom-right rock. The rest of the magenta should become matching turquoise water with subtle wave strokes. No new objects. No shifting or scaling any island. No reimagining or redrawing the central artwork. No magenta must remain. Complete clipped objects within 100px beyond the original image, with only water further out. Outer 70 pixels should be quiet nearly uniform water matching #37afd5. Return local image path.

### Water (reference: original preview)

> Generate a single seamless repeatable square 512x512 water texture tile matching ONLY the turquoise water in this reference map. Flat hand drawn cartoon game art, base turquoise approximately #37afd5, very subtle sparse small horizontal pale cyan wave strokes with low contrast, no dark patches or large swirls. Uniform color distribution, no lighting gradient or vignette. Tile must wrap seamlessly horizontally and vertically. Absolutely no land, trees, objects, text, border, foam circles or coastlines. This tile will repeat across an infinite game background behind this exact map. Return local image path.

## Sparse water variants

Four additional 256 × 256 transparent sprites overlay the repeating water: `water-rock.webp`, `water-stones.webp`, `water-rock-reeds.webp` and `water-reeds.webp`, all under `public/assets/map/`. They were generated with the built-in imagegen tool from the original map as a style reference. The reviewed source atlas is `exec-1179ff12-7d7a-4d2d-ba3d-dd7cfa15c9da.png` in the same external generated-image directory above.

```sh
node scripts/build-water-decorations.mjs /absolute/path/to/transparent-2x2-atlas.png
```

The renderer places one candidate per 260-unit cell, keeps 34% of candidates, and varies position and size using a fixed coordinate hash. This gives the same scenery after camera travel, resize and reload. The full sprite remains at least 115 units outside the original map rectangle, clear of its generated completions. Decorations have no navigation footprint. Only nearby cells are instantiated; sprites are reused while visible and destroyed once outside the buffered viewport.

This deliberately varies the objects on top of one seamless water base so there are no rectangular water-color joins between variants. Do not randomize the seed each frame or rotate the sprites: the illustrated perspective must stay consistent.

### Final sprite atlas prompt

> Use case: stylized-concept. Asset type: game decoration sprite sheet with genuine transparent RGBA background. Use the reference only for exact art style, palette and perspective. Create one square 1024x1024 sprite atlas divided into four equal 512x512 cells in a 2x2 grid, no visible grid. Center one isolated small water decoration in each cell with generous transparent padding, no crossing cell boundaries. Top left: one small angular gray rock emerging from water with two delicate pale cyan elliptical ripple strokes around its base. Top right: a low cluster of three small gray stones with similar ripples. Bottom left: a medium gray rock with a few slender green reeds behind it and small ripples. Bottom right: a sparse little tuft of green reeds with two tiny pebbles and small ripples. Match the original map's hand drawn fine dark outlines, flat cel shaded gray rocks, green reeds, isometric three-quarter perspective and upper-left light. All four should have approximately the same visual footprint, occupying only the middle 60% of each cell. No blue water background, no opaque oval underneath, no rectangular tile, no ground, no islands, no text, no shadows outside the small objects. Transparent between the ripple strokes and everywhere outside the objects. These sprites will overlay a separate repeating water texture.
