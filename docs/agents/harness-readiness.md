# Harness Readiness

Generated: 2026-05-15 11:58 CEST  
Repo: `bible-strong`  
Branch: `codex/architecture-deepening`  
Commit inspected: `04bb9d802`

## Current Harness State

### Project Mode

Brownfield.

Evidence: the repo has a full Expo/React Native app, `package.json` scripts, `app/` routes, feature modules under `src/features/`, Firebase config directories, EAS build profiles, existing product docs, `AGENTS.md`, `CONTEXT.md`, ADR scaffolding, and canonical `docs/agents/` harness files.

### Detected Stack

- Expo SDK 54, React Native 0.81, React 19, TypeScript.
- Expo Router entrypoint via `expo-router/entry`; routes live under `app/`.
- Redux Toolkit, Redux Persist, Jotai, MMKV, SQLite, Firebase, Sentry.
- Emotion Native for styling and feature-based modules under `src/features/`.
- Yarn 4 with Corepack.

### Existing Commands

Detected in `package.json`:

| Purpose | Command |
|---|---|
| Install | `corepack enable`, then `yarn install` |
| Start dev client Metro | `yarn start` |
| iOS simulator/device run | `yarn ios` |
| Android emulator/device run | `yarn android` |
| Simulator control | `yarn serve-sim` |
| Unit tests | `yarn test` |
| Lint | `yarn lint` |
| Typecheck | `yarn typecheck` |
| Format check | `yarn format:check` |
| i18n extraction | `yarn i18n` |
| Agent architecture check | `yarn agents:architecture:check` |
| Agent domain quality check | `yarn agents:quality:check` |
| Query captured local logs | `yarn agents:logs:*` |
| EAS local builds | `yarn build:android:*`, `yarn build:ios:*` |

No intended or proposed Level 1 commands are documented as canonical unless they exist in `package.json`.

### Existing Docs

- `AGENTS.md`: always-loaded repo guidance, project overview, commands, conventions, agent skills, harness pointer block.
- `CONTEXT.md`: product/domain language and invariants.
- `docs/index.md`: repo documentation index.
- `docs/architecture.md`, `docs/source-tree.md`, `docs/dev-guide.md`, `docs/data-models.md`, `docs/conventions.md`: product and architecture docs.
- `docs/agents/`: issue tracker, triage labels, domain consumption, validation, smoke tests, sensitive areas, observability, orchestration, architecture lint, quality score, this readiness state, and the HTML harness state report.
- `docs/adr/README.md`: ADR location exists, but no durable ADRs are recorded yet.

### Repo Knowledge Source Of Truth

The source of truth is split deliberately:

- Always-loaded map: `AGENTS.md`.
- Product/domain language: `CONTEXT.md`.
- Detailed architecture and conventions: `docs/`.
- Agent harness: `docs/agents/`.
- Decisions: `docs/adr/` when durable decisions are made.
- Generated Level 2 reports: `docs/agents/architecture-lint.md`, `docs/agents/quality-score.md`, plus JSON under `.scratch/`.

Freshness risk: several generated docs depend on `package.json`, static scans, and smoke evidence. They should be refreshed after command changes, navigation changes, large feature moves, or smoke-path changes.

### Validation Surface

Primary surface: mobile app.

Selected `1C` validation path:

- Local static checks: `yarn typecheck`, `yarn lint`, `yarn test`, `yarn format:check`.
- Harness checks: `yarn agents:quality:check`, `yarn agents:architecture:check`.
- Mobile UI validation: `serve-sim` with an Expo custom development client.

Reason for selected path: this is a UI-driven mobile app, `serve-sim` is already installed as a dev dependency, and existing smoke evidence was captured against an iOS Simulator.

### Inferred Architecture

Inferred from source tree and docs:

- Feature modules live under `src/features/`.
- Shared UI and utilities live under `src/common/`, `src/helpers/`, `src/redux/`, `src/state/`, and `src/themes/`.
- Bible and studies content use WebView/DOM wrappers inside the native shell.
- User data persists locally through Redux/MMKV/SQLite and syncs through Firebase/Firestore when authenticated.
- App startup goes through `app/_layout.tsx`, provider setup, Sentry, Firebase, migrations, Redux persist, and navigation.

### Inferred Product Surface

Bible Strong is a Bible study app for French-speaking users with English support. Critical user-facing surfaces include Bible reading, search, Strong's concordance, notes/highlights/bookmarks, reading plans, Nave/dictionary/timeline study tools, downloads/offline resources, audio/TTS, settings, auth, backups, and sync.

### Sensitive Areas

Documented in `docs/agents/sensitive-areas.md`:

