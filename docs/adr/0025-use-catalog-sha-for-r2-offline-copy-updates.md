# ADR-0025: Use catalog SHA-256 for R2 offline-copy updates

## Status

Accepted

## Context

ADR-0015 coupled resource installation to Firebase/Google Cloud Storage response metadata,
particularly object generations and `x-goog-hash`. Offline resources are now published to private
Cloudflare R2 and delivered through the Resource API Worker. Those provider-specific headers are not
part of the R2 delivery contract and caused otherwise valid downloads to fail.

The exhaustive mobile resource catalog already declares the immutable archive SHA-256, byte size,
entries, and stable Worker URL for every downloadable resource.

## Decision

Use the catalog `archiveSha256` as the installed artifact revision and integrity authority. The
mobile app downloads each resource only from the Resource API `/v1/offline-artifacts/` route, then
hashes the downloaded archive and rejects it unless it matches the catalog SHA-256. Standard HTTP
metadata such as `Content-Length` and `ETag` may be recorded for diagnostics, but never determines
resource identity or integrity.

Remove Firebase Storage fallback, Cloud Storage generation reconciliation, GCS checksum parsing, and
per-artifact metadata requests from the current application. A persisted installation without a
catalog SHA-256 is update-available and is replaced through the normal atomic installation flow.

The remote catalog is served at `/v1/offline-catalog`; an invalid or unavailable remote catalog falls
back to the bundled catalog, not to another storage provider.

## Consequences

Resource delivery is provider-neutral at the client boundary and private R2 is the only production
artifact store used by the current application. Publication must update R2 and the exhaustive
catalog consistently. The Worker remains responsible for App Check verification and range delivery,
while the client remains responsible for archive checksum and content validation.

Previously released applications and non-resource media are outside this decision.
