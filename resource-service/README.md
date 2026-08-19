# Resource service (local phase)

This directory contains the production-shaped Resource API while it is developed locally. It does
not provision Neon, Cloudflare, R2, or any other hosted infrastructure.

## Start the local database and API

```bash
yarn resources:dev
```

The command starts persistent PostgreSQL, applies reviewed Drizzle Kit migrations, and serves the
Effect HttpApi application. It never resets the database. Use `yarn resources:db:reset` only when an
explicit destructive reset is intended.

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

## Bible Lexicon Maker handoff

Bible Strong never scans or reads a neighboring Bible Lexicon Maker checkout. The handoff input is
an explicit immutable publication bundle produced and validated by Bible Lexicon Maker. Copy or
mount that bundle at a path selected explicitly for local validation or import; Bible Strong does
not generate its manifest, editorial metadata, or Offline-copy artifact:

```bash
yarn resources:bundle:validate --bundle /absolute/path/to/bible-lexicon-maker/lsg-bundle
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

Reimporting the same revision and checksums returns `unchanged`. Reusing a revision with different
content fails. Validation failures or Effect interruption roll back staging and preserve the prior
active publication.

The local Effect HttpApi exposes Bible reading, Strong Bible indexes, BHG interlinear indexes, and
the Nave operations consumed by the app:

- `GET /v1/bibles/:version/books/:book/chapters/:chapter`
- `GET /v1/bibles/:version/verses?references=1-1-1,1-1-2,19-10-3`
- `GET /v1/bibles/:version/coverage`
- `GET /v1/bibles/:version/pericopes`
- `GET /v1/strong-bibles/:version/coverage`
- `GET /v1/strong-bibles/:version/books/:book/chapters/:chapter`
- `GET /v1/strong-bibles/:version/books/:book/identities/:reference/counts`
- `GET /v1/strong-bibles/:version/books/:book/identities/:reference/occurrences`
- `GET /v1/strong-bibles/:version/books/:book/identities/:reference/lemmas`
- `GET /v1/interlinear-bibles/BHG/languages/:language/coverage`
- `GET /v1/interlinear-bibles/BHG/languages/:language/books/:book/chapters/:chapter`
- `GET /v1/naves/:language/topics/:normalizedName`
- `GET /v1/naves/:language/topics?initial=:initial`
- `GET /v1/naves/:language/topics?search=:search`
- `GET /v1/naves/:language/verses/:verseKey/topics`
- `GET /v1/naves/:language/random`

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

Start Expo with the matching development-only base URL. This override is explicit: using the local
API alone keeps Offline-copy downloads on the catalog CDN. The catalog path and declared checksums
stay unchanged; only the origin is replaced.

| Target | `EXPO_PUBLIC_RESOURCE_ARTIFACT_BASE_URL` |
| --- | --- |
| iOS Simulator | `http://127.0.0.1:8788` |
| Android Emulator | `http://10.0.2.2:8788` |
| Physical device | `http://<development-machine-LAN-IP>:8788` |

Production builds ignore this override. The local server validates the explicit bundle before it
starts and returns generation plus checksum headers used by the normal atomic installation flow.
Bible and interlinear artifacts are served below `/bibles/`; Nave is served at the existing mobile
catalog paths `/databases/nave-fr.sqlite.zip` and `/databases/en/nave.sqlite.zip`.
