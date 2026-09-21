# Editable avatar artwork

The four avatars (Bean, Slime, Cubee, Cloud) use native vector body paths in Pencil, with separate eye layers. The game still loads transparent PNG sprite sheets exported from those editable poses.

The working document is `cubo-face.pen` in the local `Downloads/blob-rond-magnific/cubo-editable` folder. Access this document through Pencil MCP, never by parsing the encrypted file directly.

## Contours

- `avatar-stroke`: 4.5 px, black, inner aligned, rounded joins.
- `avatar-stroke-bean-side`: 3.6 px. Bean's side sprites render at 65 rather than 52 world units, so this compensates for the larger display scale. Keep this value at 0.8 × the main contour width.
- Body geometry uses an explicit viewBox to preserve frame registration. Eyes stay separate from body paths.

## Export

Export the individual sprite frames through Pencil MCP as PNG at scale 1. Each export must be transparent and exactly 256 × 256. Do not export the surrounding board, labels or alignment guides.

`scripts/build-pen-avatar.mjs <export-directory> <shape>` reads `avatar-export.json` from the export directory. Its `directions` object contains ordered `down`, `right`, `up` filename arrays. An optional `idles` object supplies separate resting frames; otherwise frame 1 is the idle. `source` optionally describes provenance.

- `blob`: 24 frames per direction, 8 × 3 sheet, separate idle poses.
- `short-slime`, `rounded-square`, `cloud`: 15 frames per direction, 5 × 3 sheet.
- Left mirrors right in the game.

The latest local exports and manifests are under `cubo-editable/vector-export/<shape>/`. `vector-export/vector-frames.json` additionally backs up the editable frame nodes, including full path geometry and eye placement, read through MCP.

Preserve animation order, eye placement, idle poses, origins and timing when changing the contour. Cloud keeps its floating animation.
