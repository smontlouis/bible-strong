# PRD: Online-first resources with optional offline access

> Published to GitHub issue #245 on 2026-07-12. The issue body starts at `Problem Statement`; this
> local copy retains the title and publication note for repository context.

## Problem Statement

Bible Strong currently treats downloaded editorial resources as a prerequisite for meaningful app
usage. A first-time user can be blocked until the default Bible version is downloaded, and many
Bible-study surfaces assume that a complete SQLite or JSON resource already exists on the device.

Offline support should be a user benefit rather than an entry gate. A connected user should be able
to open Bible Strong, read a Bible version, search, and explore supported study resources without
first installing complete databases. A user should still be able to choose complete resources for
durable offline use, keep using installed resources without a connection, and control bandwidth and
storage explicitly.

The current codebase has begun introducing resource-domain interfaces, but their implementations
remain local-only wrappers around SQLite and JSON helpers. Some resource availability, coverage,
lifecycle, timeline, interlinear, and sidecar paths still depend directly on local assumptions. The
application also uses an internal lightweight query cache rather than TanStack Query. Adding remote
branches directly to screens would spread source selection, caching, error handling, and format
conversion throughout the app.

Bible Strong therefore needs a complete but incremental online/offline resource architecture: one
stable domain request from the UI, one query lifecycle, separate local and remote adapters, canonical
server-side resource data, compatible downloadable artifacts, and structured behavior when neither
source can satisfy a request.

## Solution

Build an online-first editorial-resource platform while preserving the existing offline experience.
Online-first describes product availability, not technical source priority: an installed offline
copy remains the preferred source until the user explicitly removes or updates it. When no valid
local copy exists, the same domain operation can use a remote API. Recoverable local corruption may
fall back to remote access. If no source succeeds, the viewer receives a structured, actionable
error.

Resource consumers use TanStack Query as their single request and in-memory cache layer. Query
functions call deep resource-access modules that own source selection and delegate to local
SQLite/JSON adapters or remote REST adapters. Both adapters translate into the same
storage-independent domain contracts. The initial design does not add a persistent partial cache.

Neon PostgreSQL in Frankfurt is the canonical store for published editorial resources and native
PostgreSQL full-text search. Cloudflare Workers provides the versioned REST/JSON API, App Check
verification, shared content cache, rate limiting, and observability. Private Cloudflare R2 buckets
hold downloadable offline artifacts. Firebase remains responsible for user authentication and
user-owned data and is not placed in the editorial-resource read path.

A repository-versioned publication pipeline imports and validates sources, stages replacement data,
generates offline artifacts compatible with current mobile formats, verifies online/offline parity,
and atomically activates one current revision per resource identity. The migration proceeds one
resource domain at a time. The first future implementation slice proves the full architecture with
LSG chapter loading before expanding to search and other resources.

## User Stories