- Authentication and account deletion.
- Firestore sync and user-owned data.
- SQLite/local storage migrations and destructive reset.
- Backup, import, and export.
- Native config, bundle identity, build profiles, release behavior, EAS updates.
- External services: Firebase, Sentry, DeepL, Bible/resource/audio endpoints, store review scripts.

### Existing Feedback Loops

- Jest unit tests through `yarn test`.
- ESLint through `yarn lint`.
- TypeScript through `yarn typecheck`.
- Prettier check through `yarn format:check`.
- Agent architecture scan through `yarn agents:architecture:check`.
- Agent domain quality scan through `yarn agents:quality:check`.
- GitHub Actions PR check under `.github/workflows/pr-checks.yml`.
- Manual/mobile smoke checklist and recent iOS Simulator evidence in `docs/agents/smoke-tests.md`.
- Mobile-sequential orchestration policy in `docs/agents/orchestration.md`: Bible Strong issue work uses one branch in the current worktree with a local mobile verification loop before PR readiness.
- Queryable local log capture via `yarn agents:start:logged` and `yarn agents:logs:*`.

### Existing Mechanical Constraints

- TypeScript compiler.
- ESLint and React Compiler lint plugin.
- Prettier.
- Agent architecture lint script with high-risk errors and brownfield warnings.
- Agent domain quality script with conservative thresholds.
- PR template requiring validation, mobile validation status, evidence, and sensitive-area notes.
- GitHub Actions PR gate for typecheck, lint, test, format, quality, and architecture checks.

### Operating Model

Agent-assisted.

Evidence: the repo has `AGENTS.md`, issue-tracker/triage docs, `docs/agents/`, harness checks, PR orchestration docs, branch ownership rules, and a mobile-sequential orchestration policy. It is not agent-first because merge autonomy, recurring agents, auto-merge, prompt-to-merge, and automated mobile validation command wrappers are explicitly deferred.

### Harness Gaps

Blocking Level 1 gaps: none currently documented.

Non-blocking Level 1 gaps:

- Feature-level automated tests are sparse; many domains rely on manual smoke plus static checks.
- ADR infrastructure exists, but durable decisions have not yet been captured as ADRs.
- Recent UI smoke evidence exists, but smoke execution is not automated and must be rerun manually after UI/navigation changes.

Level 2 gaps:

- PR gates have now been exercised through real merged PRs, including #219 and #220. Keep watching check context drift when the GitHub workflow changes.
- Architecture lint has 486 brownfield warnings; current gate blocks only high-risk errors.
- Domain quality scores are conservative and directional.
- Recurring maintenance/doc-gardening is documented as a candidate only.
- After UI evidence publication has been exercised through dedicated evidence branches for issues 195, 198, and 208. Retention policy and broader automation remain deferred.
- Agent-to-agent review, auto-fix loops, auto-merge, and prompt-to-merge autonomy are deferred.

## Harness Layout Resolution

### Detected

- project mode: brownfield
- `CLAUDE.md`: no
- `AGENTS.md`: yes
- `docs/agents/`: yes
- `.harness/`: no
- `CONTEXT.md`: yes
- `CONTEXT-MAP.md`: no
- `docs/adr/`: yes
- `.scratch/`: yes, used for generated agent reports
- Existing non-canonical harness docs: `docs/agents/harness-readiness.html` and `docs/agents/harness-state.html` existed from previous report naming and were migrated to `docs/agents/harness-report/index.html`.

### Selected Layout

- agent entrypoint: `AGENTS.md`
- harness docs: `docs/agents/`
- human-readable harness report: `docs/agents/harness-report/index.html`
- domain docs: `CONTEXT.md`
- decisions: `docs/adr/`
- repo knowledge source of truth: `AGENTS.md`, `CONTEXT.md`, `docs/`, and generated reports under `docs/agents/`
- local issues: not configured; issue tracker is GitHub Issues
- machine-readable harness specs: `.harness/` not selected; Level 2 specs are deferred

## Recommended Scope

Selected scope: Level 1 baseline plus documentation of existing Level 2 guardrails.

Level 1 makes the repo readable, runnable, testable, and safer for one human plus one agent. Level 2 items already present are documented as started or deferred, but missing Level 2 work is not blocking Level 1 readiness.

## Proposed Smoke Paths

### Must Run For Level 1 Ready

- App launch and home/onboarding render with no ErrorBoundary fallback.
- Bible reading and navigation through the default Bible tab.
- Search to passage, then open a result in Bible view.
- Safe local annotation flow: create and remove a highlight or note created during the test.
- Downloads/resource awareness without deleting existing resources.

### Optional Follow-Up

- Strong concordance lookup from a verse.
- Nave or dictionary detail navigation.
- Reading plan list and one plan detail.
- Timeline home and event details.
- Audio/TTS play/pause without background-mode assertions.
- Theme switch and return to the previous theme.
- Import/export backup flow with a throwaway file only.

