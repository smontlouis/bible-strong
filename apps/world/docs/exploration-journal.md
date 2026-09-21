# Exploration journal

The Menu button opens a native modal journal. Desktop shows two facing pages; below
760 px the pages stack vertically inside a scrollable book. The mobile resume button
stays visible at the bottom. The modal contains focus, restores it on close, supports
Escape and backdrop dismissal, and respects reduced motion. Opening the avatar editor
keeps the journal underneath so closing the editor returns to the same page.

The journal owns the six place shortcuts, profile editor entry, FR/EN switch, public
site link, discovery progress, and camera controls. The world keeps the menu, movement
joystick, contextual place action, and multiplayer status/retry in the bottom-right corner. Development-only
editor controls remain available outside the journal.

Selecting a place moves the avatar to a safe position on that island and resumes
exploration. `world-travel.ts` checks the current navigation document and refuses a
shortcut if its safe arrival would fall on another island. A shortcut does not mark
the resource as discovered: opening the island's discovery still does that. The scene
consumes each travel request once, resets movement, and centers the camera. Movement
is paused while the journal or avatar editor is open.

## Artwork

`public/assets/journal/{dictionary,lexicon,references,themes,comparison,commentaries}.png`
contains six generated transparent island illustrations based on the existing map.
The built-in image generator created each vignette independently, using
`public/assets/map/preview.webp` as reference. The runtime PNGs are resized to 384 px
with their alpha channel preserved. Prompts and runtime paths are recorded in
`journal-artwork-prompts.json` next to this document. No generated text or UI is baked
into the artwork; all labels, controls, and the book itself remain responsive HTML/CSS.

## Checks

- World unit tests cover safe arrival on all six islands in both default and published
  navigation, and reject an island removed from the navigation document.
- Run `yarn workspace @bible-strong/world test` and `yarn workspace @bible-strong/world build`.
- Check desktop, tablet, 390 px and 320 px widths; French and English; avatar editor
  return, Escape/focus restoration, camera controls, and a live place shortcut.

## Zoom limits

Manual zoom bottoms out at the viewport-dependent overview framing, including the
scenery margin. Buttons, wheel and pinch share this limit; the upper multiplier
remains 2. Zooming manually from overview starts at its displayed scale. A view
already at minimum stays fully fitted when the viewport rotates or resizes.
