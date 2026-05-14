# Development Guide

## Setup

```bash
corepack enable
yarn install
```

Copy `.env.example` to the environment file you need and fill real values locally. Do not commit secrets.

```bash
cp .env.example .env.development
```

## Daily Commands

```bash
yarn start
yarn ios
yarn android
```

The app uses a custom Expo development client. It is not expected to run in Expo Go.

## Validation Commands

```bash
yarn typecheck
yarn test
yarn lint
yarn format:check
```

Use `docs/agents/validation.md` for the current canonical validation matrix.

## Simulator Smoke

`serve-sim` is installed as a dev dependency.

```bash
yarn serve-sim --detach --quiet
yarn serve-sim --list
yarn serve-sim tap <x> <y>
yarn serve-sim --kill
```

The last Level 1 smoke used the existing `builds/biblestrong.dev.app` dev client on an iPhone 17 simulator, launched bundle id `com.smontlouis.biblestrong.dev`, and streamed at `http://127.0.0.1:3101`.

In this environment, `yarn start` under Node 22 failed before Metro bound a port with a `freeport-async` bad-port error. The working command was:

```bash
npx -y -p node@20 node /Users/stephane/.cache/node/corepack/v1/yarn/4.12.0/yarn.js start --port 8081
```

Prefer Node 20 or 18 for Expo development until the compatibility issue is resolved.

## Build Commands

Run build commands only when native config, Expo plugins, Firebase service files, identity, background modes, EAS profiles, or release behavior is in scope.

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

## Environment Model

The app uses development, staging, and production environment files:

- `.env.development`
- `.env.staging`
- `.env.production`

Environment variables used by app code should be exposed as `EXPO_PUBLIC_*`.

Firebase config differs by environment. Treat `.env*`, Firebase files, bundle identifiers, package names, and EAS profiles as sensitive.

## Import Aliases

Configured in both Babel and TypeScript:

- `~assets`
- `~common`
- `~devtools`
- `~features`
- `~helpers`
- `~navigation`
- `~redux`
- `~themes`
- `~state`
- `~i18n`

Prefer aliases over long relative paths.

## Testing Notes

Current automated test coverage is concentrated in Redux modules. UI flows are mostly validated manually through simulator smoke tests.

The current lint command passes but emits ESLint flat-config warnings for `/* eslint-env */` comments in Redux test files. These warnings are known and non-blocking until ESLint v10 makes them errors.

