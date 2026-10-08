# Resource service

This directory contains the Resource API, its local PostgreSQL runtime, and its Cloudflare Worker
deployment configuration. Neon and Cloudflare infrastructure is administered separately from the
application source.

## Start the local database and API

```bash
yarn resources:dev
```

The command starts persistent PostgreSQL, applies reviewed Drizzle Kit migrations, and serves the
Effect HttpApi application. It never resets the database. Use `yarn resources:db:reset` only when an
explicit destructive reset is intended.

### Import the local thematic search index

The online-only thematic index combines the already imported Nave publication with Torrey and
OpenBible topic references. The command downloads missing source snapshots into the gitignored
`resource-service/.local/topic-sources/` directory, records their versions and SHA-256 hashes,
rebuilds the thematic index transactionally, and writes a measurable report to
`resource-service/.local/topic-import-report.json`:

```bash
yarn resources:db:up
yarn resources:migrate
yarn resources:topics:embeddings:dev # terminal 1; Workers AI remote binding
yarn resources:topics:import
```

The embedding development Worker listens on `127.0.0.1:8791` and uses the authenticated Wrangler
account to run the non-generative Qwen3 embedding model. Workers AI usage is remote and billable
even though the Worker and PostgreSQL are local. No Cloudflare Worker is deployed by this command.
The importer fails instead of silently mixing or substituting another embedding model.
Transient Workers AI capacity responses are retried with bounded exponential backoff; document
generation uses limited concurrency and the database replacement begins only after every vector has
been validated.

Re-running the command replaces only the derived thematic tables and cannot create duplicate
associations. It does not modify mobile SQLite artifacts. See
[`docs/resources/thematic-search-sources.md`](../docs/resources/thematic-search-sources.md) for
provenance, attribution, and known limits.

To import one already validated publication before the API starts, select it explicitly:

```bash
RESOURCE_PUBLICATION_BUNDLE=/absolute/path/to/bundle yarn resources:dev
```

To start the same local API with the complete nested Maker catalog, pass its roots once. The
command starts PostgreSQL, migrates it, imports the roots in dependency order, and then serves the
API; it never resets the database:

```bash
RESOURCE_PUBLICATION_ROOTS="/path/to/ordinary:/path/to/strong:/path/to/interlinear:/path/to/lexicon:/path/to/editorial" \
  RESOURCE_API_PORT=8787 yarn resources:dev
```

## Resource Studio handoff

The Resource service never scans Resource Studio's working files. The handoff input is
an explicit immutable publication bundle produced and validated by Resource Studio. Copy or
mount that bundle at a path selected explicitly for local validation or import; Bible Strong does
not generate its manifest, editorial metadata, or Offline-copy artifact:

```bash
yarn resources:bundle:validate --bundle /absolute/path/to/resource-studio/lsg-bundle
```

The accepted schema-v1 bundle represents exactly one `bible-text`, `strong-bible-index`,
`interlinear-index`, or `nave` identity and immutable revision.
It contains:

- `manifest.json`, with identity, language, revision, provenance, independent delivery capabilities,
  rights, domain coverage, counts, format versions, sizes, and SHA-256 checksums;
- `canonical/*.json`, used by the PostgreSQL importer;
- `offline/*.zip`, the matching Offline-copy artifact delivered to the app. Bible bundles contain
  the canonical JSON; Strong Bible, interlinear, and Nave bundles contain the generated SQLite
  database used by existing mobile surfaces.

A Strong Bible manifest declares its matching `bible-text:<version>` revision and text SHA-256 as
required in both Online and Offline-copy modes. It also declares the Strong lexicon modules required
for lexical details. Validation compares every identity, span offset, alignment flag, morphology
token link, lexeme assignment, and aggregate count between canonical JSON and the archived SQLite
sidecar.

A BHG interlinear manifest identifies one `STEP` gloss language (`fr` or `en`), declares the exact
`bible-text:BHG` revision and text SHA-256 required in both delivery modes, and declares the Strong
lexicon modules needed for lexical details. Validation compares every verse, token, alignment
offset, segment, localized gloss, morphology value, and ordered lexical identity between canonical
JSON and the archived V5 SQLite sidecar.

Nave archive entries are `nave-fr.sqlite` (French) and `nave.sqlite` (English). In addition to the existing `TOPICS` and `VERSES`
tables, publication copies contain one `RESOURCE_METADATA` row with `resource_id`, `revision`,
`source_version`, and `source_sha256`. Validation opens the database and compares every topic,
description, verse/chapter anchor, durable identity, and metadata value with canonical JSON before
activation.

