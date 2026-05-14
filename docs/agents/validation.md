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
| Agent domain quality | `yarn agents:quality:check` | Feature/domain changes, PR readiness, or harness changes |
| i18n extraction | `yarn i18n` | User-facing string additions or translation key changes |

`yarn agents:architecture:check` regenerates `docs/agents/architecture-lint.md` and `.scratch/architecture/architecture.json`, then fails on high-risk boundary errors. Warnings are intentionally non-blocking for the current brownfield baseline.

`yarn agents:quality:check` regenerates `docs/agents/quality-score.md` and `.scratch/quality/quality.json`, then fails if a feature domain drops below the conservative readiness threshold.

If Jest fails before running tests because Watchman is unavailable in a sandboxed/local agent environment, rerun with:

```bash
yarn test --watchman=false
```

## Simulator Preview

```bash
yarn serve-sim
```

Use `serve-sim` to stream and control a booted iOS Simulator from the browser or CLI. Common commands:

```bash
yarn serve-sim --detach --quiet
yarn serve-sim --list
yarn serve-sim tap <x> <y>
yarn serve-sim --kill
```

## Development Server

```bash
yarn start
```

This starts Expo with a custom development client. The app is not expected to run in Expo Go.

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

`serve-sim` is installed and has been verified against a booted iPhone 17 simulator. The existing `builds/biblestrong.dev.app` was installed and launched with bundle id `com.smontlouis.biblestrong.dev`.

No root `ios/` or `android/` project is checked in, so lower-level native simulator tools cannot be assumed to work without Expo prebuild/dev-client setup.
