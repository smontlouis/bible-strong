# ADR-0021: Package all offline resources as ZIP archives

## Status

Accepted

## Context

Offline delivery used two publication contracts. Recent Strong, interlinear, and lexicon artifacts
were ZIP archives with explicit entry metadata, while historical Bible JSON, resource SQLite, and
timeline JSON files were downloaded without compression. The application duplicated their URLs and
estimated sizes, and no one manifest proved that a release covered every downloadable resource.

The historical direct files include Bible text, optional pericope and red-word JSON, resource
SQLite databases, and timeline JSON. Shipping the three legacy Bible files independently would
require separate downloads and separate publication identities for data that must evolve together.

## Decision

Every independently downloadable offline resource is published as a ZIP. A legacy Bible ZIP contains
its canonical text plus its pericope and red-word JSON when those files exist. Rich canonical Bible
publications, resource SQLite databases, timeline JSON, Strong Bible sidecars, interlinear indexes,
and modular Strong lexicon databases retain their existing entries. Installed files keep their
existing JSON or SQLite names and schemas; ZIP is a delivery envelope, not a schema migration.

`bible-lexicon-maker/config/mobile-resource-inventory.json` is the complete publication inventory.
Its mobile resource release command packages historical direct sources deterministically, validates
already-zipped sources, and emits one global `mobile-resource-catalog.json` with every identity, stable artifact URL,
archive entries and roles, SHA-256 checksums, byte sizes, installation strategy, and peak-space
estimate. The build fails on an omitted/duplicate identity contract, a non-ZIP target, a missing
canonical entry, duplicate roles, or an unexpected archive entry.

The exact same catalog is served by the Resource API at `/v1/offline-catalog` and bundled in the app
as its offline fallback. The app derives download URLs under the App Check-protected
`/v1/offline-artifacts/` route, plus archive entries and size metadata, from it; a network or
validation failure keeps the bundled copy active. There is no separate size manifest and no Firebase
Storage resource fallback. The installer persists each installed archive SHA-256, and update checks
compare it locally with the active catalog instead of issuing one metadata request per ZIP.
Installations created before catalog SHA tracking are marked update-available. All Bible bundle
entries are extracted and validated from one download. The text is imported
into `bibles.sqlite`, while legacy pericope and red-word files keep their historical on-device paths.
They no longer have independent download or publication identities. SQLite and timeline resources
are extracted before their existing schema/integrity validation and atomic file swap. Publication
update detection uses the parent Bible archive SHA-256 as defined by ADR-0025.

Activation is ordered: upload and verify every catalog artifact at its stable object path first,
then replace the global catalog, and only then release an app build that consumes that catalog.
Candidate generation does not publish or activate production objects.

## Consequences

All offline downloads share one installation envelope and one exhaustive 72-resource publication
manifest. Historical resources use less bandwidth without changing local schemas. A legacy Bible
and its display metadata now have one resource identity and one revision. A resource update is
incomplete until the full catalog has been rebuilt and its generated app catalog has been
synchronized.

Installation temporarily needs space for both the archive and extracted content; the catalog exposes
that peak estimate. Publishing a ZIP with the wrong internal filename is rejected before activation.
This new mobile delivery contract does not address historical app releases. The current application
contains no legacy resource URL or Cloud Storage fallback.
