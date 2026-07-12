# ADR-0010: Generate offline artifacts from canonical PostgreSQL data

## Status

Accepted

## Context

Bible Strong currently downloads Bible JSON files and complete resource SQLite databases whose URLs
and formats are declared in the mobile application. There is no shared publication pipeline or
working resource-update model, and the existing SQLite schemas contain storage-specific and
historical conventions. Copying those schemas directly into Neon would make the new remote system
depend on the mobile storage representation.

## Decision

Use canonical domain models in Neon PostgreSQL as the source of published editorial data. The
publication pipeline derives the domain HTTP representations, search indexes, and downloadable
SQLite/JSON offline artifacts from the same canonical resource revision. Existing resource files
are import sources during migration, not the long-term canonical model.

Use domain-specific relational tables, constraints, and indexes for Bible, Strong, dictionary, Nave,
commentaries, cross references, timeline, and other resource payloads. Share only common identity,
revision, rights, and delivery metadata through the resource catalog; do not place heterogeneous
resource content into one generic JSONB payload table.

The initial online migration preserves the mobile application's existing offline distribution
formats. Regular Bible publications continue to produce JSON compatible with insertion into the
shared `bibles.sqlite`, while other resources continue to produce their existing SQLite or JSON
artifacts. Changing local schemas or artifact formats is a separate, later optimization justified by
measurements rather than a prerequisite for online access.

Installed offline copies retain the resource revision, checksum, artifact schema version,
installation timestamp, and useful resource-specific counts. The exact local table, registry, or
adjacent manifest is deferred, but installation identity must no longer be inferred only from file
existence.

Install and update offline copies atomically. Download to temporary storage, verify integrity and
format or SQLite health, install/import the replacement and its metadata, and remove the superseded
copy only after success. A failed update leaves the previous working copy available.

Canonical resource metadata includes provenance, rights holder, terms reference, attribution,
review date, and permitted online/offline delivery modes. Publication rejects a requested delivery
mode that conflicts with these declarations. This automated guard does not substitute for legal
review of the underlying distribution rights.

For regular Bible content, preserve the proven relational shape of the local `bibles.sqlite`
database: one row per verse, addressed by Bible version/revision, book, chapter, and verse number.
Neon adds canonical resource and publication metadata around that simple content table rather than
storing each chapter as an opaque JSON document. Chapter HTTP responses are assembled from ordered
verse rows and can then be cached by Cloudflare.

Use PostgreSQL full-text search with indexed `tsvector` data as the initial remote Bible search
engine. Online and offline search share filters, pagination, and result contracts without requiring
identical ranking. Do not add a separate hosted search engine unless observed relevance, latency, or
load demonstrates that PostgreSQL is insufficient.

Each independently distributable resource identity has its own current revision. A resource catalog
declares that revision for each Bible version, resource language, or other distribution unit;
publishing one resource does not require republishing the entire catalog. Neon retains only the
current published revision. Exceptional compatibility dependencies between resources must be
declared explicitly.

The initial publication workflow is a repository-versioned CLI/CI pipeline rather than an
administration UI. It imports and validates source content, writes a replacement dataset to staging,
generates and uploads the matching offline artifact to R2 with integrity metadata, verifies remote
and offline parity, and only then atomically replaces the published dataset and updates the resource
catalog. The previous live revision is removed after successful activation.

Publication validation blocks duplicate verse identities, invalid ranges, unexpected empty content,
source/import count mismatches, invalid Unicode, version/language inconsistency, contract failures,
unhealthy generated artifacts, canonical/artifact parity failures, and checksum mismatch. Legitimate
canon or versification exceptions must be declared in resource metadata rather than silently
dropped or classified as generic corruption.

While all application environments share one production resource backend, local tooling may import,
generate, and validate publications but cannot activate them. Production publication credentials
belong only to a manually triggered, protected CI environment, which performs the final validation
and catalog activation.

## Consequences

Remote and offline representations can evolve independently while retaining content parity through
their shared revision. Each resource domain needs explicit import, validation, transformation, and
artifact-generation steps. The initial migration is more work than mirroring SQLite tables, and
generated offline artifacts must remain compatible with installed app versions until a deliberate
mobile schema migration is shipped.
Independent revisions reduce publication scope, but require a catalog manifest and explicit
resource identities instead of one global application-data version. Publication remains
reproducible and reviewable. Reverting requires republishing an archived source or artifact as a new
current revision rather than reactivating data retained in Neon.

Live Neon and live R2 retain only the current revision. Keep a separate private, bounded recovery
archive of publication inputs/artifacts (initially the latest three) that is not addressable by the
mobile application. Recovery republishes archived material as a new current revision.
The pipeline needs staging records, idempotent steps, integrity checks, and credentials scoped for
publishing; an administration UI can be added later if a real editorial workflow requires it.
This protects the initially shared production backend at the cost of requiring an explicit CI step
for every live publication.
