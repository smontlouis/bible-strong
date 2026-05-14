# Agent Orchestration

This document defines the first Level 2 harness rules for coordinating agents, pull requests, and remote validation.

## Scope

Level 2 work begins from the Level 1 harness in `docs/agents/`. Level 1 remains the baseline for every agent task: read the relevant domain docs, use the canonical validation commands, respect sensitive areas, and run or document smoke checks for UI changes.

This first Level 2 pass covers:

- GitHub issue to branch to PR flow.
- PR validation gates.
- Multi-agent ownership rules.
- Release and build boundaries.

It does not automate releases, app store submission, production data operations, or account-backed destructive tests.

## Issue To PR Flow

Use GitHub Issues as the source of truth, as documented in `docs/agents/issue-tracker.md`.

1. Triage the issue with the labels in `docs/agents/triage-labels.md`.
2. Only start autonomous implementation when the issue is labeled `ready-for-agent` or the user explicitly assigns the task in chat.
3. Create branches with the `codex/` prefix unless the user asks for another name.
4. Keep each branch focused on one issue or one coherent patch batch.
5. Open PRs as drafts until local validation has run or any missing validation is clearly explained.

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
- smoke paths run or deferred;
- sensitive areas touched, if any.

## PR Gates

The first hosted PR gate is `.github/workflows/pr-checks.yml`.

Required checks:

- `yarn typecheck`
- `yarn lint`
- `yarn test`
- `yarn format:check`

These checks are intentionally JavaScript-only. Native EAS builds, simulator smoke checks, Firebase-backed sync tests, and app store release validation are separate gates because they need credentials, installed simulator assets, or expensive external resources.

Use `.github/pull_request_template.md` for PR descriptions. Do not delete sections that are not applicable; mark them as not needed and explain why when the change touches user-facing behavior or sensitive areas.

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