1. As a first-time user, I want to open Bible Strong without downloading a Bible first, so that I can begin reading immediately when online.
2. As a first-time offline user, I want a clear unavailable state, so that I understand why content cannot load and how to obtain an offline copy.
3. As a returning user, I want installed resources to work without a network connection, so that Bible Strong remains reliable during travel, church, and poor connectivity.
4. As a reader, I want an installed Bible version to be preferred, so that reading is fast and stable.
5. As a reader, I want a non-installed supported Bible version to load remotely, so that I can use it without downloading the complete version.
6. As a reader, I want my installed revision to remain in use until I explicitly update it, so that the displayed text does not change according to connectivity.
7. As a reader, I want an unreadable local copy to fall back to remote content when possible, so that local corruption does not unnecessarily block reading.
8. As a reader, I want local corruption to be reported separately from a genuinely absent chapter, so that recovery does not hide content errors.
9. As a reader, I want recently requested content reused during the app session, so that repeated navigation is responsive.
10. As a reader, I want the viewer to show content or an actionable unavailable state, so that the version selector does not need to predict network availability.
11. As a reader, I want versions to remain visible and selectable even when temporarily unavailable, so that the catalogue does not unpredictably change.
12. As a reader, I want selectors to indicate installed offline copies when useful, so that I can see what is available without exposing SQLite or HTTP details.
13. As a reader, I want secondary resources to fail independently, so that a missing commentary or sidecar does not block the Bible chapter.
14. As a comparison user, I want non-installed parallel versions to load online, so that comparison does not require downloading every version.
15. As a comparison user offline, I want unavailable columns explained clearly, so that partial comparison states remain understandable.
16. As a Strong Bible user, I want Strong chapters to load through the same viewer behavior, so that source selection remains invisible.
17. As an interlinear user, I want interlinear chapters to load online when supported and absent locally, so that original-language study is immediately available.
18. As a Strong user, I want lexical entries, lookup, search, and concordance to work through one Strong resource domain, so that their storage source is irrelevant to the UI.
19. As a dictionary user, I want entry lookup, browsing, search, and verse-linked words online or offline, so that dictionary study is not gated by installation.
20. As a Nave user, I want topic lookup, browsing, search, random topics, and verse-linked topics online or offline, so that topical study is immediately useful.
21. As a cross-reference user, I want references to load remotely when the offline database is absent, so that the reference surface is not blocked by a download prompt.
22. As a commentary user, I want comments to load remotely when not installed, so that commentary remains an optional enhancement to reading.
23. As a timeline user, I want supported timeline content online or offline in my resource language, so that timeline exploration does not require initial setup.
24. As a user opening a Study relation target, I want a supported resource endpoint to open remotely when not installed, so that relations remain useful across resource availability states.
25. As a search user, I want Bible search online before installing local indexes, so that search works during my first session.
26. As an offline search user, I want searches limited to installed resources, so that results remain honest about local coverage.
27. As a search user, I want equivalent query meaning, filters, pagination, and result shapes online and offline, so that the interface remains predictable.
28. As a search user, I accept that relevance ranking can differ between PostgreSQL and SQLite FTS5, so that each engine can use its native strengths.
29. As a user managing storage, I want to see online availability, offline installation, update availability, download progress, failure, and integrity states, so that storage management is trustworthy.
30. As a user with limited storage, I want to remove an offline copy without removing online access, so that cleanup does not feel destructive.
31. As a user with limited bandwidth, I want every complete download and update to be explicit, so that the app does not unexpectedly transfer large files.
32. As a user updating a resource, I want the previous copy preserved until its replacement is verified, so that a failed update does not destroy working offline content.
33. As a user resuming a download, I want the app to renew temporary download access when necessary, so that short-lived URLs do not force me to restart manually.
34. As a user changing resource language, I want local and remote operations to use the same language selection, so that study resources remain coherent.
35. As a user of a Bible with a distinct canon or versification, I want its supported coverage declared accurately, so that unavailable locations are not silently invented or discarded.
36. As a user with notes, highlights, links, tags, studies, relations, bookmarks, and tab groups, I want those objects to remain independent from editorial-resource delivery, so that this migration does not change ownership or sync semantics.
37. As a user listening to audio, I want audio behavior to remain independent from the text-resource migration, so that existing playback is not disrupted.
38. As a user of the official Bible Strong app, I want the resource service protected from obvious third-party abuse, so that service capacity is reserved for legitimate app usage.
39. As a user without an account, I want remote editorial reads to work, so that reading online does not require authentication.
40. As a support engineer, I want structured errors to distinguish local storage, offline state, remote service, unsupported content, and genuine absence, so that failures are diagnosable.
41. As a product owner, I want resource domains migrated independently, so that unmigrated resources continue working locally while rollout risk stays bounded.
42. As a product owner, I want each resource or Bible version to declare online and offline-download capabilities independently, so that licensing and technical availability are respected.
43. As a product owner, I want structured rights and provenance metadata, so that publication cannot accidentally enable an unapproved delivery mode.
44. As a product owner, I want metrics on local resolution, remote resolution, latency, cache behavior, failures, security rejection, and download conversion, so that architecture decisions can use evidence.
45. As a privacy-conscious user, I want telemetry to exclude exact search text and personal content, so that operational monitoring does not collect study behavior unnecessarily.
46. As an editor or publisher, I want invalid or incomplete datasets blocked before activation, so that users never receive a partially published resource.
47. As an editor or publisher, I want a failed publication to leave the current revision active, so that publishing is atomic.
48. As an operator, I want live Neon and R2 to contain only the current revision, so that active storage remains simple.
49. As an operator, I want a small private recovery archive inaccessible to the app, so that a bad publication can be reconstructed and republished.
50. As an operator, I want production activation limited to protected manual CI, so that the initially shared backend cannot be modified accidentally from local tooling.
51. As an API consumer, I want `/v1` contracts to remain backward-compatible, so that an older installed mobile release continues working.
52. As a developer, I want one machine-readable contract definition for runtime validation, TypeScript types, and OpenAPI, so that mobile and server shapes cannot drift silently.
53. As a developer, I want domain-specific PostgreSQL tables and indexes, so that Bible, Strong, dictionary, Nave, and other resources retain strong schemas and efficient queries.
54. As a developer, I want local and remote adapters tested through the same domain scenarios, so that tests prove behavior rather than storage implementation.
55. As a developer, I want schema migrations separated from content publication, so that editorial updates cannot accidentally break active API versions.
56. As a developer, I want API, contracts, and publication tooling co-located with the app initially, so that cross-layer changes can be reviewed together before a formal monorepo migration.