The Resource service independently validates the supported handoff contract: manifest version, safe
paths, both files, archive entry, hashes, identity, source revision, counts, and delivery rights:

```bash
yarn resources:bundle:validate --bundle resource-service/.local/publications/lsg
yarn resources:bundle:validate --bundle resource-service/.local/publications/nave-fr
yarn resources:bundle:validate --bundle resource-service/.local/publications/nave-en
```

Import and activation are one Kysely transaction wrapped at the Effect repository boundary:

```bash
yarn resources:db:up
yarn resources:migrate
yarn resources:import --bundle resource-service/.local/publications/lsg
yarn resources:import --bundle resource-service/.local/publications/nave-fr
yarn resources:import --bundle resource-service/.local/publications/nave-en
yarn resources:import-all --root /path/to/ordinary-bible-publications-current
yarn resources:import-all --root /path/to/strong-bible-publications-current
yarn resources:import-all --root /path/to/interlinear-publications-current
```

For a complete local editorial bootstrap, pass every Maker release root to the catalog importer.
It discovers nested `manifest.json` bundles, imports them in dependency order, and activates them
for local development without resetting PostgreSQL:

```bash
RESOURCE_PUBLICATION_ROOTS="/path/to/ordinary:/path/to/strong:/path/to/interlinear:/path/to/lexicon:/path/to/editorial" \
  yarn resources:import-catalog
```

The command is repeatable: unchanged revisions are reported as `unchanged`, while a changed
revision is staged and activated by the normal importer. It is intentionally local-only; it does
not contact or modify a hosted database.

`import-all` is the explicit local-development path: it activates publications whose manifest sets
`localDevelopmentAccess`, while the ordinary `import` command continues to stage any publication
whose rights do not permit public Online delivery.

For a hosted Neon branch, use an explicit direct (non-pooled) connection string. This command never
activates a publication solely because it declares `localDevelopmentAccess`:

```bash
RESOURCE_DATABASE_URL="postgresql://..." \
RESOURCE_PUBLICATION_ROOTS="/path/to/resource-publications" \
  yarn resources:import-catalog:hosted
```

The hosted command refuses a missing URL and Neon pooler hostnames. Keep the connection string out
of shell history and committed environment files.

The Neon CLI is available to publication operators through `yarn dlx neonctl`. A missing
`RESOURCE_DATABASE_URL` is therefore not, by itself, a release blocker: authenticate or select the
existing Neon profile, link the production project if necessary, then obtain a direct connection
string with `connection-string` (its `--pooled` option defaults to `false`). Capture it without
printing it or enabling shell tracing, and pass it only to the import subprocess:

```bash
yarn dlx neonctl auth
yarn dlx neonctl link --project-id holy-smoke-13882397
set +x
RESOURCE_DATABASE_URL="$(yarn dlx -q neonctl connection-string production \
  --project-id holy-smoke-13882397 \
  --role-name neondb_owner \
  --database-name neondb \
  --pooled=false)" \
  yarn resources:import-catalog:hosted --root /path/to/changed-publications
```

Never paste the returned URL into chat, logs, documentation, or a committed file. If the CLI is not
already authenticated, stop for operator authentication rather than replacing the direct
publication credential with a Hyperdrive or pooled connection.

Reimporting the same revision and checksums returns `unchanged`. Reusing a revision with different
content fails. Validation failures or Effect interruption roll back staging and preserve the prior
active publication.

## Publish Offline-copy artifacts to private R2

The resource publisher uploads only bundles whose manifest independently authorizes Offline-copy
delivery. Normal releases use an explicit changed-bundle selection: the checked-in exhaustive
catalog is decoded and count-checked locally, every selected bundle must match its catalog entry,
and only those selected immutable R2 objects and metadata sidecars are contacted. Each upload is
read back for size and checksum verification before the Worker catalog is deployed.

Publish one or more changed bundles with repeated `--root` arguments:

```bash
RESOURCE_R2_BUCKET=bible-strong-resource-artifacts-prod \
  yarn resources:r2:publish-changed \
    --root /absolute/path/to/changed-bundle \
    --root /absolute/path/to/another-changed-bundle
```

For the three Strong lexicon modules in the standard sibling-checkout workspace:

```bash
yarn resources:r2:publish-strong-lexicon:prod
```

The end-to-end Bible publication workflow derives the same selection from its overlay and publishes
only `changedBundlePaths`. The full 114-bundle command remains available for an explicit bootstrap or
storage audit, not for an ordinary release:

```bash
RESOURCE_R2_BUCKET=bible-strong-resource-artifacts-prod \
RESOURCE_PUBLICATION_ROOTS=/absolute/path/to/resource-publications \
  yarn resources:r2:publish-catalog
```

