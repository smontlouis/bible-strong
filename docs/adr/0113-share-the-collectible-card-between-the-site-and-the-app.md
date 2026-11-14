# ADR-0113: Share the collectible card between the site and the application

## Status

Accepted (2026-11-14).

## Context

The public atlas draws the collectible cards of ADR-0090 in CSS (ADR-0092): their palettes,
their five finishes, their two faces and the springs that tilt them under the pointer live in
`apps/site` (`features/atlas/AtlasCards.tsx`, `useCardTilt.ts`, `atlasCardCatalog.ts` and the
first half of `src/atlas-cards.css`).

Since ADR-0090 was amended on 2026-11-14, the application draws the same cards: with React
Native Skia on iOS and Android, and, on the Web and in the desktop app, with the atlas's CSS card,
which the owner chose over CanvasKit's 3 MB of WebAssembly. The application cannot import the
site, and it already kept its own copy of the catalog model (`features/entity-cards/cardCatalog.ts`).

The biblical map set the precedent: a React component for web pages that both the atlas and the
application draw lives in `packages/biblical-map` (ADR-0091).

## Decision

The card moves into a workspace package, `@bible-strong/entity-cards`, which the site and the
application both depend on:

- `@bible-strong/entity-cards` (pure TypeScript): the published catalog and its parsing, the
  families and finishes, the words of a card's two faces in both languages, and the view a face
  draws, built from a published card and the addresses of its pictures. The Skia card of the
  application reads it too.
- `@bible-strong/entity-cards/web`: the two faces as React DOM components, the springs, the
  textures drawn in the browser and the hook that tilts a card under the pointer.
- `@bible-strong/entity-cards/cards.css`: the CSS of a card, wherever it is drawn: its variables,
  mechanics, palettes, faces and finishes. The variables stand on `:root` and every name starts with
  `--ac-` (the rainbow of the holo foil included), so that no page's own variables collide with them.

What only the atlas does stays in the site: the gallery, the deck, the card opened over the gallery,
the packs, the stand, and the addresses of the site's own pictures. The application keeps its Skia
drawing, which ports the same CSS layer for layer, in `apps/expo/src/features/entity-cards`.

## Consequences

- A change to a card's look or to its words is made once for the atlas and the application's Web;
  the Skia card still has to follow it by hand, and is compared with the atlas card by eye.
- The package renders with React but carries no React of its own: it takes `@types/react` as a
  development dependency, and the site dedupes React as for the map. The application's tsconfig
  gains no `paths` entry for it.
- The site's stylesheet of the atlas imports the package's CSS; it is still linked only by the atlas
  pages.
- The CSS variables of the cards are set on the root of any page that loads them.
