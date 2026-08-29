# ADR-0022: Develop the production resource service locally

## Status

Accepted

## Context

Online resource delivery must be designed with Resource Studio without publishing editorial
databases prematurely. A disposable API backed directly by mobile SQLite schemas would validate
HTTP wiring but would defer the canonical PostgreSQL model and require substantial replacement
work later.

## Decision

Build the production-shaped resource service locally before provisioning its hosted infrastructure.
The local environment uses the real versioned contracts, PostgreSQL schema and migrations, domain
routes, queries, structured errors, and canonical import workflow intended for production. The
first vertical slice is LSG chapter loading; a distinct SQLite-backed resource such as Nave follows
only after that slice works end to end.

Resource Studio owns generating and validating each versioned Resource publication bundle. The
Bible Strong repository owns the Resource domain API contracts, service, PostgreSQL migrations, and
the importer that loads those bundles into the canonical database. Mobile databases installed in a
simulator are never publication inputs.

During the local phase, the HTTP adapter is development-only, but the application adopts the target
resource-access model across every editorial-resource surface. No Bible or study resource is a
startup prerequisite. LSG and KJV remain language-specific default reader choices only; neither is
a mandatory Offline copy. Onboarding is dismissible and every complete download remains optional.

The shared application foundation covers Bible versions and their presentation data, Strong Bible
indexes, interlinear indexes, Strong lexicon modules, dictionary, Nave, cross references,
commentaries, timeline, and their search, viewer, selector, home, onboarding, relation-target, and
storage-management surfaces. Each surface requests a Resource domain operation and renders the
same user-facing availability/action model. A domain without a remote endpoint may still be
download-only during incremental rollout, but it may not keep a bespoke file-existence gate or
claim that the resource is intrinsically required.
Neon, Cloudflare deployment, App Check, CDN caching, rate limiting, R2 delivery, and production
activation are deferred; replacing local infrastructure with hosted bindings must not replace the
domain contracts or service behavior.

The local canonical database runs in Docker Compose with a pinned PostgreSQL major version, a
persistent volume, a health check, and a separate explicit reset command. Effect HttpApi owns the
shared HTTP application, with a Node entry point locally and a Cloudflare Worker entry point later.
Effect services, layers, typed errors, interruption, timeouts, retries, tracing, and logging surround
the domain and infrastructure boundaries.

Drizzle Schema owns the executable PostgreSQL table definitions and Drizzle Kit owns reviewed
generated migrations. Kysely is the only runtime query builder. Kysely database types are derived
from Drizzle tables with `Kyselify` so table definitions are not duplicated. Local repositories use
`PostgresDialect` with `node-postgres`; the hosted Worker later uses the Kysely Neon dialect over the
Neon HTTP driver. Application and domain code depend only on Resource repository interfaces and do
not import Drizzle tables or a database client.

Kysely promises are wrapped explicitly at the repository boundary with Effect, where infrastructure
failures are translated into typed domain errors and receive interruption, timeout, retry, logging,
and tracing behavior. Do not use `@effect/sql-kysely` until its supported Kysely range and dependence
on Kysely internals are re-evaluated. Do not execute application queries through Drizzle: using both
Drizzle and Kysely as runtime query builders would violate this decision.

Effect Schema definitions are the single source for `/v1` runtime validation, TypeScript types, JSON
Schema, and OpenAPI. A non-destructive `yarn resources:dev` command starts PostgreSQL, applies
pending schema migrations, imports an explicitly selected bundle only when needed, starts the API,
and reports the development URLs required by simulators or local devices. It never resets the
database or activates a different publication implicitly.

LSG is the first remotely functional vertical slice, not a product prerequisite. The LSG slice is
complete only when the full publication, not a fixture subset, imports and can be
queried across all published books, chapters, verses, coverage, and editorial data. Contract,
importer, Effect HttpApi route, shared local/HTTP scenario, and mobile source-orchestrator tests are
blocking; database integration tests run against real temporary PostgreSQL. Publication parity is
verified across the complete LSG revision.

Hosted infrastructure work starts only after a clean database can be migrated and populated
reproducibly, the complete parity suite passes, the `/v1` contract is stable, and the mobile client
can switch bindings without changing product behavior. App Check, shared caching, rate limiting,
observability, and rollback are then required before public Online activation.

## Consequences

The project validates its canonical data model and online/offline behavior before incurring hosted
infrastructure or publishing data. SQLite and JSON artifacts remain import sources, Offline copies,
and parity oracles rather than becoming the Resource API's storage contract. This requires an
explicit, versioned handoff between the two repositories and local PostgreSQL support from the
first implementation slice. It also requires an application-wide migration away from mandatory
downloads, local-file gates, and resource-specific download alerts even though remote endpoints are
delivered domain by domain. The service carries both Drizzle and Kysely dependencies, but their
responsibilities do not overlap: Drizzle defines and migrates storage, while Kysely alone queries it
at runtime behind Effect repository services.
