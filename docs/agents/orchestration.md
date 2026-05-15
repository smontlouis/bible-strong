# Agent Orchestration

This document defines the first Level 2 harness rules for coordinating agents, pull requests, and remote validation.

## Scope

Level 2 work begins from the Level 1 harness in `docs/agents/`. Level 1 remains the baseline for every agent task: read the relevant domain docs, use the canonical validation commands, respect sensitive areas, and run or document smoke checks for UI changes.

This first Level 2 pass covers:

- GitHub issue to branch to PR flow.
- PR validation gates.
- Multi-agent ownership rules.
- Mobile-sequential implementation and validation loop.
- Release and build boundaries.

It does not automate releases, app store submission, production data operations, or account-backed destructive tests.

## Issue To PR Flow

Use GitHub Issues as the source of truth, as documented in `docs/agents/issue-tracker.md`.

1. Triage the issue with the labels in `docs/agents/triage-labels.md`.
2. Only start autonomous implementation when the issue is labeled `ready-for-agent` or the user explicitly assigns the task in chat.
3. Create branches with the `codex/` prefix unless the user asks for another name.
4. Keep each branch focused on one issue or one coherent patch batch.
5. Open PRs as drafts until local validation has run or any missing validation is clearly explained.

To prepare a single issue for agent work, run:

```bash
yarn agents:issue:start <issue-number> [--dry-run] [--create-branch] [--run-codex] [--codex-sandbox <mode>]
```

This writes `.scratch/issues/<issue-number>/issue.json`, `prompt.md`, and `summary.md`. It does not create or switch branches by default.

Options:

- `--dry-run`: fetch the issue and print the planned branch and artifact paths without writing files or changing git state.
- `--create-branch`: create and check out the recommended branch in the current worktree.
- `--run-codex`: run `codex exec` non-interactively with the generated prompt and write the final agent message to `.scratch/issues/<issue-number>/codex-final.md`.
- `--codex-sandbox <mode>`: choose the sandbox passed to `codex exec` when using `--run-codex`. Supported modes are `read-only`, `workspace-write`, and `danger-full-access`; the default is `danger-full-access`.

Do not use `--worktree` for Bible Strong mobile user-facing issue work. This repo currently uses `mobile-sequential`: one issue branch in the current worktree, one local mobile verification loop, then PR readiness.

The default `danger-full-access` is intentional for this mobile-sequential harness because runtime validation needs host-level tools such as iOS Simulator/CoreSimulator. For routine static-only implementation work, pass `--codex-sandbox workspace-write` explicitly.

The generated prompt is suitable for Codex direct work today. Sandcastle is not part of this MVP because mobile runtime validation remains host-only and sequential.

When `--run-codex` handles a UI or runtime issue, the agent should leave PR-ready evidence in stable issue-local paths:

- `.scratch/issues/<issue-number>/evidence/` for screenshots, recordings, and other UI artifacts.
- `.scratch/issues/<issue-number>/mobile-validation.md` for simulator/device, smoke path, app logs, runtime status, and blockers.
- `.scratch/issues/<issue-number>/codex-final.md` for the final implementation summary.

Use `mobile-validation.md` status values `passed`, `blocked`, or `not-needed`. If no before screenshot exists, capture and label after evidence rather than inventing a baseline.

To package an issue branch into a PR body after local evidence exists, run:

```bash
yarn agents:issue:pr <issue-number> [--dry-run] [--create] [--push] [--draft|--ready] [--base <branch>]
```

This reads `.scratch/issues/<issue-number>/issue.json`, `codex-final.md`, `mobile-validation.md`, and `evidence/`, then writes `.scratch/issues/<issue-number>/pr-body.md`. It does not push or create a PR unless `--create` is passed; PRs are draft by default.

## Multi-Agent Ownership

When multiple agents work in parallel, split by disjoint ownership boundaries before implementation starts.

Good ownership boundaries:

- one feature directory under `src/features/`;
- one shared module under `src/common/`, `src/helpers/`, `src/redux/`, or `src/state/`;
- documentation-only changes under `docs/`;
- one native/build configuration area such as `app.config.ts`, `eas.json`, or Firebase config paths.

Avoid assigning two agents to the same files or tightly coupled Redux and UI behavior unless one agent is explicitly responsible for integration.

