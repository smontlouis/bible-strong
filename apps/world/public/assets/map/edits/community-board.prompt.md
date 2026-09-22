# Community board

Generated with the built-in imagegen tool (precise-object-edit), using a 4× source
crop at logical `(880, 325, 125, 105)` from the original map. The reviewed patch
replaces the east bench. The original full-resolution map stays outside Git.

The tile generator composites `community-board.webp` at `(880, 325)` after the
central-table repair. Its alpha feathers only the integration perimeter. The
matching `occlusion/community-board.webp` retains the board silhouette at the same
origin and scale, with ground depth 407. The navigation footprint follows its feet.

## Generation prompt

Use case: precise-object-edit
Asset type: source-aligned illustrated game map patch.
Input image: edit target, a crop of the World map.
Primary request: Replace the wooden bench with a freestanding wooden community noticeboard covered with about nine pastel yellow, pink, cream and blue sticky notes, some bearing tiny decorative scribbles, no readable words. The board has a warm wood frame and two short legs standing exactly on the bench's former grassy footprint. Its front is clearly visible, in the same three-quarter elevated camera perspective, facing toward the bottom-left plaza, with its top edge slanting down to the right like the former bench. Board roughly fills the former bench width, with its top rising into the space occupied by the blue plant behind it. Remove the entire bench including legs and old shadow and replace its shadow appropriately.
Style: match the exact flat hand-drawn cartoon illustration, crisp dark outlines, warm wood, simple soft shading.
Constraints: preserve canvas dimensions, camera, scale, and ALL surrounding scenery pixel-aligned: tree on left, signpost on right, paving and round table fragment in bottom-left, water and vegetation outside the board silhouette. No extra objects, no characters, no lettering, no border. Output the same crop composition without zooming or reframing.
