# ADR-0017: Own Strong Routes Under the Strong Segment

## Status

Accepted

## Context

Strong detail pages were nested under the Explore route group and reached through a shared
`StrongScreen` adapter. The detail screen also maintained a second navigation stack and encoded a
special fallback from directly opened subpages to the parent Strong entry.

Strong entries, Biblical entities, dictionary notices, related words, and concordance results are
directly addressable study surfaces. They should not depend on Explore ownership or on a synthetic
parent route.

## Decision

Own the Strong route hierarchy under `app/strong/`, with `/strong` as the entry page and
`/strong/entity`, `/strong/dictionary`, `/strong/related`, and `/strong/concordance` as sibling
pages in the nested Strong stack.

Route files read their own parameters and render the relevant Strong detail page without the
legacy `StrongScreen` adapter. Expo Router owns standalone page history and back behavior. The
app-switcher Strong tab only owns the transition between the lexicon list and the selected Strong
entry. Once an entry is selected, it renders the same main screen and uses the same Expo Router
routes for every secondary page; it does not maintain a parallel Strong navigation stack.

## Consequences

Strong routes no longer inherit ownership from Explore. Direct subpage links use normal router
history instead of redirecting to a fabricated parent Strong page. Route parameters remain the
complete handoff between sibling pages. The Strong tab retains only its lexicon selection state,
so route and tab presentations cannot diverge in their secondary navigation behavior.