Its production audit shortcut supplies both non-secret values automatically:

```bash
yarn resources:r2:publish-catalog:prod
```

Both modes use the exhaustive catalog at `packages/resource-catalog/src/mobile-resource-catalog.json`. The changed mode
requires the checked-in 114-entry inventory but does not require 114 bundle paths. The publication
manifest independently authorizes and validates every selected revision, archive entry, byte size,
and SHA-256. Update the catalog before publishing; deploy the Worker only after the selected R2
uploads and hosted imports succeed.

The bucket remains private. Every production `/v1` resource request is protected by Firebase App
Check. The Worker verifies the Firebase JWT signature, project, expiration, audience, and
allow-listed native App ID before opening Hyperdrive or reading R2. The artifact route accepts only
`GET` and `HEAD` for exact stable paths in the checked-in mobile catalog, then streams bodies and
byte ranges through the binding. Missing or invalid attestation returns `401`. Offline copies are
served only to Android and iOS App IDs; a valid Web attestation returns `403` on
`/v1/offline-artifacts/` and remains valid for Online reading (ADR-0063). `/health` and the
non-sensitive `/v1/offline-catalog` remain public. Publishing does not expose
an R2 custom domain. The mobile catalog and all resource artifact URLs use the Worker route
`/v1/offline-artifacts/`; the application has no Firebase Storage fallback for resources. Keep
subsequent publication credentials in the gitignored local operator environment described by
ADR-0027.

The Worker configuration contains only the non-secret Firebase project number, the six native App
IDs declared by the development, staging, and production Firebase application files, and the Web
App ID.
It fetches Firebase's rotating public App Check JWKS and keeps tokens out of logs and cache keys.
The Expo application uses the App Check config plugin, Play Integrity on release Android builds,
App Attest with DeviceCheck fallback on release Apple builds, reCAPTCHA Enterprise on Web, and
Firebase's debug provider in development. Register each release provider and each local debug token
in Firebase Console before testing protected API reads or artifact downloads. Do not put debug
tokens in committed `.env` files.

## Publish one edited Bible end to end

Use the unified workflow after editing a legacy or canonical Bible JSON. Without the production
flag, it creates and validates a candidate only: it packages the Bible, verifies any existing
Strong or interlinear sidecars that depend on its text, rebuilds the exhaustive 114-resource mobile
catalog, validates every publication bundle, and proves R2/catalog parity without contacting R2 or
Neon:

```bash
yarn resources:publish:bible \
  --version LSG \
  --source /absolute/path/to/bible-lsg.json
```

The result prints the retained workspace, candidate revision, and changed catalog identities. If
the text revision changed for a Bible with a Strong/interlinear sidecar, first rebuild that producer
data with its dedicated Maker workflow, then supply the resulting publication one or more times as
`--dependent-bundle /absolute/path/to/bundle-or-root`. The preflight rejects an omitted, stale, or
partially rebuilt dependency before any production write.

For production, copy the example environment once and fill it with the direct Neon publication URL,
R2 bucket, Firebase App Check debug credential, Firebase application values, and optionally a
Cloudflare API token. The local file is gitignored:

```bash
install -m 600 .env.resource-publication.example .env.resource-publication.local
```

After reviewing the candidate, run the production CLI. The script adds the activation flag, but the
operator must type the exact production confirmation on every run:

```bash
yarn resources:publish:bible:prod \
  --confirm-production bible-strong.app \
  --version LSG \
  --source /absolute/path/to/bible-lsg.json
```

Add rebuilt dependencies with repeated `--dependent-bundle` options when required. Wrangler may use
the Cloudflare values from the local environment file or an existing `yarn wrangler login` session.
Production requires a clean Git worktree (ignored local credentials are unaffected) and holds an
exclusive Neon advisory lock until activation or compensation finishes. Its `master` revision must
match a freshly fetched `origin/master`, preventing an old checkout or feature branch from deploying
the production Worker.

Production mode runs every preflight gate before its first production write, then publishes only the
changed validated Offline copies to immutable, content-addressed private R2 keys, imports and activates only the changed publications in
Neon, atomically replaces the checked-in Worker catalog, restores or creates its encrypted Offline
copies (see below), deploys the Worker, and checks health,
catalog parity, App Check rejection for an unattested artifact request, and an authenticated
immutable-artifact checksum plus revision reads through Worker/Hyperdrive. The preflight first
proves that the checked-out catalog, live Worker catalog, baseline bundles, live Neon revisions, and
the changed rollback objects in the configured production R2 bucket describe the same release.
Exhaustive R2 traversal is reserved for explicit bootstrap or storage audits. The Neon URL must be a direct
non-pooler connection. The local protected environment stores a registered Firebase App Check debug
credential, and the CLI exchanges it for a fresh short-lived JWT separately for preflight and smoke
reads. Database, App Check, and Cloudflare credentials are only passed to the subprocess that needs
each credential; they are never written into the workspace.

