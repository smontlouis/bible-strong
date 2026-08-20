# ADR-0029: Render resource presentations through recoverable integrity gaps

## Status

Accepted

## Context

A resource presentation can receive every required dataset successfully while finding a local
inconsistency between them. For example, a Strong Bible span may omit its explicit STEP token ID even
though both the translated span and the matching original-language token carry the same Strong
identity. Treating that defect as a chapter-wide integrity failure hides otherwise useful and correct
content from the user.

The quality of generated publications remains the responsibility of developers and publication
tooling. Runtime diagnostics must make those defects visible without turning them into user-facing
outages.

## Decision

Once the logical resources required by a presentation have loaded, recoverable integrity checks do
not fail the complete presentation. The application renders all available data and reports a
development-only warning containing structured, non-sensitive diagnostics.

Reverse interlinear reconciliation first honors explicit STEP token IDs. It then pairs unresolved
target/source occurrences that share the same normalized Strong reference in deterministic chapter
order. A source occurrence is claimed at most once. If no matching source occurrence exists, the
translated span remains visible without an original-language association.

Missing token arrays, invalid token offsets, and text revision/hash mismatches follow the same
best-effort rule when rendering can continue safely. Invalid fragments are omitted; valid fragments
remain visible. These warnings do not authorize changing the requested locale, Bible version,
presentation kind, or logical resource.

A failure to load a required logical resource remains a resource error. Publication validation and
CI may still reject inconsistent artifacts; this decision concerns the user-facing runtime only.

## Consequences

Users keep their requested Bible, Strong, or interlinear presentation when only a subset of
associations is incomplete. Developers receive actionable warnings and remain responsible for
repairing the source publication. Runtime reconstruction is bounded to already-loaded chapter data
and cannot create a network request fan-out.

The displayed result may contain an untranslated or unassociated word while a publication defect is
being repaired. Deterministic pairing makes that degradation stable and testable.
