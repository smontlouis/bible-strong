# ADR-0023: Exchange resource publications as versioned bundles

## Status

Accepted

## Context

Resource Studio and the Resource service have different responsibilities. Reading the studio's working tree or treating a global mobile release as one
indivisible database would couple publication to repository layout and prevent independent
resource revisions.

## Decision

Resource Studio emits one independently importable Resource publication bundle for each Resource
identity and immutable, content-derived Resource revision. A bundle contains both a canonical import representation and the
matching Offline-copy artifact, plus its manifest, provenance, distribution rights, format version,
counts, and checksums. The global Resource catalog is derived from active independent publications;
it is not their transport envelope.

Resource Studio owns and versions the bundle schema. The Resource service importer declares the
schema versions it supports and validates every boundary before writing. Reimporting an existing
identity and revision is an idempotent no-op only when all relevant checksums match; reusing a
revision for different content is a blocking publication error.

Activation requires complete Publication parity between the canonical database content and the
matching Offline-copy artifact. Their physical representations may differ, but visible content,
durable identities, coverage, editorial presentation data, counts, and Resource revision must agree.

Local transfer uses an explicit bundle path supplied to the importer rather than implicit access to
the neighboring repository's internal files. The same bundle can later be transported as a verified
CI artifact without changing its contract.

## Consequences

The maker can evolve its internal generators and the service can evolve its storage independently.
Canonical Online data and Offline copies remain provably associated with one revision, while local
development and CI use the same handoff. Schema evolution requires explicit compatibility support
instead of silently changing files in place.