On success, `packages/resource-catalog/src/mobile-resource-catalog.json` remains modified locally for review and a
normal commit. The retained workspace's `verified-publication-baseline` directory is the exhaustive
114-bundle baseline for the following publication; pass it later with `--publication-root`. The same
workspace contains the previous catalog and candidates needed to audit or recover the release.

The generated date can be pinned with `--generated-at`; sibling checkout locations can be changed
with `--maker-root` and `--publication-root`. Every workspace is intentionally retained as the
audit/retry artifact and an existing workspace is never overwritten.

## Deploy the production Worker

The production Worker reaches Neon only through the `HYPERDRIVE` binding and has private access to
R2 through the `RESOURCE_ARTIFACTS` binding declared in `wrangler.jsonc`. Hyperdrive uses the dedicated `resource_api` PostgreSQL login, which has `CONNECT`,
schema `USAGE`, and table `SELECT` privileges but no table writes or role/database administration.
Its password is held by Hyperdrive and must never be added to a Worker secret, environment file, or
the repository. Hyperdrive SQL caching is disabled until publication-aware invalidation exists.

Authenticate Wrangler, regenerate and verify generated binding types, then deploy:

```bash
yarn wrangler login
yarn resources:worker:types
yarn resources:worker:check
yarn resources:worker:deploy
```

The production deployment uses the Custom Domain `api.bible-strong.app`; `workers.dev` is disabled.
The `bible-strong.app` zone must therefore be active in Cloudflare before deployment. After
deployment, verify both the Worker itself and an actual read through Hyperdrive:

```bash
curl --fail https://api.bible-strong.app/health
curl --fail https://api.bible-strong.app/v1/bibles/LSG/books/1/chapters/1
```

`GET /health` is answered by the Worker entry alone. Only the second request proves that the
HTTP application loads and that Hyperdrive reaches Neon.

### Worker start-up

Cloudflare starts more isolates of the Worker when requests arrive together, and each new
isolate evaluates the entry module `src/runtime/worker.ts` with everything it imports
statically before it answers its first request, a preflight or a cached read included. The
entry therefore imports only what a cached answer needs: CORS, the limiters, the edge cache,
artifact delivery and the catalog. Effect, the HTTP application, Kysely, pg and the search
modules live behind `src/runtime/resourceOrigin.ts`, which the entry imports dynamically the
first time an isolate has to read the database.

Wrangler keeps one file: it turns that dynamic import into a function called on demand, so the
code is still uploaded and parsed, but no longer evaluated at start-up. The built-in Node
modules that `pg` requires stay static imports of the bundle and are still loaded at start-up.

An isolate builds the HTTP application once, the first time a request needs it, and keeps it
(`resourceApplicationFor`). Building it takes about 11 ms of CPU, answering with it 0.2 ms;
built for every uncached read, it kept the isolate busy and made Cloudflare start more isolates
when uncached reads arrived together. Nothing of a request lives in it: the `pg` pool, opened
for each request as Cloudflare asks for Hyperdrive, and the repositories over it come with the
request (`makeResourceRequestServices`) and are closed when it is answered.

The `resource API request` log line says where a read spent its time: `isolateRequest` is 1
for the request that followed the start of its isolate, `databaseConnectMs` is the time its
connection to Hyperdrive took to open, `sqlStatements` and `sqlMs` count its statements and
their time, and `durationMs` covers the cache and the application.

`src/runtime/__tests__/workerStartupImports.node-test.ts` fails when a static import of the
entry reaches one of those modules. To measure a start, profile it locally and compare the
`Worker Startup Time` that `wrangler deploy` prints:

```bash
yarn workspace @bible-strong/resource-service wrangler check startup --config wrangler.jsonc
```

### Apply a schema migration

`yarn resources:migrate` applies the pending Drizzle Kit migrations of `drizzle/` to the
database named by `RESOURCE_DATABASE_URL`, the local one by default. For Neon, pass the same
direct (non-pooled) connection string as a hosted import, without printing it:

```bash
set +x
RESOURCE_DATABASE_URL="$(yarn dlx -q neonctl connection-string production \
  --project-id holy-smoke-13882397 \
  --role-name neondb_owner \
  --database-name neondb \
  --pooled=false)" \
  yarn resources:migrate
```

