# Ambient animation

`src/world-ambience.ts` draws small Phaser graphics directly in original world coordinates: five water ripples, two warm lamp glows with dust, falling petals and leaves, a dragonfly and an occasional reflection on the dictionary sign.

Only four integration points in `game.ts`: import, field, constructor and update. The module has no external assets, audio, timers, network calls, navigation edits or character dependencies. Scene-owned Graphics are automatically destroyed with the scene. One clamped local clock freezes with the application's pause / focus state. Offscreen groups skip drawing; reduced-motion preference hides all these optional decorations.

Effects use different periods and phases, with rests between events. Water ripples sit below foreground cutouts; the simple dragonfly and drifting petals sit above scenery. Lamp coordinates align with the illustrated lamp centers.

Validation: world build/typecheck; lifecycle tests exercise pause/resume, dynamic reduced motion, offscreen culling and finite geometry across a minute of animation. Browser overview checked with the existing character sprites and water background.

## Art-direction correction

The user rejected procedural animals as inconsistent with the illustration style. Fish, duck, butterflies and bird have been removed from the runtime. Complex creatures must use generated house-style stills, user image approval, then MiniMax animation and reviewed transparent sprites. Three duck still proposals are prepared in art-workbench/experiments/ambient-duck-v1; no replacement animal is integrated until reviewed.

User direction, 2026-09-20: from now on produce **one image proposal per asset**, choosing the art direction directly, rather than three. This supersedes the earlier multi-proposal workflow for future image creation. Keep image review before MiniMax animation unless the user explicitly delegates approval.

Latest user direction: image and behavior approval is now delegated to the agent before MiniMax generation. Review each result autonomously, keeping one proposal per asset and sequential delivery: fish tile verified in the world first, then a duck tile. Videos remain silent with a fixed camera. Preserve the existing tile edges and scenery, character assets, reduced-motion support and offscreen limits.

The first fish experiment uses the actual `tiles/4/9-3.webp` image between References and Commentaries, at world bounds (1151.5, 383.5, 129, 129). Source, prompt, placement and video request are retained in `art-workbench/experiments/ambient-fish-tile-v1/`. Other candidate tiles are `4/4-3` west of the central island and `4/8-0` northeast of the lexicon.

Procedural drift groups now have differing 28–40 second cycles, fewer coral petals and tighter culling bounds. Reduced motion also hides effects when enabled during a world pause. Build and 30 tests passed after these changes.

## Integrated tile scenes

The fish scene was generated, integrated and inspected in Phaser before creating the duck. The user explicitly accepted moving water strokes, so both scenes retain a small animated water interior as well as the animal. Existing tile borders, rocks and foliage remain supplied by the original map. Soft fixed alpha masks blend the interior patches into that map; the original tile files are unchanged.

- Fish: actual source tile `4/9-3`, two submerged blue shadows, continuous ten-second loop at 12 fps. Runtime patch bounds are (1176.5, 431, 75, 52.5).
- Duck: actual source tile `4/8-0`, one small cream and teal duck paddling gently, continuous ten-second loop at 12 fps. Runtime patch bounds are retained in `src/generated/duck-tile.json`, including the first row's asymmetric tile overlap.

The built-in image generator produced one still per scene using the actual tile and `online-library.webp` as the supporting `bible-strong-univers-v1` style reference. Exact prompts, stills, MiniMax H3 requests/results, silent masters, 12 fps frames and review images remain in the ignored `art-workbench/experiments/ambient-{fish,duck}-tile-v1/` directories. MiniMax added audio despite the prompt; the final masters were explicitly remuxed with `-an`, and ffprobe confirms only video streams. No video or audio ships to the browser.

`scripts/build-ambient-tile.mjs fish` and `scripts/build-ambient-tile.mjs duck` pack the reviewed frames into lossless WebP atlases. A final six-frame blend closes each loop to the initial pose. Two-pixel transparent gutters isolate atlas cells. Combined download size is approximately 1.6 MiB; decoded texture storage is approximately 13.4 MiB. Atlas dimensions are below 2048 pixels per side. Full-resolution experiment sources stay out of the public directory.

`AmbientTiles` preserves world coordinates, pauses playback offscreen, on world pause or focus loss, and hides optional animated patches for reduced motion, exposing the original static water. Scene-owned sprites are destroyed with the scene. Existing sector characters and navigation geometry are unchanged.

Validation: build/typecheck and 33 tests pass. Tests inspect all 240 atlas frames for transparent borders, source tile bounds, texture budgets and identical visible first/last pixels; lifecycle checks cover pause, offscreen and reduced-motion behavior. Both scenes were inspected at close range against surrounding map artwork with the actual Phaser renderer, followed by the complete world with its sector characters. No browser errors were reported; the local world indicator remained at 100 fps on the tested machine. This is a local observation, not a mobile-device performance guarantee.

