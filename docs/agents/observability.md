# Observability

## Local Startup Signals

The root app is `app/_layout.tsx`. Startup work includes i18n setup, splash handling, Redux persist rehydration, database state provider setup, migration hooks, remote config, Sentry init, and deferred modal mounting.

Development builds also emit structured agent-readable events to the Metro/native console with the `[AgentLog]` prefix. The payload after the prefix is JSON.

Use the explicit `appLogger` helper instead of monkey-patching global `console`. Console output from dependencies, WebViews, and React Native internals is too noisy to treat as trusted observability. Promote important app events into `appLogger` progressively.

Before a debugging session, clear local captured logs:

```bash
yarn agents:logs:clear
```

Start Expo with automatic session capture when you need queryable logs:

```bash
yarn agents:start:logged
```

This runs `yarn start` and writes the full Expo output to `.scratch/logs/session-*.log` while keeping the terminal interactive. Useful queries during or after a captured session:

```bash
yarn agents:logs:all
yarn agents:logs:errors
yarn agents:logs:startup
yarn agents:logs:navigation
```

In a dev runtime, recent events are also buffered on `globalThis.__BIBLE_STRONG_AGENT_LOGS__` for debugger inspection.

Useful startup log prefixes include:

- `[AgentLog]`
- `[Navigation]`
- `[Common]`
- `[InitHooks]`
- `[DBManager]`
- `[BiblesDB]`
- `[BibleMigration]`
- `[DB Migration]`
- `[Storage]`
- `[RemoteConfig]`

Current structured `[AgentLog]` areas include startup, navigation, Redux, ErrorBoundary crashes, SQLite/database operations, Bible DOM WebView mount/dispatch, and SQLite search.

## Error Capture

- Sentry is initialized in `app/_layout.tsx` with `EXPO_PUBLIC_SENTRY_DSN`.
- The root UI is wrapped with `Sentry.wrap`.
- `src/common/ErrorBoundary.tsx` captures render crashes and shows a fallback.
- Additional Sentry capture points exist around database, WebView, sync, audio, notes, links, and backup flows.

## Common Debug Targets

- Agent-readable log helper: `src/helpers/agentObservability.ts`
- Local log query script: `scripts/agents-log-session.mjs`
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

## Domain Quality Metrics

Run:

```bash
yarn agents:quality
```

This generates:

- `docs/agents/quality-score.md` for human and agent review.
- `.scratch/quality/quality.json` for scripts or agent queries.

The score is directional. It combines static signals such as feature tests, smoke-path mapping, feature README presence, console calls, `any`, TODO/FIXME markers, eslint disables, and sensitive-domain classification.

PR gates run:

```bash
yarn agents:quality:check
```

The default minimum is `5/10`, which catches newly very-low-readiness domains without blocking the current brownfield baseline. To test a stricter threshold locally:

```bash
yarn agents:quality:check --min-score=7
```
