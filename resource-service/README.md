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

## Bible Lexicon Maker handoff

Bible Strong never scans or reads a neighboring Bible Lexicon Maker checkout. The handoff input is
an explicit immutable publication bundle produced and validated by Bible Lexicon Maker. Copy or
mount that bundle at a path selected explicitly for local validation or import; Bible Strong does
not generate its manifest, editorial metadata, or Offline-copy artifact:

```bash
yarn resources:bundle:validate --bundle /absolute/path/to/bible-lexicon-maker/lsg-bundle
```

The accepted schema-v1 bundle represents exactly one `bible-text` or `nave` identity and immutable
revision.
It contains:

- `manifest.json`, with identity, language, revision, provenance, independent delivery capabilities,
  rights, domain coverage, counts, format versions, sizes, and SHA-256 checksums;
- `canonical/*.json`, used by the PostgreSQL importer;
- `offline/*.zip`, the matching Offline-copy artifact delivered to the app. Bible bundles contain
  the canonical JSON; Nave bundles contain the generated SQLite database used by existing mobile
  surfaces.

The NAVE_FR archive entry is `nave-fr.sqlite`. In addition to the existing `TOPICS` and `VERSES`
tables, publication copies contain one `RESOURCE_METADATA` row with `resource_id`, `revision`,
`source_version`, and `source_sha256`. Validation opens the database and compares every topic,
description, verse/chapter anchor, durable identity, and metadata value with canonical JSON before
activation.

The Resource service independently validates the supported handoff contract: manifest version, safe
paths, both files, archive entry, hashes, identity, source revision, counts, and delivery rights:

```bash
yarn resources:bundle:validate --bundle resource-service/.local/publications/lsg
yarn resources:bundle:validate --bundle resource-service/.local/publications/nave-fr
```

Import and activation are one Kysely transaction wrapped at the Effect repository boundary:

```bash
yarn resources:db:up
yarn resources:migrate
yarn resources:import --bundle resource-service/.local/publications/lsg
yarn resources:import --bundle resource-service/.local/publications/nave-fr
```

Reimporting the same revision and checksums returns `unchanged`. Reusing a revision with different
content fails. Validation failures or Effect interruption roll back staging and preserve the prior
active publication.

The local Effect HttpApi exposes Bible reading plus the Nave operations consumed by the app:

- `GET /v1/bibles/:version/books/:book/chapters/:chapter`
- `GET /v1/bibles/:version/coverage`
- `GET /v1/naves/:language/topics/:normalizedName`
- `GET /v1/naves/:language/topics?initial=:initial`
- `GET /v1/naves/:language/topics?search=:search`
- `GET /v1/naves/:language/verses/:verseKey/topics`
- `GET /v1/naves/:language/random`

Only `nave:fr` (`NAVE_FR`) is remotely readable in this tracer. English Nave remains available
through its existing optional Offline copy.

## Verification

```bash
yarn resources:test
yarn resources:test:integration
yarn resources:test:lsg
yarn resources:architecture:check
```

`resources:test:lsg` compares all 66 books, 1,189 chapters, 31,171 verses, and every presentation
value in the complete local LSG bundle with the active PostgreSQL publication.

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

Start Expo with the matching development-only base URL. The catalog path and declared checksums stay
unchanged; only the origin is replaced.

| Target | `EXPO_PUBLIC_RESOURCE_ARTIFACT_BASE_URL` |
| --- | --- |
| iOS Simulator | `http://127.0.0.1:8788` |
| Android Emulator | `http://10.0.2.2:8788` |
| Physical device | `http://<development-machine-LAN-IP>:8788` |

Production builds ignore this override. The local server validates the explicit bundle before it
starts and returns generation plus checksum headers used by the normal atomic installation flow.
Bible artifacts are served below `/bibles/`; NAVE_FR is served at the existing mobile catalog path
`/databases/nave-fr.sqlite.zip`.
