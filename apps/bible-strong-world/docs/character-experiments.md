# Character animation experiments

This is an offline art workbench, separate from the Phaser application. Large sources, intermediate images and generated videos live under `art-workbench/`, which is excluded from Git and is outside Vite's public directory. Keep a separate backup of this local folder; cloning the repository does not restore it.

## Required image review before future animation

User direction, 2026-09-20: show the still image and get the user's approval **before submitting any subsequent character animation**. The first experiment is explicitly allowed to finish with its current image, but that image is not an approved character-style reference.

Updated user review workflow: always present **three still-image proposals**. After selecting and approving the image, agree on the character's behavior before video generation. Deliver videos with **no audio track**. For the lexicon reader, retain the supplied wavy-haired, round-glasses head design and reduce the character's overall size to fit the pedestal and architecture naturally. Apply the house style to that head design rather than replacing it with the gallery character's hairstyle.

Follow [bible-strong-illustrations](../../../.agents/skills/bible-strong-illustrations/SKILL.md) and [bible-strong-univers-v1](../../../docs/design/illustrations.md), attaching the relevant gallery illustration as a style reference. For the lexicon, use `apps/site/public/images/landing/lexicon-universe.webp`. The first still has overly systematic outer outlines and too much separation between pale skin and dark clothing; future characters need the house style's unified monochromatic fills and fine detail lines. Keep the supplied map crop as the composition target, not as the sole character-style reference.

## Source image

`art-workbench/sources/magnific_upscale_gOG9ALKSXO.png` is an unchanged copy of the supplied Downloads image, 6672 × 3760 pixels. Its SHA-256 is `2f3c472159aba26b2e897b745246f4051499a04d18d71ef3c5a8e39db9526ef3`. The Downloads original is retained.

## Lexicon reader — first experiment

Working directory: `art-workbench/experiments/lexicon-reader-v1/`.

1. `01-source-crop.png` — direct full-resolution crop, with its source-pixel and logical-world coordinates in `crop.json`. Logical region: x=780, y=85, width=230, height=200. The crop keeps the papyrus, pedestal and surrounding architecture.
2. `02-reader.png` — built-in imagegen edit adding the blue scholar from the supplied populated-map reference. The complete prompt is in `image-prompt.txt`.
3. `03-reader-loop.mp4` — MiniMax H3 experiment, requested as five seconds at native 768P, using `02-reader.png` for both first and last frames. The prompt requests a stationary camera and background, subtle reading, blinking and a hand gesture before returning to the starting pose. A seamless loop is an experiment objective, not guaranteed by the endpoint.

`generate-video.mjs` uses the existing `@fal-ai/client` dependency and repository-root `FAL_KEY`. `--submit` sends one request and records its ID in `request.json`; it refuses a second submission when that record exists. `--status` checks the existing request and `--result` saves the returned metadata and video. Prompts, settings and results stay alongside the experiment. No secrets are written to those files.

```sh
node art-workbench/experiments/lexicon-reader-v1/generate-video.mjs --status
node art-workbench/experiments/lexicon-reader-v1/generate-video.mjs --result
```

Endpoint: https://fal.ai/models/minimax/h3/image-to-video/api

This experiment does not extract sprites, remove backgrounds, clean up motion or change the web application's assets or behavior.

## Approved reader B — integrated sprite

The approved v3 image is `art-workbench/experiments/lexicon-reader-v3/proposal-B.png`. Its approved silent animation, `05-reader-B-silent.mp4`, lasts eight seconds: follow the papyrus with a finger, lift the head and adjust the glasses, then return to reading.

The world plays this character as a transparent Phaser sprite. Offline SAM 3 video segmentation isolates only the person; the original map and papyrus remain in place. The segmentation request, response and mask video are retained in the experiment's `sprite/` directory. The browser does not call fal or load video.

Rebuild from the existing 12 fps input and aligned mask, from this workspace:

```sh
node scripts/build-reader-atlas.mjs \
  art-workbench/experiments/lexicon-reader-v3/sprite/input-12fps.mp4 \
  art-workbench/experiments/lexicon-reader-v3/sprite/mask.mp4
```