## Implementation Decisions

- The project covers editorial resources and search. User-owned data, authentication semantics, and Firestore synchronization remain independent and unchanged.
- The product is online-first with optional offline access. Online-first removes mandatory initial downloads; it does not mean remote-first source priority.
- Resource consumers use one TanStack Query operation per domain request. TanStack owns request lifecycle, deduplication, and the initial memory-only query cache.
- Persistent partial query caching is deferred. Downloaded complete resources are offline copies, not query-cache entries.
- Hybrid SQLite/HTTP queries use a network mode that executes while offline. Purely remote metadata operations may pause while offline. React Native network state feeds TanStack's online manager.
- Retry behavior is based on structured error category rather than applied uniformly.
- Query keys represent domain content rather than local or remote source. Installing, removing, or updating an offline copy invalidates affected queries so source selection runs again.
- Each deep resource-access module owns source selection, local and remote adapters, domain contracts, structured errors, and resource-specific behavior.
- The local adapter is preferred whenever an offline copy is installed, including when a newer revision is advertised. Updates remain explicit.
- Recoverable local corruption or incomplete content falls back to the remote adapter when online delivery is supported. Genuine not-found, missing installation, unsupported resource, offline, corruption, and remote failure remain distinct.
- SQLite rows and HTTP payloads are private adapter details. Both sources produce the same storage-independent domain result.
- REST request and response contracts have one shared machine-readable definition supporting runtime validation, TypeScript types, and OpenAPI. The concrete schema library is deferred.
- `BibleViewer` uses one chapter-loading facade. It delegates plain Bible, Strong Bible, and interlinear requests to specialized internal providers.
- The chapter result is a discriminated contract with plain, Strong, and interlinear variants rather than one payload containing many unrelated optional fields.
- Strong lexical lookup, search, letter browsing, concordance, and reference operations remain a separate Strong resource domain.
- Resource selectors choose resources and may show installed status. They do not pre-resolve connectivity or duplicate loading policy. The viewer performs the query and renders content or an actionable unavailable/download state.
- Technical provenance such as SQLite, HTTP, or query cache is not displayed during normal consumption.
- A minimal server resource catalog declares current revision, online availability, offline-artifact location, checksum, and artifact schema metadata. Stable product labels and initial remote-adapter support remain application code.
- Firebase Remote Config is not used for initial resource rollout. Remote adapter support is initially declared in code and may be externalized only after a concrete operational need.
- The catalog is non-blocking. A catalog refresh failure can defer update checks or downloads but does not block installed local reads or require every remote content request to wait.
- Each resource identity declares online access and offline-download capabilities independently.
- Every installed offline copy stores revision, checksum, artifact schema version, installation timestamp, and useful counts. The exact local registry representation is deferred.
- Offline installation and update are atomic: temporary download, checksum and format/health validation, replacement/import, metadata commit, then removal of the superseded copy. Failure preserves the previous working copy.
- Existing offline distribution formats remain compatible during the initial migration. Regular Bible JSON continues importing into shared `bibles.sqlite`; other resources retain their existing SQLite/JSON formats.
- Canonical Bible metadata declares canon, versification, and published coverage. The initial system preserves the existing numeric book/chapter/verse identity and does not automatically map between versifications.
- Neon PostgreSQL is the canonical source for published editorial content and dynamic search.
- Neon is initially single-region in AWS Europe Frankfurt with no cross-region replica. Additional replication requires measured availability need.
- PostgreSQL uses domain-specific relational tables, constraints, and indexes. Heterogeneous resource payloads are not stored in one generic JSONB table.
- Regular Bible data uses one verse row keyed by Bible version, book, chapter, and verse, with publication metadata around the content. Chapter responses are assembled from ordered rows.
- PostgreSQL native full-text search with indexed `tsvector` is the initial remote search engine. No separate hosted search engine is introduced without measured relevance, latency, or load limitations.
- Online PostgreSQL search and offline SQLite FTS5 preserve query meaning, filters, pagination, and result contracts, but not identical scores or ordering.
- Cloudflare Workers exposes a versioned, domain-oriented REST/JSON API. The mobile app never connects directly to PostgreSQL, and no generic remote SQL API exists.
- Deterministic reads use shared long-lived Cloudflare caching and are purged during publication. Dynamic search is not CDN-cached initially.
- Firebase App Check is the target application-attestation layer for the custom API, using App Attest with DeviceCheck fallback on Apple platforms and Play Integrity on Android.
- The Worker verifies App Check before protected cache or origin access. Attestation tokens do not enter shared content cache keys.
- Static mobile tokens are not secrets or sufficient authorization. They may be used only as client identifiers. Rate limiting remains required, with stricter policy for dynamic search than cached deterministic reads.
- Private R2 buckets store offline artifacts. After App Check verification, the Worker returns a short-lived presigned URL scoped to one artifact; the app verifies the catalog checksum after download and can request a replacement URL for resume.
- Workers initially query Neon over HTTP with the Neon serverless driver. Hyperdrive is deferred until observed latency or connection pressure justifies another pooling/cache layer.
- API, shared contracts, Worker code, and publication tooling begin in the existing repository. The Expo tree is not moved immediately; formal Yarn workspaces may be introduced later.
- REST routes are versioned. An API version permits additive optional fields but no removal, rename, or reinterpretation. Breaking changes use a new route version and overlap until observed client usage allows retirement.
- PostgreSQL migrations are versioned in the repository, deployed separately from content publications, and use expand/migrate/contract changes to preserve active API versions.
- Development, staging, and production remain target logical environments, but initially may point to one shared Neon/Cloudflare production backend. Configuration remains environment-aware for later physical separation.
- Production publication credentials are available only to manually triggered protected CI. Local tools can import, generate, and validate but cannot activate production content.
- Publication creates one current revision independently for each distributable resource identity. Replacement data may exist temporarily in staging, then atomically replaces the live dataset. Older revisions are removed from live Neon and live R2.
- A bounded private recovery archive, initially the latest three publication inputs/artifacts, remains inaccessible to the mobile app. Recovery republishes archived material as a new current revision.
- The publication pipeline imports source material, validates it, stages canonical data, generates compatible offline artifacts, uploads with integrity metadata, verifies canonical/artifact parity, and atomically activates the catalog revision.
- Publication validation blocks duplicate verse identities, invalid ranges, unexpected empty content, count mismatches, invalid Unicode, inconsistent version/language metadata, contract failures, unhealthy artifacts, parity failures, and checksum mismatch.
- Canonical resource metadata records provenance, rights holder, terms reference, attribution, review date, and permitted delivery modes. The pipeline rejects conflicting modes; this guard does not replace legal review.
- The provisional capacity budget is 100,000 monthly active users, 10 million resource reads, and 2 million search actions per month. Production metrics replace these planning assumptions.
- Observability covers mobile resolution and time to content, Cloudflare request/cache/security behavior, and Neon query latency/load. Exact search text and personal or user-authored content are not logged.
- Migration is incremental: shared infrastructure and contracts; regular Bible reading; Bible search; Strong and interlinear; dictionary and Nave; cross references, commentaries, and sidecars; then timeline.
- The first future implementation slice is LSG chapter loading across publication, Neon, REST, App Check, Cloudflare cache, TanStack Query, SQLite priority, remote fallback, and structured unavailable state.

