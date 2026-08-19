# ADR-0009: Host resource delivery on Neon and Cloudflare

## Status

Accepted

## Context

The online resource system needs managed PostgreSQL, an anonymous domain API, cacheable global
delivery, and storage for downloadable offline artifacts. Bible Strong already uses Firebase for
authentication and user-owned data, so adopting another bundled backend platform would duplicate
capabilities that the resource context does not need. The target architecture should remain
economical around 100,000 monthly active users and allow the team to trade some integration
complexity for clearer cost and scaling controls.

## Decision

Use Neon for managed PostgreSQL and Cloudflare for resource delivery. Cloudflare Workers hosts the
domain-oriented HTTP API and its abuse controls, Cloudflare caching absorbs repeat deterministic
reads, and R2 stores published SQLite/JSON offline artifacts. Neon stores published resource data
and serves dynamic operations such as search behind the Worker API. Firebase remains responsible
for authentication and user-owned data and is not placed in the resource-read path.

Workers connect to Neon through Cloudflare Hyperdrive using Kysely's `PostgresDialect` and
`node-postgres`. Each request creates one bounded pool shared by all resource repositories and
closes it when the response has been produced. Local development uses the same Kysely repositories
against local PostgreSQL; changing the connection adapter must not change domain queries or
Resource contracts. Hyperdrive SQL caching starts disabled so publication activation cannot return
stale database rows; application-aware Cloudflare response caching remains a separate delivery
concern.

Place the initial Neon project in AWS Europe Frankfurt (`eu-central-1`) for proximity to Bible
Strong's primarily French and European audience. Cloudflare remains the global delivery and cache
layer in front of this regional canonical database.

Start with one Neon region and no cross-region replica. Installed offline copies, shared Cloudflare
cache, managed backups, monitoring, and the bounded publication archive provide initial resilience;
introduce additional database replication only when measured incidents or availability objectives
justify its cost and complexity.

## Consequences

The resource context gains independent scaling and cost controls without duplicating user
authentication. Hyperdrive centralizes Worker-to-Neon connection pooling and keeps database
credentials out of Worker variables. Cached content and offline artifacts can be delivered without
sending every read to PostgreSQL. The system must operate and observe two providers, restrict the
Hyperdrive origin role to resource reads, keep resource revisions consistent across Neon and R2,
and ensure publication work does not exceed the execution limits of request-serving Workers.
Capacity estimates must be based on request volume, cache-hit rate, search load, and database
compute rather than monthly active users alone.

For initial design and cost modelling, assume 100,000 monthly active users generating approximately
10 million resource reads and 2 million search actions per month. This is a provisional capacity
budget, not a product forecast; production observability must replace it with measured request,
cache-hit, latency, and database-load data.

Development, staging, and production remain the target logical environments for the resource
system, matching the application's existing build configuration. Initially, however, all three may
point to one shared Neon/Cloudflare production backend, as they currently do for Firebase. Code and
credentials should remain environment-aware so physical separation can be introduced later without
redesigning contracts. Until then, tests and staging activity do not have infrastructure isolation
from production and must be treated accordingly.

Observe mobile local/remote resolution and time to content, Cloudflare request/cache/security
behavior, and Neon query latency/load from the first rollout. Telemetry remains aggregate and
technical: do not log exact search text or user-authored content.
