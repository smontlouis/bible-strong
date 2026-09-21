# Small wildlife

Ten approved tile edits are animated with MiniMax H3 and segmented offline with SAM 3.
Only transparent animal sprites ship to the browser; the original map tiles, scenery,
navigation and reader animations remain authoritative.

| Scene | Source tile | Movement |
| --- | --- | --- |
| Gull | `4/0-3` | Head turns and preening on the rock |
| Snail | `4/1-2` | Antennae and head movement beside the books |
| Rabbit | `4/3-2` | Breathing, blinking and ear movement |
| Butterflies | `4/2-3` | Two small hovering paths above the blue flowers |
| Robin | `4/11-2` | Head movement on the stone bench |
| Songbirds | `4/10-3` | Two perched birds with head and wing movement |
| Lantern moth | `4/9-4` | Wing movement beside the lantern |
| Bee | `4/5-5` | Hovering beside the wisteria |
| Frog | `4/9-6` | Blinking and throat inflation on the rock |
| Nest | `4/11-0` | Two chicks peeking from a stationary nest |

## Offline pipeline

The approved stills, individual prompts, durable request IDs, provider results, silent
12 fps masters, masks and review strips are retained in the ignored
`art-workbench/experiments/living-world-v1/` directory. `config.json` selects the stills,
prompts and segmentation labels. The original approved image set is also retained in
the repository-root `output/world-living-selection/generated-v1/` directory.

From the World workspace:

```sh
node scripts/generate-living-world.mjs video submit
node scripts/generate-living-world.mjs video collect
node scripts/generate-living-world.mjs mask submit
node scripts/generate-living-world.mjs mask collect
node scripts/build-living-world.mjs
```

Generation requires the existing repository-root `FAL_KEY` environment configuration.
`submit` skips existing requests, and `collect` downloads completed jobs without
resubmitting them. An optional fourth argument selects one scene ID. Collect all videos
before submitting masks. FFmpeg strips audio and samples the silent master at 12 fps.
No inference or video decoding runs in the application.

The first lantern-moth take was rejected because MiniMax introduced a camera pullback.
That take and its requests remain in `living-papillon-lanterne/rejected-camera-drift-v1/`.
The replacement explicitly preserves the close crop.

`scripts/living-world-layout.json` records the reviewed segmentation regions, original
tile identities and scene depths. The builder rejects empty, oversized or escaping
masks; crops each animation to its complete motion bounds; packs lossless WebP atlases
at two pixels per world unit; and derives placement from the original tile overlap.
It preserves transparent frame gutters and closes the final six frames onto the first
pose. Every atlas is at most 2048 pixels per side. Completed scenes are cached; pass
`--rebuild` after changing a mask, video or layout. The combined runtime manifest is
written only when all ten scenes have built successfully.

## Runtime and review

`src/generated/living-world.json` registers the ten scenes through `AmbientTiles`.
They inherit offscreen culling, world/focus pause and reduced-motion hiding. Bench,
pergola and arch depths place the sprites above their supporting scenery cutouts.
The Diagnostic panel has a separate Small wildlife / Petite faune category.

The shared ambient asset tests verify placement inside source tiles, transparent edges,
visible animals in every frame, actual animation, and identical first/last visible pixels.
They also enforce the ten-scene inventory and a combined 32 MiB decoded texture budget.
Review strips show five points in each loop composited over the original tile, including
its final closed frame. `qa.html` in the ignored experiment directory runs the actual World
scene with multiplayer disabled for browser inspection.

Validation on 2026-09-21: all 111 World tests passed, as did typecheck and production
build. Browser inspection in the actual Phaser scene checked all ten placements,
supporting scenery, offscreen suspension and frozen frames during world pause. All
ten textures loaded; the only failed resource in the isolated QA page was its favicon.
The new atlases total 3.61 MiB compressed and 21.38 MiB decoded. Each ships 120 frames
at 12 fps. A silent ten-scene preview is saved at repository-root
`output/world-living-selection/animations-v1/apercu-10-animations.mp4`.
