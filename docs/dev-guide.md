# Development Guide

## Setup

Run installation from the repository root:

```bash
corepack enable
yarn install
```

The repository uses Yarn 4, one root `yarn.lock`, and workspace dependencies. Hoisting stops at workspace boundaries so applications with different React and framework versions retain isolated dependency trees. Do not run another package manager inside an app or commit a subproject lockfile.

## Start a workspace

```bash
yarn dev:mobile
yarn dev:web
yarn dev:api
yarn dev:studio
yarn dev:resources
```

Run any app-specific command by package name, for example:

```bash
yarn workspace @bible-strong/mobile ios
yarn workspace @bible-strong/mobile android
yarn workspace @bible-strong/api-functions build
yarn workspace @bible-strong/resource-service test
yarn workspace @bible-strong/resource-studio commentaries:validate
```

The mobile app uses a custom Expo development client and is not expected to run in Expo Go.

## Expo Web runtime in the mobile workspace

The Expo Web runtime is intentionally online-only. Bible content, search, concordance,
dictionaries, timeline, commentaries, and interlinear data are read through the Resource HTTP API.
It does not run onboarding, SQLite migrations, local resource downloads, backup/import-export
flows, or native context menus. Browser storage is limited to app preferences and user state.

Configure the Resource API and Firebase Web app from `apps/mobile/.env.example`, then start Expo:

```bash
EXPO_PUBLIC_RESOURCE_API_URL="http://127.0.0.1:8787" yarn workspace @bible-strong/mobile web
```

The Resource service must allow the browser origin through `RESOURCE_WEB_ORIGINS`, a
comma-separated exact allowlist. Create the production SPA bundle with:

```bash
yarn workspace @bible-strong/mobile web:export
```

The deployment host must send unknown Expo Router routes to `index.html`. This runtime is distinct
from the dedicated TanStack Start application under `apps/web`.

## Validation

Root commands run the applicable validation scripts across the relevant workspaces:

```bash
yarn typecheck
yarn lint
yarn test
yarn build
yarn format:check
```

For a focused change, validate the affected workspaces. For dependency, lockfile, patch, shared-package, or workspace configuration changes, run root-wide checks. The detailed matrix is in `agents/validation.md`.

## Environment files

Environment files belong to the application that consumes them. Mobile development, staging, and production files live under `apps/mobile/`; other apps document their own environment contracts in their README files.

```bash
cp apps/mobile/.env.example apps/mobile/.env.development
```

Do not commit secrets. Mobile variables used by client code must use the `EXPO_PUBLIC_*` prefix. Treat Firebase files, bundle identifiers, package names, and EAS profiles as sensitive.

## Yarn patches

All patches live in root `.yarn/patches/` and are resolved from workspace manifests or root `resolutions`. When changing a patched dependency:

1. Run the Yarn patch workflow from the root (`yarn patch` and `yarn patch-commit`).
2. Update the applicable manifest resolution and patch reference.
3. Commit the patch file and `yarn.lock` together.
4. Verify with `yarn install --immutable` and the affected workspace checks.

Never replace a `patch:` dependency with a plain version merely to make workspace installation succeed.

## Mobile development notes

Mobile import aliases (`~assets`, `~common`, `~features`, `~helpers`, `~redux`, and related aliases) are configured inside `apps/mobile/`. Playground mode is enabled with `EXPO_PUBLIC_PLAYGROUND=true` in the mobile environment and requires restarting Metro.

Prefer Node 20 or 18 for Expo development if the local Node version triggers Metro/free-port incompatibilities. Build commands remain workspace scripts, for example `yarn workspace @bible-strong/mobile build:ios:dev`.
