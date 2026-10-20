# Bible Strong Expo app

The Bible Strong study app. One codebase produces the iOS, Android, and Web runtimes (`@bible-strong/expo`).

For what the product does and how this workspace fits in the monorepo, see the [root README](../../README.md). The domain glossary is in [`CONTEXT.md`](./CONTEXT.md); agent and coding instructions are in [`AGENTS.md`](./AGENTS.md).

## Prerequisites

- The root prerequisites: Node.js 22 and Yarn 4 through Corepack
- [EAS CLI](https://docs.expo.dev/eas/) for builds
- iOS: macOS with a version of Xcode supported by Expo SDK 58 (the deployment target is iOS 16.4)
- Android: Android Studio with an emulator or a physical device

The app needs a custom development client. It does not run in Expo Go.

## Setup

1. **Install dependencies from the monorepo root**

   ```bash
   corepack enable
   yarn install
   ```

2. **Create the environment file**

   ```bash
   cp apps/expo/.env.example apps/expo/.env.development
   ```

   `.env.example` documents every variable. You need your own Firebase project for local development: the native Google Services files referenced by the environment file, and the `EXPO_PUBLIC_FIREBASE_*` values for the Web runtime. Staging and production use `.env.staging` and `.env.production`. Do not commit these files.

3. **Build a development client**

   ```bash
   yarn workspace @bible-strong/expo build:ios:dev-sim    # iOS simulator
   yarn workspace @bible-strong/expo build:ios:dev        # iOS device
   yarn workspace @bible-strong/expo build:android:dev    # Android
   ```

   These are local EAS builds; install the resulting binary on the simulator, emulator, or device.

4. **Start the development server**

   ```bash
   yarn dev:expo
   ```

## Commands

Root shortcuts:

| Command | Description |
|---------|-------------|
| `yarn dev:expo` | Start the Expo development server for the development client |
| `yarn dev:expo:ios` | Compile and run the native iOS app |
| `yarn dev:expo:android` | Compile and run the native Android app |
| `yarn dev:expo:web` | Start the app in the browser on port 9090 |

Workspace scripts, run as `yarn workspace @bible-strong/expo <script>`:

| Script | Description |
|--------|-------------|
| `typecheck` | Check generated theme CSS, then run `tsc` |
| `lint` / `lint:fix` | ESLint |
| `format` / `format:check` | Prettier on `src/` |
| `test` | Jest |
| `i18n` | Extract translation strings |
| `themes:generate` / `themes:check` | Regenerate or verify `global.css` from the theme palettes |
| `web:export` | Export the Web runtime as a static single-page app |
| `clean` | Remove `node_modules` and Metro caches, then reinstall |

### Release builds

```bash
# Android
yarn workspace @bible-strong/expo build:android:staging    # internal testing (APK)
yarn workspace @bible-strong/expo build:android:prod       # production (AAB)
yarn workspace @bible-strong/expo build:android:prod:apk   # production (APK)

# iOS
yarn workspace @bible-strong/expo build:ios:staging        # internal testing
yarn workspace @bible-strong/expo build:ios:prod           # production
```

These are local EAS builds. A staging or production build also needs values that are not in git, which `dotenv` loads from two local files:

| File | Variables |
|------|-----------|
| `.env` | `SENTRY_AUTH_TOKEN`, `EXPO_PUBLIC_DEEPL_AUTH_KEY`, `YOUTUBE_API_KEY` |
| `.env.local` | `BIBLE_STRONG_ARCHIVE_KEYS` (offline-copy master keys, ADR-0065) |

On a machine without these files, export the variables instead, and only those: an exported variable overrides the value `.env.production` sets. Without `BIBLE_STRONG_ARCHIVE_KEYS` the build still succeeds, but the app cannot decrypt the offline copies of protected Bibles. Check that the build log prints `[bible-strong-archive] Offline-copy key versions: 1` (or later versions), not `none`.

When the project folder is not a git checkout, set `EAS_NO_VCS=1` and `EAS_PROJECT_ROOT` to the repository root; otherwise EAS takes `apps/expo` for the root, leaves the workspace out and runs Yarn 1.

## Web runtime

The Web runtime is online-only: Bible content, search, and reference resources are read through the Resource service API, and there is no onboarding, local SQLite, or offline download. It is served from `web.bible-strong.app` and is separate from the public site in [`apps/site`](../site/README.md).

See the [development guide](../../docs/dev-guide.md#expo-web-runtime) to run it locally against a Resource service, and the [Web deployment notes](../../docs/expo-web-deployment.md) for hosting.

## Project structure

```
apps/expo/
├── app/                    # Expo Router routes
├── src/
│   ├── features/           # Feature modules
│   │   ├── bible/          # Bible reading and navigation
│   │   ├── resources/      # Access to published resources
│   │   ├── studies/        # Study editor
│   │   ├── plans/          # Reading plans
│   │   ├── search/         # Bible and global search
│   │   ├── lexique/        # Strong lexicon
│   │   ├── nave/           # Nave's Topical Bible
│   │   ├── dictionnary/    # Bible dictionary
│   │   ├── commentaries/   # Commentaries
│   │   ├── timeline/       # Biblical timeline
│   │   ├── audio/          # Audio playback
│   │   ├── study-assistant/ # Study assistant
│   │   └── ...
│   ├── common/             # Shared UI components
│   ├── redux/              # Redux store and slices
│   ├── state/              # Jotai atoms
│   ├── helpers/            # Utilities and hooks
│   ├── navigation/         # Navigation compatibility and types
│   ├── themes/             # Theme palettes
│   └── assets/             # Static assets
├── i18n/                   # Translations
├── firebase/               # Firebase configuration per environment
├── modules/                # Local native modules
└── plugins/                # Expo config plugins
```

Several feature folders carry their own README. The [annotated source tree](../../docs/source-tree.md) and the [architecture document](../../docs/architecture.md) go further.

Downloadable resources follow a versioned catalog. Canonical Bibles, their Strong indexes, the interlinear indexes, and the lexicon modules are independent offline copies, verified and then activated atomically.

## Tech stack

| Area | Technologies |
|------|--------------|
| Framework | Expo SDK 58, React Native 0.88, React 19 with React Compiler |
| Language | TypeScript 6 |
| Navigation | Expo Router |
| State | Redux Toolkit with Redux Persist on MMKV, Jotai |
| Styling | Uniwind with Tailwind CSS v4 |
| Local data | SQLite (`expo-sqlite`) |
| Backend | Firebase Auth (email, Google, Apple), Firestore, Resource service API |
| Audio | `react-native-track-player`, `expo-audio`, `expo-speech` |
| Notifications | Notifee |
| Animations | Reanimated 4, Lottie |
| Monitoring | Sentry |

## Conventions

- **TypeScript**: strict typing; avoid `any`.
- **Styling**: build layout with `Box`, `HStack`, and `VStack`, static styles through Uniwind `className`, computed values through `style`. Do not add Emotion or `styled` wrappers.
- **State**: Redux for persistent and synced data, Jotai for tab and local UI state.
- **Memoization**: React Compiler handles it; do not add `useMemo`, `useCallback`, or `memo`.
- **Imports**: use the `~features`, `~common`, `~helpers`, and related aliases.

[`AGENTS.md`](./AGENTS.md) and the [conventions document](../../docs/conventions.md) hold the full rules.

## Translations

Translation files live in `i18n/locales/`:

- `i18n/locales/fr/translation.json`: French, the primary language
- `i18n/locales/en/translation.json`: English

To add a language:

1. Create a new folder in `i18n/locales/`.
2. Copy `i18n/locales/fr/translation.json` as a base.
3. Translate the values, not the keys.
4. Open a pull request.