Each agent must state in its PR:

- issue or request covered;
- owned files or modules;
- validation commands run;
- smoke paths run or marked not needed;
- sensitive areas touched, if any.

## Mobile Orchestration Mode

Bible Strong is a mobile-first Expo/React Native app. Treat runtime validation as host-only unless a future runner explicitly proves simulator or device access.

Selected mode: `mobile-sequential`.

Use this orchestration shape for mobile user-facing or runtime issue work:

1. Branch start.
   - Create or switch to one dedicated `codex/issue-<number>-<slug>` branch in the current worktree.
   - Do not create a per-issue worktree for the normal mobile loop.
2. Implementation loop.
   - Work on one issue at a time.
   - Keep the branch focused on the issue or a tightly scoped prerequisite.
   - Run the smallest relevant static checks, then broaden when touching shared state, navigation, storage, startup, sync, or sensitive areas.
3. Mobile verification loop.
   - Start the required local runtime and execute the selected smoke paths in `docs/agents/smoke-tests.md`.
   - Use `serve-sim` or equivalent simulator/device tooling for user-facing changes.
   - Record screenshots, logs, or a concise evidence note before PR readiness.
4. Fix loop.
   - If mobile smoke fails, fix on the same branch and rerun the relevant checks.
   - Do not open or advance the PR just because static checks passed.
5. PR readiness.
   - A mobile PR can be opened or advanced only after required mobile smoke paths pass, or when the change is documented as non-runtime and non-user-facing.

Parallel mobile work is allowed only if every lane has an independent implementation state and a credible independent mobile verification loop before PR readiness. If that cannot be provided, use `mobile-sequential`.

## PR Gates

The first hosted PR gate is `.github/workflows/pr-checks.yml`.

Required checks:

- `yarn typecheck`
- `yarn lint`
- `yarn test`
- `yarn format:check`

These checks are intentionally JavaScript-only. Native EAS builds, simulator smoke checks, Firebase-backed sync tests, and app store release validation are separate gates because they need credentials, installed simulator assets, or expensive external resources.

Use `.github/pull_request_template.md` for PR descriptions. Do not delete sections that are not applicable; mark them as not needed and explain why when the change touches user-facing behavior or sensitive areas.

For mobile changes, the hosted PR gate is not enough to mark the PR ready for review. Use the mobile validation section in the PR template to record whether simulator smoke passed or is not needed because the change is non-runtime and non-user-facing.

Branch protection is enabled on `master` with the `Typecheck, lint, test, format` check required before merge.

The canonical GitHub labels from `docs/agents/triage-labels.md` have been verified on the remote repository.

## Sensitive Area Escalation

Use `docs/agents/sensitive-areas.md` before changing authentication, account data, Firestore sync, local migrations, backup/import/export, build identity, native config, or external services.

For sensitive changes, PRs must include:

- exact sensitive area touched;
- environment used for validation;
- explicit note when production, staging, or account-backed validation was not run;
- rollback or mitigation notes when user data could be affected.

## Release And Build Boundaries

Local code checks do not prove release readiness.

Run EAS build checks only when the change affects native config, Expo plugins, Firebase service files, app identity, update channels, audio background modes, native dependencies, or release behavior.

Use the build commands in `docs/agents/validation.md`. Do not run production builds or releases without explicit user intent.

EAS development-simulator validation is intentionally local. Do not add a hosted EAS workflow unless the owner explicitly changes this policy.

## Recurring Automation Candidates

These are candidates, not enabled automations:

- weekly dependency and Expo compatibility review;
- weekly open issue triage for `needs-triage`;
- smoke checklist refresh after navigation or Bible WebView changes;
- monthly harness doc drift check against `package.json` scripts.

Enable recurring automation only after the owner chooses cadence, notification destination, and expected output.

## Level 2 Remaining Work

- Decide whether to add scheduled maintenance automations.
- Exercise the PR gate on a real pull request and adjust the required check context if GitHub reports a different check-run name.
- Exercise `agents:issue:pr` on a real issue branch and refine PR body generation from stable `.scratch/issues/<issue>/` evidence.
- Revisit Sandcastle only if a future workflow provides a real parallel verification loop for the relevant surface.