### Blocked Or Requires Human Context

- Auth, registration, Google Sign-In, Apple Sign-In, and email verification.
- Account deletion.
- Account-backed Firestore sync validation.
- Production/staging builds, EAS updates, App Store / Play Store validation.
- Destructive resource deletion or backup overwrite outside throwaway data.

## Harness Readiness Matrix

| Code | Workstream | Current State | Target | Status | Priority |
|---|---|---|---|---|---|
| 1A | Local commands | Commands detected in `package.json` and documented in `docs/agents/validation.md` | Agents know canonical install, run, check, and build commands | Verified locally | Done |
| 1B | Local setup and environment | `.env.example` exists; environment files and Node 20 Expo workaround documented | Agents know required env variables, secrets boundaries, and local setup caveats | Documented for agents | Done |
| 1C | Validation tooling | Static checks, harness checks, and `serve-sim` path documented; prior smoke validation used iOS Simulator | Agents have a practical validation path for mobile changes | Verified locally | Done |
| 1D | Product smoke paths | Must-run mobile smoke paths documented; recent iOS Simulator evidence recorded | Critical ordinary flows are documented and executable | Verified locally | Done |
| 1E | Sensitive areas | Risk policy documented for auth, sync, storage, backup, native config, release, and external services | Agents know approval boundaries | Documented for agents | Done |
| 1F | Local observability | Sentry, ErrorBoundary, `[AgentLog]`, startup prefixes, and log query scripts documented | Agents know where to find startup/errors/debugging evidence | Verified locally | Done |
| 1G | Agent entrypoint and repo knowledge map | `AGENTS.md`, `CONTEXT.md`, `docs/index.md`, `docs/agents/`, and ADR directory exist | Entrypoint maps to focused docs without becoming a monolith | Documented for agents | Done |
| 1H | Readiness status, gaps, upgrades | This file and `docs/agents/harness-report/index.html` summarize gaps, status, smoke evidence, and next upgrades | Remaining gaps are visible and actionable | Documented for agents | Done |

## Level 1 Status

Ready.

Can this repo be considered Level 1 ready now? Yes.

- Were must-run smoke paths documented? Yes.
- Were must-run smoke paths executed? Yes, based on the recent iOS Simulator evidence recorded in `docs/agents/smoke-tests.md`.
- If not executed, did the user explicitly defer them? Not applicable.

Level 1 readiness is based on existing documented evidence plus the current canonical command and harness documentation. If navigation, Bible WebView behavior, downloads, or annotation flows change, rerun the must-run smoke paths before claiming readiness for that patch.

### Validation Performed In This Pass

| Check | Result | Notes |
|---|---|---|
| `yarn typecheck` | Passed | No TypeScript errors reported. |
| `yarn format:check` | Passed after formatting two files | `src/helpers/resourceDatabaseInstallation.ts` and `src/state/tabs.ts` needed mechanical Prettier formatting. |
| `yarn lint` | Passed with warnings | ESLint reported flat-config migration warnings for `/* eslint-env */` comments in tests and one existing unused import warning in `src/features/bible/BibleViewer.tsx`. |
| `yarn test --watchman=false` | Passed | 14 test suites, 247 tests. |
| `yarn agents:quality:check` | Passed | Regenerated `docs/agents/quality-score.md` and `.scratch/quality/quality.json`; all domains are at least `5/10`. |
| `yarn agents:architecture:check` | Passed with warnings | Regenerated `docs/agents/architecture-lint.md` and `.scratch/architecture/architecture.json`; 0 errors and 486 warnings. |

### HTML Harness Report

`docs/agents/harness-report/index.html` is the canonical self-contained human report hub for harness state. It replaces the earlier `docs/agents/harness-readiness.html` and `docs/agents/harness-state.html` names.

The index is a dashboard and table of contents. Full HTML detail pages live beside it for readiness, validation, quality, risks, observability, commands, Level 2, and decisions. Markdown remains the source of truth for agents.

Current HTML contract:

- the index separates covered workstreams from verified evidence;
- the dashboard exposes warnings and dates instead of showing false-green completion;
- each detail page starts with current state, evidence, gaps, and source;
- `level-2.html` separates orchestration maturity from Level 1 readiness;
- status labels use the canonical taxonomy: `Missing`, `Found in repo`, `Documented for agents`, `Verified locally`, `Blocked or deferred`.

## Level 2 Advanced Harness Status

