# ADR-0035: Rename Lexicon Editor to Resource Studio

- Status: Accepted
- Date: 2026-08-29

## Context

The former Lexicon Editor no longer authored only lexical data. It already acquired, transformed,
validated, and packaged Bibles, Strong datasets, interlinear indexes, dictionaries, topical data,
timelines, cross references, and immutable Resource publication bundles. Commentary acquisition,
translation, normalization, and JSON generation had meanwhile grown under a documentation asset,
even though those scripts and their published data had become a production authoring workflow.

The old name obscured the app's real responsibility and split resource-authoring knowledge between
an application and `docs/`. It also made publication easy to confuse with production activation.

## Decision

Rename `apps/lexicon-editor` and `@bible-strong/lexicon-editor` to `apps/resource-studio` and
`@bible-strong/resource-studio`.

Resource Studio owns acquisition, source pinning, editorial transformation, translation,
normalization, validation, preview tooling, Offline-copy generation, and Resource publication bundle
generation for every Resource family. The complete commentary workflow moves under
`apps/resource-studio/workflows/commentaries`, including its tracked catalog, published
translations, scripts, tests, and local reader.

Resource Studio does not import a bundle into production PostgreSQL, upload an Offline copy to R2,
activate a Resource revision, or serve runtime clients. Those responsibilities remain in the
Resource service. The seam between the two modules remains the immutable Resource publication
bundle defined by ADR-0023.

Root authoring commands use `resources:<domain>:<action>`, while Resource-service commands retain
the publication, import, activation, and delivery verbs they own.

## Consequences

All resource fabrication has one discoverable home, and `docs/` returns to documentation, audits,
and decisions. Commentary tooling can evolve beside the other producers without coupling its
internal JSON layout to the Resource service. The rename changes workspace and command names and
therefore requires a regenerated root lockfile. Existing outputs keep their content and provenance;
the move changes ownership and paths, not Resource identities or revisions.

The schema-v1 provenance value `generator: bible-lexicon-maker` remains a stable compatibility
identifier for already immutable bundles. Renaming that machine value requires an explicit bundle
schema evolution; it is not coupled to the workspace rename.
