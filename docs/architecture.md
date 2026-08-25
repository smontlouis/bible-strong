# Architecture

Bible Strong is an Expo SDK 54 / React Native 0.81 app using Expo Router, TypeScript, Redux Toolkit, Jotai, Emotion, SQLite, Firebase, Sentry, Reanimated 4, WebView-backed DOM rendering, and a custom Expo development client.

## Runtime Shape

`app/_layout.tsx` is the app root. It initializes i18n, splash handling, theme providers, Redux, persisted state, database state, resource access, the error boundary, and (in normal mode) remote config. The complete application runtime is lazy-loaded from `src/features/app/FullAppRuntime.tsx`; it adds migrations, app switcher context, bottom-sheet providers, global modals, audio registration, download recovery, and the Expo Router stack.

When `EXPO_PUBLIC_PLAYGROUND` is truthy (`true`, `1`, `yes`, or `on`), the root keeps the core provider tree and renders `src/features/playground/PlaygroundScreen.tsx` instead of loading the complete runtime. This mode is intended for fast dashboard and onboarding development and skips remote config, local migration preparation, background initialization hooks, and router navigation.

The root route `app/index.tsx` renders `AppSwitcherScreen`, which is the main workspace. Feature routes under `app/` mostly re-export feature screens and are mapped from legacy React Navigation names in `src/navigation/routeMapping.ts`.

Provider stack:

1. `GestureHandlerRootView`
2. `SafeAreaProvider`
3. Redux `Provider`
4. Emotion `ThemeProvider`
5. query/persist/database/error-boundary/resource-access providers
6. `FullAppRuntime` (normal mode only)
7. `AppSwitcherProvider`
8. portal/bottom-sheet/book-selector providers
9. Expo Router `Stack`
10. deferred global modals

## State Model

### Redux

Redux owns durable user and plan state.

- `src/redux/store.ts` configures redux-persist with MMKV storage, migrations, Firestore middleware, logger, crash reporter, and devtools in development.
- `src/redux/modules/user.ts` owns user account metadata and `user.bible` data: bookmarks, highlights, notes, links, studies, tags, Strong/Nave/word data, word annotations, and Bible settings.
- `src/redux/modules/plan.ts` owns reading plan state and online plan fetches.

### Jotai

Jotai owns local UI/workspace state and several persisted atoms.

- `src/state/tabs.ts` is the main tab and tab-group model.
- `src/state/app.ts` owns global modal atoms, history, full-screen state, and refresh signals.
- `src/state/downloadQueue.ts` tracks resource downloads.
- `src/state/resourcesLanguage.ts` tracks per-resource language selection.

### Storage

- Redux persist uses MMKV through `src/helpers/storage.ts`.
- Some older data can migrate from AsyncStorage/filesystem storage.
- SQLite and JSON resource files are stored under Expo `documentDirectory`, with language-aware folders in `src/helpers/databaseTypes.ts`.

## Navigation And Tabs

Expo Router provides file-based routes in `app/`. The app still keeps legacy route names/types in `src/navigation/type.ts` and maps them with `src/navigation/routeMapping.ts`.

The main UX is not a simple route stack. `src/features/app-switcher/` maintains multiple open tabs and tab groups. Tabs can represent Bible views, search, compare, Strong, Nave, dictionary, studies, notes, commentaries, or a new-tab chooser.

The bottom tab nav includes the book icon used to open the main Bible view.

## Bible Reading Architecture

The Bible feature is the product core.

Key files:

- `src/features/bible/BibleTabScreen.tsx` prepares per-tab Bible state.
- `src/features/bible/BibleViewer.tsx` orchestrates header, DOM renderer, footers, modals, selection, annotations, resources, notes, links, bookmarks, and study actions.
- `src/features/bible/BibleDOM/` renders chapter content in a DOM/WebView-style layer and handles interaction events.
- `src/features/bible/SelectedVersesModal/` handles verse-selection actions.
- `src/features/bible/hooks/useAnnotationMode.ts` bridges native annotation toolbar state with DOM selection/annotation behavior.

Verse-level actions and word-level annotation actions are different concepts:

- Verse-level highlights are applied through `ColorCirclesBar` and stored as `user.bible.highlights`.
- Word-level annotations are applied through `AnnotationToolbar` and stored as `user.bible.wordAnnotations`.

## Data And Resources

Resource consumers go through domain access modules under `src/features/resources/` and TanStack
Query options under `src/helpers/queryOptions.ts`. Screens should not infer whether a result came
from the shared Bible database, a sidecar, or another local resource database.

The offline resource layer is split by responsibility:

- `packages/resource-catalog/src/mobile-resource-catalog.json` is the canonical bundled catalog of distributable ZIP artifacts.
- `src/helpers/mobileResourceCatalog.ts` validates the bundled or remotely refreshed catalog and
  never accepts a catalog that drops a bundled resource identity.
- `src/helpers/downloadManager.ts` and `src/state/downloadQueue.ts` own queue execution and
  dependency ordering.
- `src/helpers/managedResourceInstallation.ts`, `resourceInstallationJournal.ts`, and
  `atomicResourceFile.ts` make replacement recoverable and activate validated files atomically.
- `src/helpers/offlineCopy.ts` and `offlineCopyId.ts` describe installed-copy identity independently
  from its physical storage format.

Not every offline copy is a `DatabaseId`:

- Regular and canonical Bible texts are imported into the shared `bibles.sqlite` database.
- A Strong-capable Bible has an optional, version-specific SQLite sidecar managed by
  `strongBibleSidecar.ts`; the Bible text remains readable without it.
- BHG is the canonical Hebrew/Aramaic and Greek Bible. Optional French and English interlinear
  sidecars managed by `interlinearBibleSidecar.ts` add token alignment, glosses, morphology, and
  lexical identities without duplicating BHG text.
- The shared Strong lexicon is modular: required `core`, optional `resources` (the detailed Greek
  dictionary), and optional `entities`. `strongLexiconModules.ts` owns their lifecycle.
- `DICTIONNAIRE`, `NAVE`, `TRESOR`, `MHY`, `TIMELINE`, and `BIBLES` remain the general
  `DatabaseId` values declared in `databaseTypes.ts`.

Publication modules such as `strongBiblePublications.ts`, `interlinearBiblePublications.ts`, and
`strongLexiconPublications.ts` define compatibility metadata. Readers require matching text
revision and checksum before applying a sidecar, so offsets from one publication cannot be used
against another Bible text.

## Sync And Cloud

Firebase services include Auth, Firestore, Storage, Remote Config, and Analytics.

Local Redux actions can sync through `src/redux/firestoreMiddleware.ts`. Firestore helper code in `src/helpers/firestoreSubcollections.ts` and migration helpers handle subcollection data and import/migration flows.

Changes to sync, auth, backup, import/export, and migrations are sensitive. See `docs/agents/sensitive-areas.md`.

## Audio

Audio is integrated mainly under `src/features/bible/footer/` and `playbackService`. The app supports TTS through Expo Speech and remote audio through `react-native-track-player`. TrackPlayer registration is deferred after first interactions in `src/features/app/FullAppRuntime.tsx`.

## Observability

Sentry initializes after the splash screen. Navigation adds breadcrumbs. Redux middleware includes logger/crash reporting. See `docs/agents/observability.md`.