`0035_strong_lexicon_entries_ustrong_lookup` only creates an index on
`strong_lexicon_entries (publication_id, u_strong)`. The one-statement read of a detailed
Strong entry
([ADR-0070](../../docs/adr/0070-read-a-detailed-strong-entry-in-one-statement.md)) returns
the same response with or without it, so the migration and the Worker deployment can happen
in either order. Until the index exists, entries that have a biblical entity spend a few
more milliseconds in PostgreSQL. No publication is imported again and nothing is backfilled.

### Resource API edge cache

The Worker uses Cloudflare's Cache API for successful deterministic database reads after App Check
authorization. Detail, chapter, coverage, and other revisioned responses are cached for 30 days;
search responses are cached for 24 hours, and bounded browse/list responses are cached for one
hour. Random endpoints, non-GET requests, unknown future routes, and every non-200 response bypass
the cache. Cache failures fail open to Neon and are emitted as structured Worker errors.

A route is cached only when `src/runtime/resourceApiCache.ts` lists its path: add a new read route
to `LONG_LIVED_PATHS` or `SHORT_LIVED_PATHS` when it is created, and check `x-resource-cache` on its
second read.

The App Check token and request ID are excluded from cache keys and stored responses. Every client
response remains `private, no-store`; `x-resource-cache: MISS`, `HIT` or `STALE` exposes the Worker
cache result without allowing an intermediary to serve protected data before attestation.
Conditional requests keep their ETag/304 behavior for an answer of the deployed version. A SHA-256
fingerprint of the complete generated mobile
catalog is part of every internal cache key, so publishing and deploying changed catalog content
starts a fresh cache namespace without a global purge, even when `--generated-at` is pinned.
The version of the deployed Worker (`CF_VERSION_METADATA`) is part of the key too: a deployment
that changes how a route answers never serves as its own what an older version cached. This is
what makes the 30-day lifetime safe. A deployment therefore starts with nothing under its own
key, and answers from the fallback described below while it reads again. A publication
activated in Neon without deploying the Worker stays unseen by cached routes for up to 30 days:
always deploy after activating.
Search keys additionally include the thematic-index, embedding model/contract/threshold, and ranking
revisions from `src/search/bibleSearchRevision.ts`. Bump the explicit index revision after a thematic
import and the ranking revision after changing result fusion or ordering; deploying then creates a
fresh 24-hour search namespace immediately.

#### Fallback across deployments

A read that is stored is stored twice, for the same time: under the key of the Worker version
that read it, and under a fallback key that carries no Worker version, only the content revision
and `RESOURCE_API_ANSWER_REVISION`
([ADR-0076](../../docs/adr/0076-answer-a-new-worker-version-from-the-cache-of-the-one-before.md)).
Searches are stored once: they have no fallback.

A cached answer is read as before, with one cache lookup. When the deployed version has not
stored a URL yet, the Worker looks for the fallback:

- it is there: the caller is answered with it at once, marked `x-resource-cache: STALE`, and the
  Worker reads the database after the answer (`waitUntil`), then stores what it read under both
  keys. The next read of that URL is a `HIT` of the deployed version;
- it is not there: the database is read as before (`MISS`).

A `STALE` answer is what an earlier version stored for the same content. It is always sent whole,
with status 200, even to a caller whose `If-None-Match` matches: only an answer of the deployed
version says 304.

The refresh is a read of the database, counted against the 1,000 a minute of the caller that
caused it. A caller over that limit is still answered `STALE`, and nothing is read for it. One
refresh runs at a time for a URL: the callers that arrive meanwhile are answered `STALE` and read
nothing. That holds within an isolate, and nearly so across the isolates of a data center, which
tell each other through a 30-second cache entry. A refresh that stored nothing (refused, failed,
or not a 200) is not tried again for those 30 seconds, and leaves the fallback as it was.

**Bump `RESOURCE_API_ANSWER_REVISION`** (`src/runtime/resourceApiCache.ts`) in the deployment that
changes what a cached route answers for the same content: a field added, removed, renamed or
corrected, another order, another rule. That deployment then finds no fallback and starts as
deployments did before, each first read waiting for the database. Do not bump it for a deployment
that changes no answer: start-up, logs, limits, a new route, performance. A change to one of the
routes that has a response revision of its own in `resourceApiCacheRevisionFrom` (a Strong entry,
a batch of them, the list of every identity, dictionary passage discovery) can bump that revision
instead: it is part of both keys, and only that route starts cold.