| Capability | Status | Minimum Evidence Required | Current Evidence | Next Mechanical Constraint | Required For Level 1? |
|---|---|---|---|---|---|
| 2A PR and branch orchestration | Verified locally | Documented issue-to-branch-to-PR flow, ownership rules, and mobile-sequential loop | `docs/agents/orchestration.md`, PR template, issue tracker docs, merged PRs #219 and #220; issue artifacts exist under `.scratch/issues/198` and `.scratch/issues/208` | Continue refining ownership/conflict rules as real PRs reveal gaps | No |
| 2B PR gates and remote validation | Verified locally | Hosted workflow names and required check context confirmed | `.github/workflows/pr-checks.yml` runs typecheck, lint, test, format, quality, architecture; real PRs #219 and #220 have been merged through the hosted gate | Reconfirm check names only when workflow or branch protection changes | No |
| 2C Queryable local observability | Found in repo | Agent-queryable logs for startup, errors, and navigation | `agents:start:logged`, `agents:logs:*`, `[AgentLog]`, `.scratch/logs/` convention | Add more structured events only when they help real debugging | No |
| 2D Domain quality metrics | Verified locally | Generated domain score with threshold and machine artifact | `docs/agents/quality-score.md`, `.scratch/quality/quality.json`, `agents:quality:check` | Keep thresholds conservative until scores stabilize | No |
| 2E Architecture and taste linting | Verified locally | Generated architecture scan with blocking errors separated from warnings | `docs/agents/architecture-lint.md`, `.scratch/architecture/architecture.json`, `agents:architecture:check` | Reduce brownfield warnings before tightening gates | No |
| 2F Doc freshness and recurring maintenance | Documented for agents | Owner-approved cadence, destination, and output expectation | Candidate automations in `docs/agents/orchestration.md` | Defer until cadence and notification destination are chosen | No |
| 2G After UI evidence | Verified locally | Deterministic screenshot/video path tied to smoke flows and visible PR evidence | Manual smoke screenshots referenced in `docs/agents/smoke-tests.md`; issue evidence artifacts exist for 195, 198, and 208; `agents:issue:pr --attach-evidence` published dedicated evidence branches such as `codex-evidence-issue-198` | Refine retention policy and evidence expectations as more UI PRs use the flow | No |
| 2H Agentic review and merge autonomy | Blocked or deferred | Explicit policy, checks, labels, branch protection, and sensitive-area exclusions | Explicitly deferred in orchestration docs; mobile PRs require smoke evidence unless the change is non-runtime/non-user-facing | Require explicit policy before enabling | No |
| 2I Harness command wrappers and audit | Verified locally | Repo-native commands plus drift audit when drift recurs | Existing `agents:*` scripts in `package.json`, including `agents:issue:start`, `agents:issue:pr --attach-evidence`, and `agents:issue:run`; real issue artifacts under `.scratch/issues/195`, `.scratch/issues/198`, and `.scratch/issues/208` show the handoff contract in use | Add a drift audit only if command/doc mismatch recurs | No |

## Harness Upgrade Candidates

Knowledge:

- Add ADRs when durable architecture decisions are made or confirmed.
- Keep `docs/index.md`, `CONTEXT.md`, and `AGENTS.md` aligned when product boundaries move.

Feedback:

- Add feature-level tests around the highest-risk domains when touching them.
- Rerun mobile smoke paths after navigation, Bible WebView, search, downloads, or annotation changes.
- Keep after screenshot capture in the implementation agent loop; use `agents:issue:pr --attach-evidence` to publish supported evidence files to the PR without committing them to the product branch.

Constraint:

- Gradually convert architecture warnings to errors only after reducing brownfield debt.
- Keep `agents:quality:check` conservative until each domain has realistic tests or smoke coverage.

Orchestration:

- Continue using the exercised GitHub PR gate on real PRs; update docs only if check context or branch protection changes.
- Use the mobile orchestration policy for agentic issue work: one dedicated branch in the current worktree, static checks, local mobile smoke, fix loop, then PR readiness.
- Add recurring doc-gardening only after the owner chooses cadence and destination.
- Defer `.harness/` machine-readable specs until a specific Level 2 guardrail needs them.

## Next Patch Batch

No Level 1 patch is required to reach readiness.

Small future batches, when useful:

1. Keep `.github/workflows/pr-checks.yml` and branch protection names aligned when workflow jobs change.
2. Refine PR body generation from `commit-message.txt`, `change-summary.md`, `pr-notes.md`, `mobile-validation.md`, stable `.scratch/issues/<issue>/evidence/` artifacts, and `evidence-attachments.json`.
3. Decide an evidence retention policy for dedicated evidence branches such as `codex-evidence-issue-198`.
4. Add ADRs for newly confirmed durable decisions.
5. Add targeted feature tests or smoke coverage when changing low-score domains in `docs/agents/quality-score.md`.
6. Add a semantic harness audit only if command/doc drift recurs.
