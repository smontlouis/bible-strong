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
an explicit immutable ZIP artifact produced by Bible Lexicon Maker. Assemble it with the distribution
rights and canonical metadata that apply to that publication:

```bash
yarn resources:bundle \
  --artifact /absolute/path/to/bible-lsg.json.zip \
  --entry bible-lsg.json \
  --output resource-service/.local/publications/lsg \
  --language fr \
  --canon protestant-66 \
  --versification kjv \
  --rights-holder "Public domain" \
  --rights-terms "Louis Segond 1910 public-domain text" \
  --attribution "Louis Segond 1910" \
  --rights-online true \
  --rights-offline true \
  --online-access true \
  --offline-download true
```

The resulting schema-v1 bundle represents exactly one `bible-text` identity and immutable revision.
It contains:

- `manifest.json`, with identity, language, revision, provenance, independent delivery capabilities,
  rights, ordered canon, declared chapter/verse coverage, versification, counts, format versions,
  sizes, and SHA-256 checksums;
- `canonical/*.json`, used by the PostgreSQL importer;
- `offline/*.zip`, the byte-identical Offline-copy artifact delivered to the app.

Validation checks the manifest version, safe paths, both files, archive entry, hashes, identity,
source revision, counts, and delivery rights:

```bash
yarn resources:bundle:validate --bundle resource-service/.local/publications/lsg
```

Import and activation are one Kysely transaction wrapped at the Effect repository boundary:

```bash
yarn resources:db:up
yarn resources:migrate
yarn resources:import --bundle resource-service/.local/publications/lsg
```

Reimporting the same revision and checksums returns `unchanged`. Reusing a revision with different
content fails. Validation failures or Effect interruption roll back staging and preserve the prior
active publication.

The local Effect HttpApi exposes both chapter content and source-independent navigation coverage:

- `GET /v1/bibles/:version/books/:book/chapters/:chapter`
- `GET /v1/bibles/:version/coverage`

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
