# Resource access modules isolate local and future remote adapters

## Status

Accepted

## Context

Bible Strong currently reads Bible and study resources mostly through local SQLite/JSON helpers.
That implementation supports offline use well, but it makes online-first resource loading hard:
screens and feature helpers can end up knowing whether a resource is installed, which file should
exist, which SQLite table to query, and which error means "download required".

The online-first resources PRD requires each resource to support local data and future remote data
without spreading source-selection logic through the app.

## Decision

Create resource access modules under the resources feature. A resource access module exposes a
domain interface for a resource capability, and its implementation owns source selection, local
storage details, cache behavior, structured errors, and future remote adapters.

Resource consumers use one TanStack Query integration per domain operation. The query function
calls the resource access module, which prefers a valid installed local adapter and otherwise uses
the remote adapter. TanStack Query owns in-memory query caching and request lifecycle; it does not
replace the source-selection policy or collapse SQLite and HTTP into one storage implementation.

Configure hybrid resource queries with `networkMode: 'always'` so they execute and can reach SQLite
while offline. Purely remote queries may use `networkMode: 'online'`. Connect React Native network
state to TanStack's online manager and choose retries from structured error categories rather than
retrying domain absence, unsupported content, or known local corruption.

An installed offline copy remains preferred even when the catalog advertises a newer revision.
The user continues reading the installed revision until explicitly updating it; the app does not
silently alternate between local and remote revisions according to connectivity.

If an installed local adapter fails with a recoverable storage error such as corruption or
incomplete content, the resource access module automatically attempts the remote adapter when that
delivery capability is available. Domain absence, local corruption, missing installation, offline
state, unsupported resources, and remote failures remain distinct structured errors so fallback
does not hide the meaning of a genuine `not found` result.

Downloaded SQLite/JSON resources are durable offline copies rather than query-cache entries.
Persistent partial query caching may be added later, but is not required for the first remote
resource implementation.

Editorial resources are published with revision identifiers shared by remote reads and downloadable
offline copies. Corrections and content updates replace the current published revision after the
replacement has been staged and validated; older revisions are not retained in the live resource
database.

Legacy helpers may remain as compatibility adapters while callers migrate. New resource-source
behavior belongs behind the resource access module, not in screen code.

Each resource operation exposes one storage-independent domain contract. SQLite adapters and HTTP
adapters translate their storage or transport representations into that same request/result model;
SQLite row shapes and HTTP payload details do not become consumer-facing types.

The Bible reader uses one chapter-loading facade. It delegates regular Bible, Strong Bible, and
interlinear requests to specialized internal providers, while Strong lexical lookup, search, and
concordance stay in the separate Strong resource domain.
The facade returns a discriminated chapter contract with separate plain, Strong, and interlinear
variants so common loading behavior does not erase format-specific domain data.

## Consequences

Callers get a smaller interface for resource reads and availability checks. Tests can exercise
resource behavior at the same seam that callers use.

Canonical domain contracts allow local schemas, remote schemas, and transport formats to evolve
without forcing corresponding screen changes. They also require explicit mapping and contract tests
for both adapters instead of reusing legacy database row types as public application types.

Ordinary reading and study surfaces do not display technical source provenance. A resource selector
may indicate whether an offline copy is installed, but selecting a resource still opens its normal
viewer. The viewer owns the TanStack Query request and renders either the resolved content or an
actionable unavailable state, such as downloading the resource, from the structured domain error.
Selectors do not need to pre-resolve network availability or duplicate source-selection behavior.
Resource catalogs remain stable: temporarily unavailable resources stay visible and selectable
instead of disappearing according to current network or installation state.

Online and offline search expose equivalent query meaning, filters, pagination, and result
contracts. PostgreSQL and SQLite FTS5 are not required to produce identical relevance scores or
strictly identical result ordering.

Screens and hooks have one query key for the domain result rather than separate local and remote
query keys. Installing, removing, or updating an offline copy must invalidate affected queries so
the source-selection policy is evaluated again.

Shared revisions make online/offline consistency checks, update availability, cache invalidation,
and observability explicit. A publication pipeline must produce or register both remote content and
downloadable artifacts for the revision.

The first modules are intentionally local-only adapters, but their seams are chosen where a future
remote adapter will be real: resource availability and Bible content access. Additional resource
domains should migrate behind similar modules before adding remote behavior.