The script preserves one fixed crop for all 96 frames (257 × 249 pixels), packs two transparent WebP atlases below 2048 pixels per side, and writes Phaser frame metadata and `src/generated/lexicon-reader.json`. Atlas images total about 904 KiB. They retain roughly four source pixels per world unit, while the character occupies about 66 × 65 world units, consistent with the approved proportions.

`src/lexicon-reader.ts` plays the sequence at 12 fps, above the desk cutout so fingers can overlap the paper. Playback pauses while offscreen or while the world is paused; reduced motion shows the first frame. The sprite adds no collision region.

## Dictionary C — integrated sprite

Approved source: `art-workbench/experiments/dictionary-reader-v1/05-reader-C-silent.mp4`. The world uses its first ten seconds at 12 fps. SAM 3 masks include the person, magnifier and open book so the page turn is retained. The 120 aligned frames are packed into four transparent WebP atlases, with a fixed 362 × 303 frame crop; all atlas dimensions remain below 2048. `src/generated/dictionary-reader.json` retains the original crop mapping and desk depth.

The reader runtime is shared in `src/animated-reader.ts`; the lexicon and dictionary keep separate manifests and textures. Future atlas builds can pass a fourth argument: a JSON config with id, experiment, frames, x, y, width, height and depth. The default remains the approved lexicon build. Dictionary config and mask provenance live in its experiment's sprite folder.

For the Themes island at the lower left, three still-image proposals live in `art-workbench/experiments/themes-reader-v1/`, pending the user's choice. No animation or integration for Themes yet.

## Complete set — Themes, Commentaries, References and Comparison

All six study places now have animated inhabitants. `src/world-readers.ts` registers seven sprite streams: lexicon, dictionary, themes, commentaries, references, comparison-left and comparison-right. Comparison uses two cutouts from the same video, at each desk's own depth; both timelines continue together while offscreen to preserve their exchange. Other readers pause offscreen. Reduced motion freezes the first pose; world pause and lost focus pause every stream.

The user approved the corrected white-page Themes video and selected proposal A for each of Commentaries, References and Comparison. Each of those three experiments retains proposals A/B/C, exact prompts, the gallery reference, `selected.png`, video request/result metadata and a silent master under `art-workbench/experiments/<sector>-reader-v1/`. The initial comparison request using B was superseded by the user's selection of A; its request record is preserved but its output is not shipped.

- Themes: `07-reader-B-pages-v2-silent.mp4`; page turn and heart/mountain/flame garland. The SAM video-RLE result is decoded into masks and small enclosed paper/rim omissions are repaired using the source colors, preserving blue table gaps. `sprite/refine-mask.mjs` retains this processing step.
- Commentaries: `05-reader-silent.mp4`; reading, writing, pointing and acknowledgment. Only the readers, held book and pen are extracted, leaving the original tabletop book in place.
- References: `05-reader-silent.mp4`; reading a card, picking up another and bringing them together. The final mask is the union of the person pass and the book/cards pass. Original mask outputs remain alongside it.
- Comparison: `05-reader-silent.mp4`; searching, a page turn and a shared discovery. Separate left/right atlas configs clip the mask along the central empty walkway and preserve world coordinates.

New runtime atlases use two pixels per world unit; full-resolution inputs and masks remain in the ignored workbench. `build-reader-atlas.mjs` accepts optional `pixelRatio`, `clipX` (normalized horizontal bounds) and `synchronize` fields in addition to crop/depth settings. It deletes only obsolete generated atlas pages when repacking. All pages are at most 2048 pixels per side. The complete reader bundle is approximately 10.9 MiB compressed and 180.5 MiB of decoded RGBA textures, excluding the map; mobile memory optimization remains possible if needed.

Validation: atlas tests verify all 816 frames, transparent gutters, nonempty alpha, page bounds, durations and separate synchronized comparison depths. The workspace build and 29 tests passed; the populated world was checked in Phaser. No audio streams are shipped and no inference runs in the browser.