Forgetting the bump does not hide the new answer for thirty days, as a key without the Worker
version did. It costs one answer of the earlier version for each URL in each data center, to
whoever reads it first after the deployment, and to the callers of the few hundred milliseconds
the refresh takes. A caller that keeps what it reads keeps that answer for as long as it keeps
anything: the public site for one minute (it marks such a page `X-Page-Stale: 1`), the
applications, which do not read the mark, for as long as they keep an Online answer, a session
for a chapter. A URL nobody reads keeps its fallback until someone does, for
thirty days at most (one hour for a list), so the earlier version may be several deployments old.

To check the fallback after a deployment, read twice a URL that was read before it, then a URL
nobody has read:

```bash
curl -sD - -o /dev/null https://api.bible-strong.app/v1/bibles/LSG/books/1/chapters/1 | grep -i x-resource-cache
# x-resource-cache: STALE   the first read after the deployment, in this data center
curl -sD - -o /dev/null https://api.bible-strong.app/v1/bibles/LSG/books/1/chapters/1 | grep -i x-resource-cache
# x-resource-cache: HIT     a second later: the deployed version has read and stored it
curl -sD - -o /dev/null 'https://api.bible-strong.app/v1/bibles/LSG/search?q=grace' | grep -i x-resource-cache
# x-resource-cache: MISS    a search has no fallback
```

`MISS` on the first line means no fallback was there: the URL was not read in this data center
since the last bump, the answer revision was bumped by this deployment, or the content revision
changed. `STALE` on the second line means the refresh stored nothing: `wrangler tail` shows a
`resource API fallback refresh` line for each refresh, with `stored`, `limited`, the status, and
the statements and time it took. The request that was answered `STALE` logs `cache: "STALE"` and
`originRead: false`.

The first deployment that carries the fallback finds none, and starts cold like the ones before
it: the fallback is written from then on.

This cache is local to each Cloudflare data center, and Cloudflare may evict an entry before its
time: a fallback is there most of the time, not always. Complete successful R2 artifacts are also cached
for one year after App Check succeeds. Their stable legacy objects are never overwritten and their
current URLs select immutable SHA-addressed objects, so the long TTL cannot cross publication
revisions. A cached complete ZIP can satisfy later `Range`, conditional GET, and `HEAD` requests
without reopening R2. A range request that misses the cache streams only the requested bytes from
R2 and is not cached because Cloudflare rejects `206 Partial Content` in `cache.put()`. Artifact
responses sent to the application remain `private, no-store`, and cache failures fall back to R2.

### Encrypted Offline copies

Encrypted Offline copies ([ADR-0065](../../docs/adr/0065-protect-resources-without-mandatory-attestation.md))
are AES-256 ZIP re-encodings of the plain archives, published by an operator command after the
plain publication:

```bash
yarn resources:offline:encrypt:prod --dry-run --resource bible:LSG
yarn resources:offline:encrypt:prod
```

The command reads `BIBLE_STRONG_ARCHIVE_KEYS` from `.env.resource-publication.local`, the same value
as `apps/expo/.env.local`, and encrypts with the latest key version. For each catalog resource it
looks up the private R2 index `encrypted-archives/v<key version>/<plain sha256>.json`. Without an
index entry it reads the plain archive from R2, derives the per-archive password, encrypts, decrypts
again to verify every entry against the plain content, uploads the copy under
`revisions/<encrypted sha256>/<file>.encrypted.zip`, and writes the index last. It then records
`encryptedArchive` in the checked-in catalog, keeping `generatedAt`.

Catalog regeneration drops `encryptedArchive`. Run the command again after every publication: it
restores the fields from the index without re-encrypting unchanged archives, so encrypted objects
stay stable. `--dry-run` only reads R2 and never writes the catalog. Deploy the Worker afterwards so
it serves the updated catalog.

### Resource API rate limits

Online reading and search are public ([ADR-0065](../../docs/adr/0065-protect-resources-without-mandatory-attestation.md)):
the Worker ignores any App Check token they carry and counts them per client address
(`CF-Connecting-IP`).

Online reads have two limits. Every read counts against `READING_RATE_LIMITER`, 20,000 per minute
per address, before the cache: it bounds what one address can ask of the Worker, whatever the
cache answers. A read the edge cache did not answer then counts against
`ORIGIN_READING_RATE_LIMITER`, 1,000 per minute per address, just before Hyperdrive is opened:
this is the limit that protects the database, and a read answered from the cache
(`x-resource-cache: HIT`) never counts against it. A read answered from the fallback
(`x-resource-cache: STALE`) is not refused either, but the refresh it causes is a read of the
database and counts: over the limit the caller keeps its answer and nothing is refreshed. The
public site renders one page with about
thirteen reads from a single server address, most of them cached; counted together, they held
the whole site to about 75 pages a minute. A page that was never rendered still spends its
uncached reads against the 1,000.

