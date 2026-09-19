# ADR-0053: Add canonical public Bible and Strong routes

- Status: Accepted
- Date: 2026-09-19

## Context

The Expo application opens Bible passages through `/bible-view` with serialized query parameters
and Strong entries through `/strong` with their identity in query parameters. These routes preserve
application state, but they do not give public Bible passages and Strong entries stable,
human-readable paths.

Strong display and reverse-interlinear display are optional presentations of one canonical Bible
version. They must not reintroduce the removed `LSGS`, `KJVS`, `INT`, or `INT_EN` version
identities.

## Decision

Add normalized public routes for the first Bible and lexical-reading slice:

- `/bible/:version/:book/:chapter`
- `/bible/:version/:book/:chapter/:passage`
- `/bible/:version/strong/:book/:chapter[/:passage]`
- `/bible/:version/reverse-interlinear/:book/:chapter[/:passage]`
- `/strong/:code`
- `/strong/:code/dictionary`
- `/strong/:code/related`
- `/strong/:code/concordance`
- `/strong/entity/:uniqueName`

Bible version codes and Strong codes are lowercase in generated paths and resolve to their existing
domain identities. Bible books use the lowercase form of the OSIS identity already shared by the
reference parser and Resource Studio. Localized names, historical abbreviations, and provider short
names are accepted only as input aliases and normalize to the OSIS path. A passage is one verse or
one same-chapter inclusive range.

Treat `text`, `strong`, and `reverse-interlinear` as Bible presentations. The route adapter maps
them to the existing Bible-tab state and renders the existing reader. A reverse-interlinear route
may select a French or English gloss index through the `gloss` query parameter.

Keep `/bible-view` and `/strong` as compatibility adapters. Existing application links can migrate
incrementally; no persisted tab migration is required. Static rendering, server rendering,
metadata, redirects, and search-engine indexing policy remain separate decisions.

Normalize legacy Bible and Strong navigation intents at the shared navigation seam before they are
dispatched. Internal callers using the historical screen-name interface therefore emit canonical
browser URLs without requiring a simultaneous rewrite of every feature. Keep the legacy destination
only when the intent contains application-only state that the public route cannot represent, such
as opening one specific private annotation or a non-contiguous verse selection.

On a public Bible route, treat the URL as the source of truth for book, chapter, version, and Strong
presentation. Explicit book and chapter changes push a history entry. Version and presentation
changes replace the current history entry. Route navigation is dispatched from user actions through
an adapter; it is not inferred by observing tab state in an effect. Browser back and forward
navigation therefore re-enters the same route parser as direct navigation.

## Consequences

Direct Web URLs and in-app navigation can use the same Bible and Strong screens without duplicating
their implementations. Unsupported version/presentation combinations fail as invalid routes, while
a supported but unavailable sidecar continues through the existing resource-acquisition flow.

Strong entry subpages carry the Strong code in their path. Biblical entities remain autonomous and
use the editorial `uniqueName` required by ADR-0016.
