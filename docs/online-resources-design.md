# Online resources design

## Status

This is the architectural synthesis of the `grill-with-docs` design session for GitHub issue #245,
**Online-first resources with optional offline access**. The session was documentation-only and no
online-resource implementation has started. The consolidated PRD was published to issue #245 on
2026-07-12 and is retained locally in `docs/online-resources-prd.md`.

## Scope and boundaries

- The project covers editorial resources: Bible versions, Strong, interlinear, dictionary, Nave,
  cross references, commentaries, timeline, sidecars, and search.
- User-owned data remains in the existing Redux/local persistence/Firestore system. Authentication
  and user-data synchronization are outside this resource project.
- The product is usable online without a mandatory first download, while complete offline copies
  remain an explicit user choice.
- Remote editorial reads do not require an authenticated user account.

## Current codebase readiness

- The codebase is mature enough to begin an incremental online-resource migration, but not to enable
  every resource remotely by configuration alone.
- `src/features/resources/` already provides a registry and local interfaces for Bible content,
  Bible search, Bible reading extras, Strong, dictionary, and Nave. Many consuming screens already
  use these seams.
- The current implementations are local-only wrappers around SQLite/JSON helpers. There is no
  local/remote orchestrator, remote adapter, uniform error model, publication catalog integration,
  or persistent partial cache.
- Some availability, coverage, lifecycle, timeline, interlinear, and sidecar paths still depend
  directly on local helpers and require gradual migration.
- The application uses the internal `react-query-lite`, not `@tanstack/react-query`.
- The existing seams are therefore a useful starting point for one complete domain path; they are
  not yet a finished online/offline module system.

## Incremental migration order

The migration is domain-by-domain rather than a coordinated big-bang replacement. Domains that have
not migrated continue using their current local behavior.

1. Shared contracts, query integration, source orchestration, errors, catalog, and backend base.
2. Regular Bible chapter and verse reading.
3. Bible search.
4. Strong Bible content, Strong lexical resources, and interlinear content.
5. Dictionary and Nave.
6. Cross references, commentaries, red words, and pericopes.
7. Timeline.

This sequence is a design trajectory rather than an implementation start or fixed delivery
schedule.

### First future implementation slice

The first implementation milestone is one complete LSG chapter-loading path. It imports and
publishes the current LSG resource to canonical Neon data and a compatible offline artifact, exposes
the versioned REST chapter endpoint behind App Check and Cloudflare cache, replaces
`react-query-lite` with TanStack Query on this path, prefers an installed SQLite LSG copy, falls back
to HTTP when local content is absent or recoverably broken, and renders the structured unavailable
state when neither source works.

This first slice excludes Bible search, Strong, interlinear, dictionary, Nave, commentaries,
cross-references, timeline, and persistent partial caching. It is a future implementation milestone,
not work started during this design session.

## Mobile resource architecture

- Resource consumers use one TanStack Query integration for a domain operation regardless of data
  source.
- TanStack Query owns request lifecycle, deduplication, and an initially memory-only query cache.
  Persistent partial query caching is deferred.
- Hybrid queries that may succeed through SQLite use `networkMode: 'always'` so TanStack does not
  pause them when the device is offline. Purely remote queries may use `networkMode: 'online'`.
  React Native network state feeds TanStack's `onlineManager`, while retry policy depends on the
  structured error category.
- A resource access module owns source selection and delegates to separate local SQLite/JSON and
  remote HTTP adapters.
- A valid installed offline copy is preferred. If a newer revision exists, the installed copy
  remains in use until the user explicitly updates it; the app does not switch revisions according
  to connectivity.
- Recoverable local corruption or incomplete content may fall back automatically to remote access.
  Domain absence, missing installation, offline state, unsupported content, local corruption, and
  remote service failure remain distinct structured errors.
- Local and remote adapters translate into the same storage-independent domain contract. SQLite row
  types and HTTP payload types do not escape their adapters.
- Shared machine-readable contracts provide runtime validation, TypeScript types, and OpenAPI
  documentation. The concrete schema library is not yet selected.
- The project currently uses `react-query-lite`; adopting actual TanStack Query is future
  implementation work.
- `BibleViewer` depends on one chapter-loading facade. That facade internally routes regular Bible,
  Strong Bible, and interlinear chapter requests to specialized providers. Strong lexical lookup,
  search, and concordance remain a separate `StrongAccess` domain rather than part of generic
  chapter loading.
- The shared chapter contract is a discriminated union with typed `plain`, `strong`, and
  `interlinear` variants. Request/envelope behavior is common, while each variant retains its own
  verse payload instead of forcing all formats into one structure full of optional fields.

## User-facing availability

