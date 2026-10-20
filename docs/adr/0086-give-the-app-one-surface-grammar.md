# ADR-0086: Give the app one surface grammar

## Status

Accepted

## Context

The Expo app grew screen by screen without written rules for its surfaces. An audit in
October 2026 found two page grounds chosen by component defaults rather than by intent,
cards marked by a copied blue shadow (63 copies), by a 1px outline or by nothing, 36
distinct radius values, five kinds of row separator and at least eleven section title
styles. In the dark themes the "light grey" page token is lighter than the "white" card
token, so the hierarchy of a card on a page flips. The public site already had a design
system with one ground, one surface and a flat depth, but the app was only cited in it.

## Decision

- Write the app's surface rules as the chapter « The app » of
  `design-system/project/README.md`, beside the site, the videos and the share cards.
- Add semantic palette tokens to every theme: `canvas`, `surface`, `surfaceRaised` and
  `separator`. The surface is lighter than the canvas in every theme. Existing tokens
  such as `lightGrey` and `reverse` keep their values because they serve other purposes.
- Two kinds of page: hubs and settings on `canvas` with grouped cards; continuous lists
  full width on the page ground.
- A card's edge is its contrast: no border and no shadow in the flow. One shared shadow,
  `floatingShadow`, for what floats. Radii from the scale 4, 8, 12, 16, 24 and the pill.
- Shared pieces in `apps/expo/src/common/ui/`: `Card`, `ListSection`, `ListRow`,
  `IconTile`, `surfaces.ts`.
- `scripts/agents-surface-lint.mjs`, run by `yarn agents:styles:check`, refuses a radius
  off the scale and a hand-written shadow. Existing departures are counted per file in
  `scripts/agents-surface-baseline.json` and the counts may only go down.

## Consequences

Screens are migrated family by family (settings, lists, hubs and content), each one
lowering the baseline. Until a screen is migrated it keeps its old look, so the app is
mixed for a while. Dark themes change: cards become lighter than their page, as on the
site. A genuine exception, such as the halo of a Strong reference in the Bible DOM,
states itself in its file with `// surface-allow: <reason>`.
