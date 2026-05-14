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

- Recurring maintenance automations.
- Remote build/release validation.
- App Store / Play Store deployment policy.

Initial Level 2 conventions now live in `docs/agents/orchestration.md`. The first hosted PR gate is `.github/workflows/pr-checks.yml`, and PR descriptions use `.github/pull_request_template.md`.

## Readiness Matrix

| Area | Current State | Target | Level | Priority |
|---|---|---|---|---|
| Agent entrypoint | `AGENTS.md` exists with skill and harness blocks | Agents can find issue tracker, validation, smoke, and risk docs | 1 | Done |
| Harness docs | Canonical `docs/agents/` files exist | Short deterministic docs for solo agent work | 1 | Done |
| Environment setup | Real `.env*` files exist; `.env.example` added | Agents know required variable names without secrets | 1 | Done |
| Local checks | Commands exist in `package.json` | Agents can run test/lint/typecheck/format checks before finishing | 1 | Done |
| Mobile UI smoke | `serve-sim` installed; app launch, Bible reading, search result, downloads, and annotation create/remove were smoke-tested on iOS Simulator | Keep smoke evidence updated when flows change | 1 | Done |
| Sensitive areas | Auth, sync, backup, migrations, builds documented as sensitive | Agents ask before risky edits | 1 | Done |
| Observability | Sentry, ErrorBoundary, logs, startup signals documented; `[AgentLog]` emits structured dev events; `yarn agents:start:logged` captures queryable local sessions | Agents know where to inspect failures and can query structured local logs | 1 | Done |
| Domain quality metrics | `yarn agents:quality` generates `docs/agents/quality-score.md` and `.scratch/quality/quality.json`; `yarn agents:quality:check` enforces a conservative PR threshold | Keep score current when domain boundaries, smoke paths, or quality signals change; tighten thresholds progressively | 2 | Done |
| Architecture lint | `yarn agents:architecture` reports repo-specific boundaries; `yarn agents:architecture:check` blocks high-risk boundary errors while leaving brownfield warnings visible | Tighten warnings into errors after existing hotspots are reduced | 2 | Done |
| CI/PR gates | `.github/workflows/pr-checks.yml` runs typecheck, lint, tests, format checks, and agent domain quality checks on PRs; `master` branch protection requires the `Typecheck, lint, test, format` check | Exercise the updated gate on a real PR and adjust context name if needed | 2 | Started |
| Multi-agent orchestration | `docs/agents/orchestration.md` defines issue-to-PR, ownership, and sensitive-area PR rules; `.github/pull_request_template.md` captures PR validation and risk notes | Exercise the flow on real PRs and refine when conflicts appear | 2 | Started |

## Level 1 Status

Ready.

The Level 1 harness baseline is complete for local agent work. Existing caveats are documented and non-blocking.

## Next Patch Batch

No further documentation patch is required for the Level 1 baseline.
