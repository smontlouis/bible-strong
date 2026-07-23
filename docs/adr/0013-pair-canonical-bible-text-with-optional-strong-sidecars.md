# ADR-0013: Pair Canonical Bible Text With Optional Strong Sidecars

## Status

Accepted

## Context

LSG, DBY and DBR must be readable as normal Bibles without requiring a Strong download. Their
Strong datasets contain indexed word ranges and concordance data whose offsets are meaningful only
for one exact text revision. The historical LSGS version duplicated readable text and exposed a
storage distinction as a separate Bible in the product.

Bible updates can also invalidate persisted word-annotation offsets. User annotations must not be
deleted merely because an automatic migration cannot locate an unambiguous replacement.

## Decision

Publish each Strong-capable Bible as two independently downloadable resources under one logical
Bible version:

1. a canonical JSON artifact containing the visible verse text and all presentation events;
2. an optional, text-free SQLite sidecar containing Strong word spans, identities, lexemes, notes
   and concordance indexes.

Import canonical JSON into the shared Bible text database. Keep each Strong sidecar as its own
SQLite file and apply it as an overlay at read time. Require exact `textRevision` and `textSha256`
agreement before using a sidecar. Installation verifies archive and content checksums and activates
replacements atomically.

Treat DBR as the application version backed by the DBYR generation dataset. Retain LSGS only as a
legacy persisted identifier that resolves to LSG with Strong visible; do not expose it as a
downloadable or selectable Bible.

Resolve Strong navigation from the compatible sidecar of the currently open Bible, falling back to
the installed default Strong Bible. Keep the existing global Strong database for shared lexical
definitions.

Before activating a new canonical text revision, journal an idempotent word-annotation migration.
Move an annotation only when its remembered text can be aligned deterministically. Leave ambiguous
or missing annotations unchanged and visible.

## Consequences

Users can install and update readable text without Strong data, while Strong mode and concordances
remain version-specific. The sidecar avoids duplicated text and can be queried efficiently, but
publication must always ship compatible text/sidecar metadata and the app must handle missing,
incompatible and corrupt sidecars explicitly.

Canonical text presentation is now a publication contract rather than something reconstructed from
Strong markup on the phone. Any text or layout change creates a new text revision and can trigger an
annotation realignment attempt. Failed automatic realignment is deliberately non-destructive, so a
small number of annotations may remain visually offset after a text update.