Dynamic search and random routes allow 300 requests per minute per address, and semantic search,
which calls Workers AI, allows 60. Both are counted before any cache, Hyperdrive, or AI access,
cached answers included: a search is keyed by what its caller typed, so the cache answers few of
them, and nothing reads search from a server on behalf of many readers. Encrypted Offline copies
under `/v1/offline-archives/` are public too and allow 240 requests per minute per address,
including byte ranges; each delivery logs its size with a hashed client address. Limits are
generous because many readers share carrier NAT addresses.

Offline-copy artifact requests still require a native App Check attestation (ADR-0063). After it
succeeds, the Worker fingerprints the short-lived token with SHA-256 and applies a counter of 120
requests per minute, including byte ranges. The raw token is never used as a counter key or written
to logs. A rejected request returns `429`, `Retry-After: 60`, and `private, no-store`, whichever
counter rejected it; the origin is not opened and the refusal is never cached. Counter failures
fail open and emit a structured error so a Cloudflare limiter incident does not make resources
unavailable.

`/v1/offline-catalog` remains public and outside the application counters because it is a small
shared CDN-cached manifest with no trustworthy per-client identity. Cloudflare's network-level DDoS
protection remains its coarse abuse boundary. Worker counters are intentionally approximate and
local to each Cloudflare location; they protect service capacity rather than providing billing or
globally exact quotas.

The local Effect HttpApi exposes Bible reading, Strong Bible indexes, BHG interlinear indexes, and
the Nave operations consumed by the app:

- `GET /v1/bibles/:version/books/:book/chapters/:chapter`
- `GET /v1/bibles/:version/verses?references=1-1-1,1-1-2,19-10-3`
- `GET /v1/bibles/:version/coverage`
- `GET /v1/bibles/:version/pericopes`
- `GET /v1/strong-bibles/:version/coverage`
- `GET /v1/strong-bibles/:version/books/:book/chapters/:chapter`
- `GET /v1/strong-bibles/:version/books/:book/identities/:reference/counts`
- `GET /v1/strong-bibles/:version/books/:book/identities/batch/counts?references=H2148A,H2148B`
- `GET /v1/strong-bibles/:version/books/:book/identities/:reference/occurrences`
- `GET /v1/strong-bibles/:version/books/:book/identities/:reference/lemmas`
- `GET /v1/interlinear-bibles/BHG/languages/:language/coverage`
- `GET /v1/interlinear-bibles/BHG/languages/:language/books/:book/chapters/:chapter`
- `GET /v1/naves/:language/topics/:normalizedName`
- `GET /v1/naves/:language/topics?initial=:initial`
- `GET /v1/naves/:language/topics?search=:search`
- `GET /v1/naves/:language/verses/:verseKey/topics`
- `GET /v1/naves/:language/random`

The coverage of a Bible counts the verse rows of each chapter in `verseCountByBookChapter`
and gives, in `verseNumbersByBookChapter`, the ascending numbers of the verses that have text
for the chapters where they are not exactly 1 to that count: a skipped number, verses
translated as one, a verse kept without text, a title numbered 0. A client numbers the other
chapters from 1 to their count. A Bible without such a chapter has an empty object
([ADR-0071](../../docs/adr/0071-publish-the-verse-numbers-of-irregular-chapters.md)).

`GET /v1/commentaries/verses/:verseKey/sections?language=fr&commentaries=acbc,barnes,MHY`
answers, for one verse (`book-chapter-verse`) and up to ten commentaries of a language named
by their publication, the section of each that bears most closely on the verse: its slug,
its verse range and its content, in the order asked, in one read of the database. A
commentary that does not comment the verse is left out; one without an active publication
is named in `unavailable`. The sections are those of the chapter page of the public site,
built and chosen by `@bible-strong/resource-domain/commentary-chapter-sections`
([ADR-0073](../../docs/adr/0073-read-the-commentary-sections-of-a-verse-in-one-read.md)).

A simple Strong entry and the entry cards of a batch are read in one statement, like a
detailed entry; the concordance reads of a Strong Bible resolve their publication and their
identity in one statement
([ADR-0072](../../docs/adr/0072-read-strong-entry-cards-in-one-statement.md)).

