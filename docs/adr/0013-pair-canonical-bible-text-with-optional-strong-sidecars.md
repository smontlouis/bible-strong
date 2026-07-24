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

In the verse-resource modal, resolve Strong navigation from the compatible sidecar of the currently
open Bible, then from the first installed sidecar in the LSG, DBY, DBR priority order. Expose the
resolved Bible source and let the user override it for the current Bible tab. A missing manual
choice returns to automatic resolution. Other Strong navigation first uses the configured default
Strong Bible, then the remaining installed sidecars in that same priority order. Keep the existing
global Strong database for shared lexical definitions; its French or English language setting
changes definitions, not the Bible source used for Strong word placement.

Removing a canonical Bible explicitly also removes its version-specific Strong sidecar. Replacing
or re-downloading the Bible required by the active application language preserves that sidecar so
it can be reused after the compatible canonical text has been installed again. The required Bible
is LSG in French and KJV in English; the other language's Bible remains removable. Switching the
application language must ensure the target language's required Bible is downloaded. Removing a
sidecar never removes its Bible or the shared global Strong database.

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

## Validation

The tab-scoped source choice was explicitly approved as part of issue 199. Automated validation
covered resolver priority, manual override fallback, and Firestore tab-group serialization. An iOS
simulator smoke test opened BCC1923 without an LSG sidecar, confirmed automatic DBY resolution,
selected DBY manually, returned to automatic mode, verified unavailable LSG and DBR entries were
disabled, and confirmed the separate lexical-language menu remained available.

A follow-up iOS smoke test confirmed that the source pill shrinks for a manual three-letter source,
expands only as far as `Auto · DBY`, avoids duplicate provenance below the header, and keeps the
displayed verse and lexical cards visible while navigating to the next verse.