## Testing Decisions

- Tests verify externally observable domain and API behavior rather than SQL text, adapter internals, framework wiring, or exact FTS ranking.
- The shared contract package is tested for valid requests/responses, rejection of invalid boundary data, generated types, and OpenAPI consistency.
- Local and remote adapters run the same contract scenarios and must produce equivalent domain results for the same resource content.
- Source-orchestrator tests cover installed-local priority, an update being available without automatic source switching, absent local data, recoverable local corruption, successful remote fallback, genuine not-found, offline failure, unsupported resources, and remote failure.
- Query integration tests cover domain-only keys, memory-cache reuse, invalidation after install/remove/update, hybrid execution while offline, remote-only pausing, and retry behavior by error category.
- Bible chapter tests cover plain, Strong, and interlinear discriminated results without coupling the tests to rendering implementation.
- Search tests cover normalized query meaning, filters, pagination, canonical-order and relevance modes, result contracts, empty results, and language/diacritic behavior. They do not require PostgreSQL and SQLite to rank identically.
- Resource catalog tests cover current revision, capabilities, artifact metadata, non-blocking refresh failure, and update detection against installed metadata.
- Installation tests cover temporary download, presigned-URL renewal, checksum mismatch, invalid JSON, corrupt SQLite, failed import, atomic replacement, metadata persistence, and preservation of the previous copy after failure.
- Publication tests cover idempotent import, blocking validation rules, staging, rights/capability enforcement, artifact generation, full canonical/artifact parity, checksum registration, atomic activation, live old-revision removal, and recovery republishing.
- Worker tests cover REST contracts, backwards compatibility within `/v1`, valid/invalid/missing App Check, protected cache ordering, shared cache keys, deterministic cache hit/miss, publication purge, rate limiting, and structured errors.
- PostgreSQL integration tests cover domain constraints, migration compatibility, chapter ordering, full-text indexes, filters, pagination, and query plans for representative searches.
- Schema migration tests cover expand/migrate/contract compatibility with every active API version and remain separate from publication tests.
- Observability tests or integration assertions verify expected structured dimensions without emitting exact search text or personal content.
- Existing Bible-loading, search-model, resource-availability, download-queue, database-health, and DOM error-state tests are prior art where applicable.
- Manual QA covers first launch online and offline, installed and non-installed LSG, update available, corrupted local copy, flaky network, App Check debug and production providers, resource removal, download resume, multiple Bible tabs, and app restart.
- Performance validation measures first-chapter time to content, cached chapter latency, Neon cache-miss latency, search latency, database query load, multiple-tab behavior, artifact download/install time, and the provisional capacity model.
- Integration and load tests must not mutate the initially shared production dataset.