- Normal readers and study surfaces do not display SQLite, HTTP, or query-cache provenance.
- A selector may show that an offline copy is installed, but it still opens the normal viewer and
  does not pre-resolve network availability.
- The viewer performs the query and renders either content or an actionable unavailable/download
  state.
- Resources remain visible and selectable even when they may not currently load.

## Backend and delivery

- Neon provides managed PostgreSQL for canonical editorial data and dynamic search.
- The initial Neon project is located in AWS Europe Frankfurt (`eu-central-1`), close to the primary
  European audience. Cloudflare remains the global delivery layer.
- The initial canonical database is single-region with no cross-region replica. Local offline
  copies, Cloudflare content cache, Neon backups, monitoring, and the bounded publication archive
  provide the initial resilience. Additional replication requires measured availability need.
- Cloudflare Workers provides the versioned REST/JSON domain API, cache handling, rate limiting, and
  abuse controls.
- Workers initially query Neon directly over HTTP with `@neondatabase/serverless`, which suits
  one-shot edge queries. Hyperdrive is deferred until measured global latency or connection pressure
  justifies an additional pooling/query-cache layer.
- Cloudflare R2 stores downloadable SQLite/JSON offline artifacts.
- R2 artifact buckets remain private. After App Check verification, the Worker grants temporary
  direct access to one artifact with a short-lived presigned URL; the mobile app verifies the
  catalog checksum after download. Presigned URLs are bearer credentials and may be renewed for a
  resumed download, but they do not expose permanent R2 credentials.
- The mobile application never connects directly to PostgreSQL and no generic remote SQL interface
  is exposed.
- Deterministic reads such as chapters and lexical entries are eligible for Cloudflare caching;
  search may reach Neon.
- REST routes are versioned under a boundary such as `/v1`.
- An API version remains backward-compatible for its lifetime: additive optional fields are
  allowed, while removing, renaming, or reinterpreting existing fields requires a new route version.
  Old and new versions overlap until observed mobile-client usage supports retirement.
- Deterministic content reads such as chapters and resource entries use long-lived shared Cloudflare
  caching and are purged when their resource is published. Dynamic search is not CDN-cached
  initially; TanStack Query still provides its in-memory client cache.
- API, shared contracts, and publication tooling begin in this repository. The existing Expo layout
  stays in place initially; formal Yarn workspaces/monorepo boundaries can be introduced later.
- PostgreSQL schema migrations are repository-versioned and use an expand/migrate/contract sequence
  so active API versions remain compatible. Schema migration is a separate CI operation from
  editorial-resource publication.
- Initial remote-adapter support is declared in application code. Firebase Remote Config is not used
  for resource rollout; configuration can be externalized later only if a concrete operational need
  appears. The server catalog remains authoritative about whether a resource is actually available
  online.
- The server catalog is deliberately minimal: current revision, online availability, offline
  artifact URL, and integrity metadata. Stable product labels, language/copyright presentation, and
  initial adapter support remain application code.
- Loading the server catalog is non-blocking. Failure to refresh it may temporarily prevent update
  checks or download metadata, but it does not block installed local reads or require every remote
  viewer request to wait for the catalog.

## Application attestation

- A static token embedded in React Native is not considered a secret because it can be extracted
  and replayed.
- Firebase App Check is the target protection for the custom Cloudflare API: App Attest with
  DeviceCheck fallback on Apple platforms and Play Integrity on Android.
- The Worker verifies App Check before protected cache or origin access.
- Verified official clients share deterministic cached responses; the App Check token is not part
  of the content cache key.
- Rate limits still apply, with stricter controls for dynamic search than deterministic cached
  reads. Exact thresholds remain open.

## Canonical content and publication

- Neon PostgreSQL is the canonical source of published editorial data. Existing JSON and SQLite
  files are migration inputs, not the permanent canonical model.
- PostgreSQL uses domain-specific relational tables and indexes for Bible, Strong, dictionary, Nave,
  commentaries, cross references, timeline, and other resources. A shared resource catalog owns only
  common publication/distribution metadata; resource payloads are not stored in one generic JSONB
  table.
- Regular Bible content retains the proven relational shape: one verse row identified by Bible
  version, book, chapter, and verse. The API assembles ordered chapter responses.
- Bible-version metadata declares `canonId`, `versificationId`, and published coverage. The initial
  architecture preserves the app's existing numeric book/chapter/verse identity and does not build
  automatic mapping between versifications.
- Each independently distributable resource identity has its own current revision and delivery
  capabilities (`onlineAccess` and `offlineDownload`).
- Canonical metadata records provenance, rights holder, terms reference, attribution, rights-review
  date, and permitted online/offline delivery modes. The pipeline rejects a delivery mode that does
  not agree with these declarations; this control does not replace legal review.
