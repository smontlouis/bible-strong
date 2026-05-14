# Observability

## Local Startup Signals

The root app is `app/_layout.tsx`. Startup work includes i18n setup, splash handling, Redux persist rehydration, database state provider setup, migration hooks, remote config, Sentry init, and deferred modal mounting.

Useful startup log prefixes include:

- `[Navigation]`
- `[Common]`
- `[InitHooks]`
- `[DBManager]`
- `[BiblesDB]`
- `[BibleMigration]`
- `[DB Migration]`
- `[Storage]`
- `[RemoteConfig]`

## Error Capture

- Sentry is initialized in `app/_layout.tsx` with `EXPO_PUBLIC_SENTRY_DSN`.
- The root UI is wrapped with `Sentry.wrap`.
- `src/common/ErrorBoundary.tsx` captures render crashes and shows a fallback.
- Additional Sentry capture points exist around database, WebView, sync, audio, notes, links, and backup flows.

## Common Debug Targets

- App startup and provider tree: `app/_layout.tsx`
- Error boundary: `src/common/ErrorBoundary.tsx`
- Firebase helpers: `src/helpers/firebase.ts`
- Redux store and persistence: `src/redux/store.ts`
- Firestore sync: `src/redux/firestoreMiddleware.ts`
- SQLite/database access: `src/helpers/sqlite.ts`, `src/helpers/databases.ts`, `src/helpers/biblesDb.ts`
- Bible WebView wrapper: `src/features/bible/BibleDOM/BibleDOMWrapper.tsx`
- Studies editor WebView: `src/features/studies/StudiesDOM/StudiesDomWrapper.tsx`
- Audio footer/runtime: `src/features/bible/footer/`

## Local Debugging Notes

- Development navigation logs appear under `[Navigation]`.
- Many storage and migration paths log to the Metro/native console.
- WebView-heavy Bible and studies features may fail independently of the React Native shell; inspect both native logs and WebView wrapper logs.
- Remote config failures are intentionally filtered in Sentry via `src/helpers/ignoreSentryErrors.ts`.

## Reporting Failures

When reporting a failure, include:

- platform and device/simulator;
- command used (`yarn start`, `yarn ios`, `yarn android`, build script, or smoke path);
- environment file/profile used;
- first error stack or visible ErrorBoundary text;
- relevant log prefixes before the failure.
