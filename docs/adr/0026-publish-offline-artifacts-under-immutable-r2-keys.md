# ADR-0026: Publish Offline-copy artifacts under immutable R2 keys

## Status

Accepted

## Context

The mobile catalog keeps a stable logical `file` for each resource, but replacing that same R2
object in place creates a publication race. A client holding the previous catalog expects the old
SHA-256 while the stable object already contains the new bytes. A failed Neon activation or Worker
deployment can make that mismatch permanent, and older bundled catalogs cannot recover.

## Decision

Keep the catalog `file` as the stable logical resource path, but publish every new archive under the
private content-addressed R2 key `revisions/<archiveSha256>/<file>`. Generated artifact URLs retain
the stable Worker pathname and add `?sha256=<archiveSha256>`. For a stable path present in the
deployed catalog, the Worker accepts a strictly validated SHA-256 selector and reads the
corresponding retained immutable R2 key. R2 object existence decides whether that historical
revision is still supported.

The Worker continues to serve a request without `sha256` from the original stable R2 key. This is a
compatibility path for application versions released before immutable publication; the publication
workflow never overwrites those legacy objects.

The production workflow uploads and verifies immutable objects before Neon activation and catalog
deployment. A failed later step leaves the previous catalog and its bytes intact. Content-addressed
objects also form the initial private recovery history; retention cleanup may remove revisions only
after the supported catalog/application window no longer references them.

## Consequences

Publishing a revision is additive in R2, so cached and bundled older catalogs remain valid. The
deployed catalog becomes the atomic pointer selecting the current Offline copy. R2 storage grows
with revisions and therefore needs a separate, conservative retention job that keeps at least the
latest three recovery revisions and every revision referenced by a supported catalog/application.
The query parameter is an integrity selector, not authorization; Firebase App Check remains
mandatory before R2 access.