## Out of Scope

- Rewriting notes, highlights, links, tags, studies, Study relations, bookmarks, tab groups, reading-plan user state, Redux persistence, authentication, or Firestore synchronization.
- Rebuilding the Bible DOM renderer or redesigning navigation.
- Migrating away from SQLite for complete offline copies.
- Changing current offline artifact formats during the first online migration.
- Adding a persistent partial cache in the first implementation.
- Automatically downloading or updating complete resources without explicit user action.
- Building a generic remote SQL endpoint.
- Adding GraphQL or gRPC.
- Adding Algolia, Elasticsearch, Meilisearch, or another hosted search engine before PostgreSQL limitations are measured.
- Adding Cloudflare Hyperdrive before measured latency or connection pressure justifies it.
- Keeping historical revisions in live Neon or live R2.
- Building a resource administration UI before the CLI/CI publication workflow proves a need.
- Implementing automatic mappings between Bible versifications or expanding the app's supported canon as part of this project.
- Changing audio providers or moving audio files behind the resource platform.
- Adding new Bible translations or editorial content as part of the architecture migration.
- Guaranteeing identical PostgreSQL and SQLite FTS ranking.
- Physically separating development, staging, and production in the initial infrastructure phase.
- Guaranteeing that app attestation makes an API or downloaded client-side content impossible to extract or replay.
- Starting implementation during this design/PRD work.

## Further Notes

- The current codebase has useful local resource-access seams and is ready for incremental migration,
  but it does not yet have a completed online/offline module system.
- The first implementation milestone should remain a narrow but complete LSG chapter-loading slice.
  It validates architecture rather than attempting to deliver the entire PRD at once.
- Exact choices for the runtime schema library, Worker framework, SQL query builder or ORM, migration
  tool, cache TTLs, purge keys, App Check verification implementation, retry counts, rate limits,
  and signed-URL expiry belong in the implementation plan or prototype unless they alter a durable
  contract.
- The single shared backend is an acknowledged transitional risk. Production activation remains
  protected until physical environment isolation is introduced.
- The durable architectural decisions and domain language are recorded separately in the project
  context and ADRs. This PRD should remain the product and implementation contract rather than the
  only record of architectural rationale.
