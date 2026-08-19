# Validation

Use these checks before finishing code changes. Prefer the smallest relevant set for the files touched, then broaden when changing shared state, navigation, storage, Firebase sync, or app startup.

## Setup

```bash
corepack enable
yarn install
```

Copy `.env.example` to the appropriate local environment file and fill required values. Real `.env*` files are environment-specific and may contain secret-like values.

## Canonical Local Checks

| Task | Command | When to run |
|---|---|---|
| Unit tests | `yarn test` | Reducers, helpers, business logic, or shared state changes |
| Lint | `yarn lint` | Most code changes |
| Typecheck | `yarn typecheck` | TypeScript, navigation params, Redux, Jotai, or helper changes |
| Format check | `yarn format:check` | Before finishing docs/code formatting-sensitive changes |
| Agent architecture | `yarn agents:architecture:check` | Feature boundary, helper, SQLite, Firebase, logging, or shared architecture changes |
| Primitive styling guard | `yarn agents:styles:check` | UI or component changes; rejects new feature-level `styled` usage |
| Agent domain quality | `yarn agents:quality:check` | Feature/domain changes, PR readiness, or harness changes |
| i18n extraction | `yarn i18n` | User-facing string additions or translation key changes |
| Resource architecture | `yarn resources:architecture:check` | Resource domain, service, runtime, or UI access changes |
| Resource unit tests | `yarn resources:test` | Bundle, importer, API, repository, or runtime changes |
| Expo Web export | `yarn web:export` | Web runtime, routing, platform adapters, or browser dependencies |
| Resource Postgres integration | `yarn resources:test:integration` | Schema, migrations, importer, or persistence changes |
| Complete LSG parity | `yarn resources:test:lsg` | Publication, API response, or Bible presentation changes |
| Complete Strong Bible parity | `RESOURCE_STRONG_BIBLE_BUNDLES_ROOT=/absolute/path yarn resources:test:strong` | Strong publication, importer, API, or sidecar changes |
| Complete BHG interlinear parity | `RESOURCE_BHG_BUNDLE_ROOT=/absolute/path/to/bhg RESOURCE_INTERLINEAR_BUNDLES_ROOT=/absolute/path yarn resources:test:interlinear` | Interlinear publication, importer, API, or sidecar changes |
| Complete Strong lexicon parity | `RESOURCE_STRONG_LEXICON_BUNDLES_ROOT=/absolute/path yarn resources:test:lexicon` | Strong lexicon publication, importer, API, module, or Offline-copy changes |

`yarn agents:architecture:check` regenerates `docs/agents/architecture-lint.md` and `.scratch/architecture/architecture.json`, then fails on high-risk boundary errors. Warnings are intentionally non-blocking for the current brownfield baseline.

`yarn agents:quality:check` regenerates `docs/agents/quality-score.md` and `.scratch/quality/quality.json`, then fails if a feature domain drops below the conservative readiness threshold.

`yarn agents:styles:check` compares tracked and untracked TypeScript files with the versioned brownfield baseline in `scripts/agents-style-baseline.json`. Existing Emotion usage is tolerated, but increasing it or adding it to another feature file fails consistently in local clones and CI. Shared primitive implementations under `src/common/ui/` are the normal exception; a rare feature-level exception must include `// harness-allow-styled: <reason>`.

When a legacy `styled` wrapper is removed, lower its baseline count in the same change. Do not raise the baseline to make a failing check pass; use primitives or document a genuine exception instead.

If Jest fails before running tests because Watchman is unavailable in a sandboxed/local agent environment, rerun with:

```bash
yarn test --watchman=false
```

## Simulator Preview

Use Argent to inspect and control a booted iOS Simulator or Android emulator. Common workflow:

1. Connect to the target simulator/emulator with Argent.
2. Inspect the screen before interacting.
3. Use Argent interactions to tap, type, swipe, and capture screenshots.
4. Stop Argent simulator servers when finished.

## Development Server

```bash
yarn start
```

This starts Expo with a custom development client. The app is not expected to run in Expo Go.

For the local production-shaped resource stack:

```bash
yarn resources:db:up
yarn resources:migrate
RESOURCE_PUBLICATION_BUNDLES_ROOT=/absolute/path/to/publications yarn resources:dev
RESOURCE_PUBLICATION_BUNDLES_ROOT=/absolute/path/to/publications yarn resources:serve:artifacts
```

The development client defaults to `http://127.0.0.1:8787` on iOS and `http://10.0.2.2:8787` on Android when `EXPO_PUBLIC_RESOURCE_API_URL` is not configured. These defaults are development-only.

For the online-only Web runtime, set `EXPO_PUBLIC_RESOURCE_API_URL` explicitly and start Expo with:

```bash
yarn web
```

The resource service must allow the browser origin through `RESOURCE_WEB_ORIGINS`. Validate a
production-shaped SPA bundle with `yarn web:export`; the deployment host must fall back to
`index.html` for Expo Router paths.

Offline-copy archives continue to use the catalog CDN independently of the API origin. Set
`EXPO_PUBLIC_RESOURCE_ARTIFACT_BASE_URL` explicitly only when testing a local artifact server. The
artifact server validates and serves every immediate child bundle in
`RESOURCE_PUBLICATION_BUNDLES_ROOT`.

For a non-UI Strong lexicon smoke against a complete local stack:

```bash
RESOURCE_STRONG_LEXICON_BUNDLES_ROOT=/absolute/path/to/strong-lexicon-publications yarn resources:test:lexicon
```

This exercises bundle validation, atomic PostgreSQL activation, typed repository/API reads,
module dependency states, and the generated Offline-copy archives. Mobile UI/E2E execution is
left to the product-level smoke owner.

In this environment, `yarn start` under Node 22 failed before Metro bound a port with:

```text
RangeError [ERR_SOCKET_BAD_PORT]: options.port should be >= 0 and < 65536. Received type number (65536).
```

The working local command used for smoke validation was:

```bash
npx -y -p node@20 node /Users/stephane/.cache/node/corepack/v1/yarn/4.12.0/yarn.js start --port 8081
```

Prefer a local Node 20/18 runtime for Expo development until this compatibility issue is resolved.

## Device And Simulator Runs

```bash
yarn ios
yarn android
```

These commands require local platform tooling and a custom development client. For iOS simulator development builds, the repo also exposes:

```bash
yarn build:ios:dev-sim
```

## Build Checks

Build commands use EAS local builds and can be slow. Run only when the change affects native config, Expo plugins, build profiles, Firebase service files, app identity, updates, audio background modes, or release behavior.

```bash
yarn build:android:dev
yarn build:android:staging
yarn build:android:prod
yarn build:android:prod:apk
yarn build:ios:dev
yarn build:ios:dev-sim
yarn build:ios:staging
yarn build:ios:prod
```

## UI Validation Notes

Argent is the preferred simulator tooling and should be verified against the target booted simulator before runtime validation. The existing `builds/biblestrong.dev.app` was installed and launched with bundle id `com.smontlouis.biblestrong.dev`.

No root `ios/` or `android/` project is checked in, so lower-level native simulator tools cannot be assumed to work without Expo prebuild/dev-client setup.
