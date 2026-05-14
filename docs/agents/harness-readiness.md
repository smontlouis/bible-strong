# Harness Readiness

## Current State

Bible Strong is an Expo SDK 54 / React Native 0.81 mobile app using TypeScript, Expo Router, Redux Toolkit, Jotai, Firebase, SQLite, Sentry, and EAS local builds.

The repository has Matt Pocock-compatible agent setup in `AGENTS.md` and `docs/agents/`. This first Level 1 harness pass adds reproducible local checks, smoke-test expectations, sensitive-area policy, and observability notes.

## Assumptions Made

- Level 1 only is in scope.
- GitHub Issues is the issue tracker, based on the configured `origin` remote and prior setup.
- This is a single-context repo for agent/domain docs.
- UI smoke execution requires a custom Expo development client. `serve-sim` is installed as a dev dependency. In this environment, Expo startup required Node 20 because Node 22 triggered a `freeport-async` bad-port crash before Metro could bind.

## Level 1 Completed

- Added a stable `## Harness readiness` pointer in `AGENTS.md`.
- Added canonical harness docs under `docs/agents/`.
- Added `.env.example` with required variable names and blank placeholders for secret-like values.
- Documented validation commands that exist in `package.json`.
- Documented and executed critical mobile smoke paths.
- Documented sensitive areas and local observability/debugging signals.

## Level 1 Gaps

No blocking Level 1 gaps remain from this pass.

The app was launched and representative read/search/download/annotation smoke paths were executed on iOS Simulator with `serve-sim`.

Non-blocking:

- ADR infrastructure exists under `docs/adr/`, but no durable decisions have been recorded yet. Add ADRs only when real decisions are made or confirmed.
- Unit tests are reducer-heavy; feature-level and UI smoke coverage is mostly manual.

## Level 2 Deferred

- CI or hosted PR gates.
- Multi-agent branch orchestration.
- Recurring maintenance automations.
- Remote build/release validation.
- App Store / Play Store deployment policy.

## Readiness Matrix

| Area | Current State | Target | Level | Priority |
|---|---|---|---|---|
| Agent entrypoint | `AGENTS.md` exists with skill and harness blocks | Agents can find issue tracker, validation, smoke, and risk docs | 1 | Done |
| Harness docs | Canonical `docs/agents/` files exist | Short deterministic docs for solo agent work | 1 | Done |
| Environment setup | Real `.env*` files exist; `.env.example` added | Agents know required variable names without secrets | 1 | Done |
| Local checks | Commands exist in `package.json` | Agents can run test/lint/typecheck/format checks before finishing | 1 | Done |
| Mobile UI smoke | `serve-sim` installed; app launch, Bible reading, search result, downloads, and annotation create/remove were smoke-tested on iOS Simulator | Keep smoke evidence updated when flows change | 1 | Done |
| Sensitive areas | Auth, sync, backup, migrations, builds documented as sensitive | Agents ask before risky edits | 1 | Done |
| Observability | Sentry, ErrorBoundary, logs, startup signals documented | Agents know where to inspect failures | 1 | Done |
| CI/PR gates | No workflows found locally | Optional later orchestration policy | 2 | Deferred |

## Level 1 Status

Ready.

The Level 1 harness baseline is complete for local agent work. Existing caveats are documented and non-blocking.

## Next Patch Batch

No further documentation patch is required for the Level 1 baseline.
