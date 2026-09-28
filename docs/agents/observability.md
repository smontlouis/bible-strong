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
- Error-event sampling is `1.0`: handled startup, migration, storage, download, and sync failures must not be probabilistically discarded.
- Default PII collection is disabled. The authenticated Sentry user is limited to the Firebase user ID and email; diagnostic contexts must not include profile data or user-generated content.
- The root UI is wrapped with `Sentry.wrap`.
- `src/common/ErrorBoundary.tsx` captures render crashes and shows a fallback.
- `appLogger.captureError(area, event, error, context)` is the standard capture boundary for handled failures. It adds stable tags, sanitized technical context, and the preceding `appLogger` breadcrumbs.
- `appLogger.error` and `appLogger.warn` add breadcrumbs only. Use them for recoverable intermediate attempts; use `captureError` once when an operation finally fails or a sensitive recovery path is degraded.
- Additional Sentry capture points exist around database, WebView, sync, audio, notes, links, and backup flows.
- Protected artifact downloads validate the HTTP status before checksum verification. A first `401` is retried once with a forced App Check refresh; a persistent refusal is captured as `resource_artifact.http_failed` with the status, Worker request ID, retry flag, and non-secret token-shape diagnostics. Never interpret an archive checksum mismatch as an authentication failure.
- Native Resource App Check callers share an in-flight SDK request. After a failure, new calls fail with that same error during a demand-driven cooldown (2, 4, 8, 16, then at most 30 seconds). No background retry is scheduled; SDK token caching, expiry and provider backoff still apply. Forced refreshes also respect cooldown and cannot reuse an in-flight non-forced lookup as their final result.
- `resource_app_check.token_failed` is captured once per failed SDK acquisition, not once per waiting caller. Its context includes `consecutiveFailures`, `retryAfterMs` (the app cooldown, not the provider's retry deadline), and the sanitized `initialFailure` from the current failure sequence. A successful acquisition clears this sequence. Use `initialFailure` to find a refusal hidden by later native `Too many attempts` errors; the latter alone does not prove a quota breach or a failed device-integrity verdict.
- Native App Check failures include `appCheckProvider`, indexed as `diagnostic.app_check_provider`. The Android beta selects `recaptchaEnterprise` in its native build; standard Android uses `playIntegrity`. This identifies the configured provider, not the issuer of a cached token or an authorization claim. See `docs/android-app-check-beta.md` for pilot filters and acceptance checks.

Safe diagnostic context includes migration/step/resource/version IDs, error codes, retry counts, durations, HTTP status, lifecycle phase, and boolean capability flags. Never attach tokens, authorization headers, signed URL query strings, Redux/MMKV payloads, notes, highlights, studies, search text, verse contents, full Firebase profiles, or raw native/WebView event payloads. The logger sanitizes common sensitive keys and values as a second line of defense; callers are still responsible for sending only the minimum technical context needed to diagnose the failure.

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

## Android App Check rollout diagnostics

Native Sentry Logs are enabled for JS-origin `resource_app_check.summary` only. The
`beforeSendLog` allowlist removes unrelated log messages, user attributes and arbitrary
fields. Each summary holds exact local `count` and `durationTotalMs` for a bounded
(provider, outcome, phase, forceRefresh) bucket, flushed every 60 seconds and on
background. No extra attestation request is made for telemetry. The SDK handles
transport; abrupt termination, offline transport, quotas or server-side filtering can
lose observations. These are best-effort operational rates, not an audit ledger.

In **Sentry → Logs**, select message `resource_app_check.summary`, group by
`buildNumber`, `provider` and `outcome`, and aggregate **sum(count)** (not row count).
For SDK lookup availability use `success / (success + failure)`; compare forced and
non-forced lookups separately. Exclude `coalesced`, `cooldown` and `recovered` from
that denominator. Average acquisition latency is `sum(durationTotalMs) / sum(count)`
for the same success/failure buckets. `recovered` records a success following failures;
its `durationTotalMs` sums elapsed outage time, and its breadcrumb retains the failure count. Counts describe SDK
lookups including cache hits, never Google assessments or unique affected users.
`coalesced` includes callers joining an in-flight lookup, including a forced caller
that may subsequently need its own refresh. Release/build and OS attributes support
cohort comparison; device details remain available on Sentry error events.

Failures distinguish `initialize` from `acquire`, with duration, original refusal and
bounded sanitized native causes. The v2 bridge includes the native reCAPTCHA error
code when the SDK supplies a `RecaptchaException`; Firebase may still return only a
generic rejection. It does not expose the risk score, assessment ID or Google's
internal verdict reasons. Existing v1 binaries use the compatible older bridge.
Success breadcrumbs expose remaining validity when available, never the token.
The provider tag remains the configured provider, not proof of the cached token's issuer.

`resource_api.protected_request_failed` includes configured provider, status,
request ID and total duration. The first 401 before a refresh is preserved as a `resource_api.refresh_after_401` breadcrumb with its request ID. `resource_api.request_failed` covers network/deadline
errors at the overall request boundary (which includes token acquisition); cancellations
and already-reported App Check errors are not reported again there.

Use the Android key's Google Cloud reCAPTCHA metrics to inspect the aggregate score
distribution. It cannot be joined to an individual Sentry event using this integration.
Do not classify `App attestation failed` as a confirmed low score, or throttling as
proof of exhausted project quota. See the release runbook for verification steps.