- Only the current published revision remains in live Neon. A replacement may coexist temporarily
  in staging, then atomically replaces the previous dataset, which is removed.
- Live Neon and live R2 expose only the current revision. A separate private recovery archive may
  retain a small bounded number of previous publication inputs/artifacts (initial assumption: three)
  and is never visible to the mobile application.
- Remote content and the downloadable offline artifact share the same revision identifier.
- The first online migration preserves existing offline formats: regular Bible JSON remains
  compatible with insertion into shared `bibles.sqlite`, and other resources retain their current
  SQLite/JSON distribution formats. Local format optimization is deferred.
- Every installed offline copy records its resource revision, checksum, artifact schema version,
  installation time, and useful resource-specific counts. The exact local registry or manifest
  representation remains open.
- Offline installation and update are atomic: download to temporary storage, verify checksum and
  format/database health, install or import the replacement, persist metadata, and only then remove
  the superseded copy. Failure preserves the previous working installation.
- Reverting means republishing an archived source or artifact as a new current revision, not
  reactivating historical Neon rows.
- Publication starts as repository-versioned CLI/CI, not an administration UI. It imports,
  validates, stages, generates the offline artifact, uploads it to R2 with integrity metadata,
  verifies parity, and activates the replacement atomically.
- Publication validation is blocking: unique verse identities, valid ranges, expected non-empty
  content, source/import counts, Unicode validity, version/language consistency, API contract
  validation, generated-artifact health, full canonical/artifact parity, and final checksum.
  Legitimate canon or versification exceptions are declared as metadata rather than silently
  discarded or treated as generic corruption.
- Local tools may validate and generate, but only protected manually triggered CI holds production
  publication credentials and activates the shared production catalog.

## Search

- PostgreSQL full-text search with indexed `tsvector` data is the initial remote search engine. No
  external search service is added without measured need.
- Online PostgreSQL search and offline SQLite FTS5 share query meaning, filters, pagination, and
  result contracts.
- Identical relevance scores and strict result ordering are not required across the two engines.

## Capacity and environments

- The provisional design budget is 100,000 monthly active users, approximately 10 million resource
  reads, and 2 million search actions per month. This is a capacity assumption, not a product
  forecast.
- Costs and scaling must ultimately use measured request volume, cache-hit rate, search load,
  latency, and Neon compute.
- Development, staging, and production are the target logical environments.
- Initially they may all point to one shared Neon/Cloudflare production backend, matching the
  current Firebase reality. Configuration should remain environment-aware so physical separation
  can be added later.

## Observability and privacy

- Mobile metrics distinguish local and remote resolution, time to content, structured error
  category, and download conversion.
- Cloudflare metrics cover request volume by route, cache hit/miss, latency, HTTP failures, App Check
  rejection, and rate limiting.
- Neon metrics cover search/query volume, query latency, slow queries, connections, and compute.
- Metrics remain aggregate and technical. Search text and user-authored or personal content are not
  logged.

## Testing strategy

- Local and remote adapters run the same contract scenarios and must produce equivalent domain
  results.
- Source-selection tests cover local priority, recoverable local failure, remote fallback, and
  structured failure when no source is available.
- Publication tests verify import validation, artifact generation, integrity metadata, and parity
  between canonical Neon content and generated offline artifacts.
- Worker tests cover valid and invalid App Check tokens, caching, rate limiting, and API contracts.
- Integration and load tests do not mutate the initially shared production dataset.
- Mobile QA covers online, offline, unstable-network, installed-copy, online-only, update, and
  corrupted-copy scenarios.
- Search tests require shared semantics and result contracts, not identical PostgreSQL/SQLite
  ranking or SQL implementation.

## Deferred or open decisions

- Exact TanStack Query package integration, retry counts, reconnect behavior, and stale times.
- Concrete contract/schema library and Worker framework.
- Concrete SQL query builder or ORM and migration tooling.
- PostgreSQL migrations and detailed schemas for each resource domain.
- Exact Cloudflare cache keys, TTLs, purge policy, and R2 signed-URL expiry/resume behavior.
- App Check verification implementation in the Worker and debug-provider workflow.
- Search query semantics, indexes, ranking, limits, debounce, and rate-limit thresholds.
- Detailed implementation plan, task breakdown, and validation commands for the accepted LSG slice.
- Persistent partial cache.
- Physical dev/staging/prod separation.

## Decision records

- `docs/adr/0005-resource-access-modules.md`
- `docs/adr/0008-serve-versioned-resources-through-domain-api.md`
- `docs/adr/0009-host-resource-delivery-on-neon-and-cloudflare.md`
- `docs/adr/0010-generate-offline-artifacts-from-canonical-postgres.md`
