# ADR-0033: Extract the Resource domain and catalog

- Status: Accepted
- Date: 2026-08-25

## Context

After the monorepo migration, the Resource service depended on the entire mobile workspace to use
wire schemas, cursors, identities, catalog data and several neutral data types. That inverted the
desired dependency direction and allowed server code to reach Expo and mobile storage modules.

The generated mobile resource catalog also lived inside the mobile application even though the
Resource service and editorial tooling produce, publish and serve the same artifact.

## Decision

Create two platform-neutral packages:

- `@bible-strong/resource-domain` owns resource wire schemas, DTOs, cursors, identities and pure
  invariants shared by clients and producers.
- `@bible-strong/resource-catalog` owns the generated artifact catalog, immutable publication
  catalogs and pure catalog lookups.

The mobile app and Resource service may depend on both packages. Neither package may depend on a
consumer. Expo, SQLite, Firebase, HTTP, PostgreSQL, filesystem, download and installation
implementations remain in their owning app or service.

Mobile legacy module paths temporarily re-export the Resource-domain contracts so existing feature
imports can migrate incrementally without creating duplicate implementations.

The canonical generated catalog moves to
`packages/resource-catalog/src/mobile-resource-catalog.json`. Editorial and publication workflows
must update that file atomically.

## Consequences

- `@bible-strong/resource-service` no longer depends on `@bible-strong/mobile`.
- Server tests use the shared interface or test the server directly; mobile adapter behavior remains
  covered by mobile tests.
- Shared contracts cannot import platform or infrastructure modules.
- Catalog changes are visible to every consumer through one workspace artifact.
- Compatibility re-exports may be removed after mobile imports have migrated to package exports.
