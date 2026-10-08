# ADR-0079: Learn published Bible revisions from the catalog and the files, never from the application

## Status

Accepted. Refines [ADR-0013](./0013-pair-canonical-bible-text-with-optional-strong-sidecars.md),
[ADR-0014](./0014-pair-original-language-text-with-localized-interlinear-indexes.md) and
[ADR-0025](./0025-use-catalog-sha-for-r2-offline-copy-updates.md), and narrows the best-effort rule of
[ADR-0029](./0029-render-resource-presentations-through-recoverable-integrity-gaps.md) for word
offsets. It removes the application release that ADR-0078 (on its own branch at the time of
writing) names as a condition for republishing `BHG`.

## Context

Every ordinary Bible is republished on the server alone: the application loads the Artifact catalog
from `/v1/offline-catalog`, falls back to the bundled copy, and compares archive hashes.

`BHG` and its two interlinear indexes were the exception. The application compiled in the text
revision, the SHA-256 and size of three archives, schema versions and row counts
(`BHG_INTERLINEAR_PUBLICATION_CATALOG`). An installed index was usable only when its text revision
equalled that constant, and the `BHG` Offline copy — a flat JSON without a revision of its own —
was recorded under the compiled revision, whichever archive had just been downloaded. Publishing a
rebuilt `BHG` would have broken the interlinear of every installed application, and recorded the old
revision over the new text: an installed index would then have been laid on words it was not built
for.

The same binding existed for the Strong Bibles. `REVERSE_INTERLINEAR_STEP_CONTRACT` made every
Strong index incompatible unless it declared one exact `BHG` revision and two exact runtime hashes,
and `STRONG_BIBLE_REVERSE_INTERLINEAR_CANDIDATES` listed archive hashes and text revisions per
Bible. Both were live. The per-Bible table had already drifted from production (twelve Bibles were
republished on 2026-10-08): its hashes no longer gated installation, because the reader takes the
text and Strong revision of an index from the index itself, but the legacy migration still compared
an installed `LSG` or `KJV` with it and could no longer complete.

Reading had a second gap. The text of a chapter and its tokens are loaded separately, each from an
Offline copy or online. Tokens read online for the published text were laid on an installed text of
another revision; a mismatch only raised a development warning.

Application 27.1.1 is in the App Store with the compiled constants and will not be updated.

## Decision

### The catalog names the text of an archive that cannot name it itself

A Catalog entry may carry `textRevision` and `textSha256`:

- on a Bible that has interlinear indexes, the text its archive carries;
- on an interlinear index, the text it was built for.

They repeat what the publication bundles already declare — the revision of the `bible-text` bundle
and the `dependencies.bible` of each index — and what the index SQLite carries in
`ResourceMetadata`. Self-describing canonical Bibles and Strong indexes declare nothing in the
catalog. The fields are optional and `schemaVersion` stays 1: 27.1.1 validates the fields it knows
and ignores the others, which a test proves against its frozen validator.

A catalog never pairs an index with another text than the one it publishes. The catalog builder,
`catalog-patch` and the publication gate of the Resource service all refuse a text published
without the indexes rebuilt for it, an index without its text, or a declaration that differs from
its bundle.

### The application compiles in identities and reader contracts only

`@bible-strong/resource-catalog` keeps what `BHG` is (version, dataset, attribution, licence) and
resolves everything else from a catalog. The application resolves it from the catalog it holds: the
live one, else the bundled one. A live catalog served before the declarations existed is completed
from the bundled catalog for the same archive hash, never for another archive.

The schema versions that remain in the code are the oldest ones a reader understands
([ADR-0034](./0034-treat-offline-resource-schemas-as-additive.md)), not publication pins.

### An index is matched against the installed text by its own metadata

An installed interlinear index is usable when its schema is supported and its own `textRevision`
and `textSha256` are those of the installed `BHG`. A sound index built for another text is
`incompatible`, is never read, and is offered as an update.

The installed text says which text it is: from the file when it is a canonical Bible, otherwise from
the Catalog entry of the downloaded archive, otherwise from the file hash — a revision no index can
match. A record written by 27.1.1 over a newer archive is corrected from the Catalog entry of that
archive when the application holds it; a copy installed from a canonical file is never corrected.

### Text and index move together, and tokens are never laid on another text

Downloading an index first brings the `BHG` the catalog publishes when the installed one is another
archive; downloading `BHG` brings every installed index along. The download queue applies this to
whatever asked for the download.

Between the two downloads, and whenever tokens come from another source than the text, the reader
compares revisions. Tokens are laid on the text the reader holds only when both name the same
revision; otherwise the same chapter is read online with them; when neither matches, the
interlinear presentation fails with its usual actionable state. This applies to `BHG` interlinear
modes, to the original words of reverse interlinear and to the `BHG` lexicon. It replaces, for word
offsets, the warning-only rule of ADR-0029: a wrong offset cuts words in the wrong place and cannot
be recognised by the reader.

### Strong indexes are not pinned to a `BHG` revision

A Strong index must support the reverse-interlinear schema and say which `BHG` revision its token
ids were taken from; the application no longer requires one particular revision or runtime hash.
Published token ids keep their word across revisions (ADR-0078), and the reconciliation of
ADR-0029 already tolerates a token id absent from the index in use. The per-Bible table of hashes is
removed: archives come from the catalog, text and Strong revisions from the files. The legacy
migration accepts a replacement Bible that names its text, whatever revision is published.

## Consequences

Republishing `BHG` and its indexes, or a Strong index rebuilt against a new `BHG`, is a server
operation: build the bundles, patch the catalog, publish. No application release, test or constant
changes.

Offline reading keeps working with an installed pair that is older than the catalog. Updating one
side brings the other; while only one has arrived, interlinear reading needs a connection.

The text declarations are a second place where a revision is written. The publication gate keeps
them equal to the bundles, and a file that declares its own revision always wins over the catalog.

`BHG` can be delivered as a canonical Bible instead of a flat JSON. 27.1.1 then records the true
revision, declares its installed index incompatible and reads the interlinear online, instead of
laying the old index on the new text. The archive entry must stay `bible-step.json`, the name
27.1.1 compiled in. An application that already holds the old text and reads tokens online still
lays new tokens on old text until that text is updated: only an update of that application can
close this, and it must carry this decision as a whole — new constants alone would make its
installed pair incompatible while leaving the old text in place.

If `BHG` is nevertheless republished as a flat JSON, a 27.1.1 that installs it records the old
revision over the new text. The application corrects that record from the Catalog entry of the
installed archive, which only the live catalog lists: a first launch without a connection after
upgrading from such a 27.1.1 still trusts the wrong record until the catalog is loaded once.
Delivering `BHG` as a canonical Bible removes the case.

A token id space shared by `BHG` and the Strong indexes is still not named by either file. If a
future `BHG` renumbers published tokens, both must declare a lineage and readers must compare it;
until then the stability rule of ADR-0078 is the only guard.