## Cat, western fish and denser particles

The user requested these additions with parallel agents, then corrected the cat to lie along the green bench rather than sit. `cat-tile` uses the actual `2/2-1` source tile, a corrected still and silent MiniMax grooming loop. Only the segmented cat is shipped; the bench is unchanged. Its depth of 405.1 places it just above the bench cutout at 405. The experiment and rebuild script are `art-workbench/experiments/ambient-cat-tile-v1/` and `scripts/build-cat-tile.mjs`.

`fish-west-tile` adds three small submerged fish beside the western shore of the central island, using the actual `4/4-3` tile. Its fixed feathered water patch stays clear of the shore and bridge. Source, generation requests, silent master and pixel validation are in `art-workbench/experiments/ambient-fish-west-tile-v1/`; rebuild with `scripts/build-fish-west-tile.mjs`. Every ambient sprite plays continuously with no inter-loop delay; offscreen, pause and reduced-motion rules remain in effect.

The commentary lantern at (1268, 580) now has a brighter cream core, amber glass light and a restrained 16-unit halo. Three slow frequencies vary the glow without sharp flashes. The source drawing remains visible underneath.

Falling particles now use small circles of stable varied radii rather than animated ellipses. The coral tree has 11 potential particles, violet arches 8+7, green pergola 8+6, and blue theme arches 6+6; the central yellow drift remains at two. Each particle has its own phase and rest period, so only a subset is visible at once. New blue origins align with the illustrated arches at (231, 466) and (386, 478). These effects add no network assets.

The shared atlas tests derive bounds from each source tile and inspect all registered streams. Lifecycle tests now use independent sprites and assert zero repeat delay. Close Phaser views with the real occluders checked the cat's contact with the bench, the western fish patch, lantern alignment and round violet/green particles.

Final validation after these additions: build/typecheck and all 36 tests pass. Cat atlas is approximately 458 KiB; western fish atlas approximately 824 KiB. The complete world finishes loading without console errors and reports 100 fps on the local test machine. Both silent masters contain only a video stream.

At the user's subsequent request, eight simple Phaser butterflies are restored near flower beds (two on Themes, two on Comparison, two on References, one by Commentaries and one near the central bench). Four small rounded wings, a fine body and staggered drifting paths keep them distinct from the circular falling particles. This explicit request supersedes the earlier exclusion of procedural butterflies; complex animals still use generated sprites. Existing offscreen, pause and reduced-motion handling applies. No additional asset downloads are needed. Five ambience tests and typecheck pass after the addition.

The Diagnostic toggle now overlays labeled colored bounds for falling particles, butterflies, dragonflies, water ripples, glows and animated fish/duck/cat patches. Bounds come directly from the effect definitions and sprite manifests, remain visible during quiet phases, and labels support French, English and Simplified Chinese. Text keeps a constant screen size when zooming; hidden diagnostics skip drawing and offscreen labels are culled. Build and five ambience tests pass; overlay was checked in the complete world.

Diagnostic now includes independent category toggles for navigation, scenery cutouts, particles, butterflies, dragonflies, glows, water, fish, duck and cat, plus All/None shortcuts. Filters affect diagnostic outlines and labels only; the animations continue normally. Selections survive toggling Diagnostic off/on within the session. UI labels support all three languages. Browser QA verified None followed by Particles displays only particle bounds; build passes. React Doctor reported only two pre-existing offline-script loop warnings.

The procedural water ripple effect was subsequently removed at the user's request, along with its Diagnostic category. Animated fish/duck water patches and the static repeating background remain unchanged.

Butterflies now bank toward their horizontal path velocity, capped at ±30 degrees. A 280 ms exponential response softens turns and returns them upright as lateral movement slows. The complete four-wing silhouette and body rotate together; paused/offscreen clocks retain existing behavior.

## Central book

The original central book now plays the approved ten-second MiniMax page-turn sequence at 12 fps,
then rests for a newly sampled 2–5 seconds before each replay. `src/central-book.ts` advances both
the frames and the rest on one scene-local clock: offscreen, world pause, and focus loss freeze
both; reduced motion reveals the original static map. Its depth is 489.1, directly above the
central table cutout, so normal avatar occlusion is preserved.

The offline source, crop coordinates, MiniMax request, silent master and SAM 3 segmentation are
kept in `art-workbench/experiments/central-book-v1/`. Rebuild with
`node scripts/build-central-book.mjs` from the World workspace. The book mask includes the first
frame's footprint to avoid exposing the static book through moving pages. Three transparent WebP
atlases (about 1.7 MiB total, each below 2048 pixels per side) ship to the browser. The final hold
uses the first texture for a stable restart. No video, audio or inference runs in the browser.

Tests cover fresh delay sampling, frozen frame/rest clocks, reduced-motion fallback, transparent
asset bounds, visible cream pages and matching resting poses.
