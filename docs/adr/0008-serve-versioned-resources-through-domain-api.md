# ADR-0008: Serve versioned resources through a domain API

## Status

Accepted

## Context

Online resource access needs granular chapter, entry, and search operations while preserving
downloadable offline copies. Letting the mobile app connect to PostgreSQL or expose remote SQL would
couple it to the server schema, weaken the security boundary, and make HTTP caching difficult.

## Decision

Use a managed PostgreSQL service behind a versioned, domain-oriented REST/JSON API. The mobile app
calls resource operations and never connects to PostgreSQL directly. Deterministic `GET` reads such
as published Bible chapters and lexical entries are eligible for HTTP/CDN caching, while dynamic
search and filtering may query PostgreSQL.
The publication pipeline assigns immutable resource revisions and produces or registers the matching
downloadable offline artifacts.

The initial Bible chapter route is
`GET /v1/bibles/{version}/books/{book}/chapters/{chapter}`. Its response is a canonical DTO rather
than the mobile application's historical `Verse` type or a PostgreSQL row shape. It declares the
active Resource revision in the response and HTTP validator. `/v1` versions the API contract, while
content replacement changes the Resource revision without changing the route version. The API serves
only the active revision and does not expose historical-revision reads.

Define the server application with Effect HttpApi and define request, response, and error boundaries
with Effect Schema. These definitions are the single source for runtime validation, TypeScript types,
JSON Schema, and OpenAPI. The Node development entry point and the future Cloudflare Worker entry
point provide runtime bindings to the same HTTP application rather than owning separate route logic.

Boundary failures use stable structured problem responses with an HTTP status, domain code, safe
message, request identifier, and retry information where relevant. Database errors and other
implementation details never cross the Resource domain API boundary.

Remote editorial reads must work without an authenticated user account so first-time users can read
online immediately. Operational protections such as rate limits, quotas, app attestation, and
resource-specific licensing controls may protect the API without making account authentication a
prerequisite.

Require Firebase App Check tokens on the custom resource API as the target application-attestation
mechanism, using App Attest with DeviceCheck fallback on Apple platforms and Play Integrity on
Android. The Cloudflare Worker verifies attestation before protected cache or origin access. A
static client identifier may support telemetry or routing but is not treated as a secret or an
authorization mechanism. Rate limiting remains necessary because mobile attestation reduces abuse
but cannot guarantee that a compromised device will never produce valid requests.

The minimal resource catalog is operational publication metadata and is not on the critical path of
every resource read. Failure to refresh the catalog can defer update checks or artifact downloads,
but does not block installed local content or require an otherwise valid remote content request to
wait for catalog availability.

Cache deterministic content reads such as chapters and published resource entries for a long period
at Cloudflare and purge affected entries during publication. Do not CDN-cache dynamic search in the
initial design. Verify App Check before protected cache access, while keeping attestation tokens out
of shared content cache keys so verified application instances reuse the same cached response.

Keep offline artifacts in private R2 buckets. After App Check verification, the Worker reads the
requested catalog artifact through its R2 binding and streams it to the mobile client with byte-range
support. The Worker accepts only stable object keys declared by the exhaustive mobile catalog and
never exposes publication metadata sidecars or recovery objects. The mobile client then verifies the
catalog checksum. This keeps permanent R2 credentials and public bucket domains out of the delivery
path and allows interrupted downloads to resume without expiring bearer URLs.

## Consequences

The API contract, rather than the PostgreSQL schema, becomes the remote boundary consumed by the app.
Repeated deterministic reads can be absorbed by HTTP/CDN caches, while PostgreSQL remains available
for structured and dynamic capabilities. The system must operate a publication pipeline, revisioned
cache keys or validators, and explicit cache invalidation when a new revision is published.
REST/JSON keeps TanStack Query integration, Cloudflare caching, contract tests, and `/v1` evolution
simple without introducing GraphQL or gRPC clients.

Define REST requests and responses once in a shared machine-readable contract package. The same
definitions provide runtime boundary validation, inferred or generated TypeScript types, and OpenAPI
documentation. Plain handwritten TypeScript interfaces on the mobile and Worker sides are not
independent sources of truth. Effect Schema is the concrete contract library and Effect HttpApi is
the server application boundary.

Keep each API route version backward-compatible for its lifetime. Additive optional fields are
allowed, but removing, renaming, or reinterpreting existing fields requires a new route version.
Operate old and new versions together until observed client usage supports retirement, recognizing
that installed mobile applications can remain on older releases for months.

Version PostgreSQL schema migrations in the repository and apply them separately from editorial
publication. Use expand/migrate/contract changes: add compatible structures, deploy code that can
use both forms, migrate data and reads, then remove old structures only after no active API version
depends on them.

The resource API, shared contracts, and publication pipeline begin in the existing repository so a
single change can evolve mobile and server behavior together. The Expo application does not need to
move immediately; the repository can adopt formal monorepo workspace boundaries later when the
additional packages and independent build workflows justify that migration.
Anonymous access keeps resource delivery independent from user-data authentication, but requires
explicit abuse prevention and a review of distribution rights for each resource.
Using a managed database introduces a provider dependency and recurring service cost, but avoids
making database maintenance, patching, backups, and recovery part of the application's operational
workload.
