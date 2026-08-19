# ADR-0015: Use object generation for current offline-copy updates

## Status

Superseded by ADR-0025

## Context

The current mobile distribution replaces Bible, sidecar, and resource-database objects at stable
Firebase Storage/CDN paths. File size and application data identifiers do not reliably identify a
new publication, and a device-local Redux flag can become stale after an in-app replacement.

The ZIP-based distribution has not shipped to production, so no migration from an earlier ZIP
registry is required. Published replacements remain additive and retain their supported artifact
schema.

## Decision

For the current Firebase Storage distribution, use the object's Cloud Storage `generation` as the
publication identity of each independently downloadable resource. Keep the stable object path and
replace its contents when publishing a new edition.

After an artifact has downloaded, passed checksum/format validation, and completed installation,
store its generation, checksum, byte size, source URL, and installation time under its complete
resource identity. The complete identity includes language and sidecar kind where applicable.

TanStack Query fetches current object metadata with `HEAD` and compares it with the installed
generation. An unavailable metadata request does not invalidate or remove an installed offline
copy. Deleting a resource also deletes its locally stored publication metadata.

Use the Storage MD5 response metadata to validate the downloaded bytes. Artifact validation checks
the supported schema and internal integrity rather than hard-coded content revisions, hashes, or
row counts, so additive republications at the same path do not require a mobile release.

## Consequences

Update detection is independent of file size and updates immediately after a successful install.
Overwriting an object automatically creates a new generation without release folders or a separate
mobile catalog. The publisher must preserve the supported artifact schema for additive updates; a
breaking schema change still requires a new mobile contract.

This decision describes the application's current Firebase artifact delivery. A future resource API
or publication pipeline may expose its own revision catalog, but it must preserve the same
per-resource installed-publication contract.
