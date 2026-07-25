# ADR-0014: Pair Original-Language Text With Localized Interlinear Indexes

## Status

Accepted

## Context

The historical `INT` and `INT_EN` resources expose two language-specific interlinear Bibles even
though both are presentations of the same TAHOT/TAGNT source text. Requiring either large
interlinear database also prevents users from installing the Hebrew, Aramaic and Greek text as a
normal readable Bible.

Interlinear token offsets and lexical data are valid only for one exact source-text revision.
Glosses are localized, while token boundaries, morphology, transliteration and lexical identities
belong to the shared source publication.

## Decision

Expose one selectable original-language Bible named `BHG — Bible hébraïque et grecque`. Its
canonical JSON archive contains only the readable TAHOT/TAGNT verse text and is imported into the
shared Bible database like any other Bible.

Publish optional French and English SQLite sidecars as localized interlinear indexes. Each sidecar
contains token and segment offsets, localized glosses, transliteration, morphology and Strong
identity variants, but no duplicate verse text. Interlinear mode overlays the selected localized
index on the canonical BHG text only when its schema, dataset identity, text revision and text hash
match. Downloads verify archive and content hashes and activate sidecars atomically.

Downloading an index also downloads BHG when its canonical text is absent or incompatible.
Removing BHG explicitly removes both localized indexes; removing one index never removes BHG or
the other locale. A failed or missing index leaves BHG fully readable in simple mode.

Hide `INT` and `INT_EN` from new catalogs while retaining their identifiers and existing loaders so
persisted tabs and already downloaded legacy resources remain usable. Do not migrate a persisted
legacy tab automatically to BHG because BHG may not yet be installed.

Advanced BHG rendering preserves the canonical source text through published UTF-16 offsets,
including text between indexed tokens. It disables entry into word-annotation mode because its DOM
structure is not a one-to-one text rendering; simple BHG mode keeps the normal annotation contract.
Psalm superscriptions published as verse zero remain addressable but render without a visible zero.

BHG keeps one persisted display preference with four states: original text, detailed interlinear,
original text with Strong identities, or continuous Latin transliteration. The legacy `visible`
state remains readable and maps to detailed interlinear mode. Strong and transliteration are
language-neutral and may use either compatible installed index.

Gloss language is a separate persisted preference. Automatic follows the application language and
may fall back to the other installed localized index. An explicit French or English choice never
silently substitutes the other language: if its index is missing, the selector offers that index
for download. A completed interlinear-index download invalidates currently displayed Bible data so
the requested mode or newly available gloss language appears without navigating away.

## Consequences

Users can download one compact original-language Bible and opt into only the interlinear language
they need. French and English indexes remain independently replaceable, and their text compatibility
is explicit rather than inferred from filenames.

The app must maintain a second sidecar lifecycle alongside Strong sidecars and retain legacy
interlinear loaders during the migration period. Any canonical source-text change requires new
text-revision metadata and regenerated localized indexes.
