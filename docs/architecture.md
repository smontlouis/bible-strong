# Architecture

Bible Strong is an Expo SDK 54 / React Native 0.81 app using Expo Router, TypeScript, Redux Toolkit, Jotai, Emotion, SQLite, Firebase, Sentry, Reanimated 4, WebView-backed DOM rendering, and a custom Expo development client.

## Runtime Shape

`app/_layout.tsx` is the app root. It initializes i18n, remote config, Sentry, splash handling, theme providers, Redux, persisted state, database state, app switcher context, bottom sheet providers, global modals, and the Expo Router stack.

The root route `app/index.tsx` renders `AppSwitcherScreen`, which is the main workspace. Feature routes under `app/` mostly re-export feature screens and are mapped from legacy React Navigation names in `src/navigation/routeMapping.ts`.

Provider stack:

1. `GestureHandlerRootView`
2. `SafeAreaProvider`
3. Redux `Provider`
4. Emotion `ThemeProvider`
5. popup menu/query/persist/database/error-boundary providers
6. `AppSwitcherProvider`
7. portal/bottom-sheet/book-selector providers
8. Expo Router `Stack`
9. deferred global modals

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

Downloaded resources are managed through:

- `src/helpers/firebase.ts` for CDN URLs.
- `src/helpers/databases.ts` for resource metadata and local paths.
- `src/helpers/databaseTypes.ts` for database identifiers, language-specific/shared classification, and folder paths.
- `src/helpers/downloadManager.ts` and `src/state/downloadQueue.ts` for downloads.

Resource IDs include `STRONG`, `DICTIONNAIRE`, `NAVE`, `TRESOR`, `MHY`, `INTERLINEAIRE`, `TIMELINE`, and `BIBLES`.

## Sync And Cloud

Firebase services include Auth, Firestore, Storage, Remote Config, and Analytics.

Local Redux actions can sync through `src/redux/firestoreMiddleware.ts`. Firestore helper code in `src/helpers/firestoreSubcollections.ts` and migration helpers handle subcollection data and import/migration flows.

Changes to sync, auth, backup, import/export, and migrations are sensitive. See `docs/agents/sensitive-areas.md`.

## Audio

Audio is integrated mainly under `src/features/bible/footer/` and `playbackService`. The app supports TTS through Expo Speech and remote audio through `react-native-track-player`. TrackPlayer registration is deferred after first interactions in `app/_layout.tsx`.

## Observability

Sentry initializes after the splash screen. Navigation adds breadcrumbs. Redux middleware includes logger/crash reporting. See `docs/agents/observability.md`.