`GET /v1/strong-lexicon/numbers/:number/senses?language=fr` answers the senses the simple
lexicon of a language files under a classical number (`H2148`, without a sense suffix), each
with its row of that lexicon and what its entry in the detailed lexicon tells it apart by:
`detailedDefinitionHtml`, its notice, and `entityBrief`, who its person or its place is. A
number the lexicon does not hold has no sense.
`GET /v1/strong-bibles/:version/books/:book/identities/batch/counts?references=…` answers, for
up to a hundred references, what the counts read of each answers: its identity and its verses
by book, in the order asked, and nothing for a reference the index does not hold. Each is one
statement, and the Worker keeps both like the other revisioned reads: the first under the
revisions of the simple lexicon of its language, the detailed lexicon and its entities, the
second under the revision of its Strong Bible index
([ADR-0074](../../docs/adr/0074-read-the-senses-of-a-strong-number-in-two-reads.md)).

Both `nave:fr` (`NAVE_FR`) and `nave:en` (`NAVE_EN`) are remotely readable in this tracer. All 12 cataloged Strong Bible versions are remotely
readable when their validated index publication and the exact declared Bible text revision and
SHA-256 are active. An active index with a missing or mismatched Bible publication is deliberately
unavailable. Both cataloged BHG interlinear languages are remotely readable under the same exact
base-text dependency rule; a valid installed V5 sidecar remains preferred.

## Verification

```bash
yarn resources:test
yarn resources:test:integration
yarn resources:test:lsg
yarn resources:test:strong
RESOURCE_BHG_BUNDLE_ROOT=/absolute/path/to/bhg \
RESOURCE_INTERLINEAR_BUNDLES_ROOT=/absolute/path \
yarn resources:test:interlinear
yarn resources:architecture:check
```

`resources:test:lsg` compares all 66 books, 1,189 chapters, 31,171 verses, and every presentation
value in the complete local LSG bundle with the active PostgreSQL publication.

`resources:test:strong` reads `RESOURCE_STRONG_BIBLE_BUNDLES_ROOT`, requires exactly the 12 mobile
catalog identities, validates canonical/archive parity, imports each domain atomically, and queries
chapter coverage and spans. The suite is skipped when the external Maker handoff path is absent.

The complete Strong lexicon test reads `RESOURCE_STRONG_LEXICON_BUNDLES_ROOT`. With
`RESOURCE_SIMPLE_STRONG_BUNDLES_ROOT` set as well, it also reads the senses of every classical
number the simple lexicons split, in both languages, and compares the single statement with
the reads of a page. The complete Strong Bible test compares the counts of several
references with the counts of each, for every twentieth identity of each index.

`resources:test:interlinear` reads the prerequisite BHG publication from
`RESOURCE_BHG_BUNDLE_ROOT` and its two index bundles from `RESOURCE_INTERLINEAR_BUNDLES_ROOT`, requires exactly the French
and English catalog identities, checks their declared catalog metadata and complete
canonical/archive parity, imports both, and queries chapter coverage and aligned token content. The
suite is skipped when the external Maker handoff path is absent.

## Mobile development URL

Set `EXPO_PUBLIC_RESOURCE_API_URL` before starting Expo when the development defaults below do not
match the target. The value is copied into Expo runtime configuration.

| Target | Example |
| --- | --- |
| Host / web | `http://localhost:8787` |
| iOS Simulator | `http://127.0.0.1:8787` |
| Android Emulator | `http://10.0.2.2:8787` |
| Physical device | `http://<development-machine-LAN-IP>:8787` |

When no URL is configured, development builds use the iOS Simulator or Android Emulator default
shown above. Web, production builds, and physical devices require an explicit URL; without one the
HTTP source reports `resource-unsupported`. Installed Offline copies continue to work in every case.
A valid installed copy always wins over HTTP, regardless of remote revision.

## Local Offline-copy download smoke

The validated publication bundle can also supply its immutable ZIP to a development build, so a
download/install/remove smoke never depends on the production CDN:

```bash
RESOURCE_PUBLICATION_BUNDLE=resource-service/.local/publications/lsg \
  yarn resources:serve:artifacts
```

Start Expo with the matching development artifact base URL. The catalog path and declared checksums
stay unchanged; only the R2 delivery origin is replaced by the validated local artifact server.

| Target | `EXPO_PUBLIC_RESOURCE_ARTIFACT_BASE_URL` |
| --- | --- |
| iOS Simulator | `http://127.0.0.1:8788` |
| Android Emulator | `http://10.0.2.2:8788` |
| Physical device | `http://<development-machine-LAN-IP>:8788` |

Production uses the Worker base URL declared in its environment. The local server validates the
explicit bundle before it starts and returns standard HTTP metadata; the app verifies the catalog
SHA-256 through the normal atomic installation flow.
Bible and interlinear artifacts are served below `/bibles/`; Nave is served at the existing mobile
catalog paths `/databases/nave-fr.sqlite.zip` and `/databases/en/nave.sqlite.zip`.
