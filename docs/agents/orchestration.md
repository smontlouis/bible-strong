# Agent Orchestration

How agent work moves from a request or an issue to `master`.

## Two ways to land a change

- **Work done in the main checkout goes straight to `master`**: commit and push, no feature branch, no pull request, unless the owner asks for one. The main checkout is shared by several sessions: leave other sessions' uncommitted work alone and stage paths only in the command that commits them.
- **Work started with the `/issue` skill goes through a lane and a pull request** to `master`.

GitHub Issues stay the source of truth for tracked work (`docs/agents/issue-tracker.md`, labels in `docs/agents/triage-labels.md`).

## Issue lanes (`/issue`)

The `/issue` skill (`.claude/skills/issue/SKILL.md`) carries one issue end to end. Each lane has:

- its own worktree in `.claude/worktrees/<slug>` on branch `issue/<slug>`, created from `origin/master`, with a full `yarn install` and copies of the ignored `.env*` files;
- its own iOS simulator `bs-<slug>`, cloned from the shut-down template `bs-template` (signed in, slim), with the newest dev client from `~/Builds/bible-strong/` installed over it;
- its own Metro on a dedicated port (8082 and up; 8081 stays with the main checkout).

Android lanes (`/issue … --android`) use the PC's shared emulator, so only one Android lane runs at a time. `.claude/skills/issue/scripts/lane.mjs` creates, reports and removes lanes, and keeps the simulator builds in `~/Builds/bible-strong/` (`save-build`, `template --refresh`). The skill describes the steps: frame the issue, discuss the approach before coding, implement, test on the device, open the pull request. UI evidence stays with the agent session and is not attached to the pull request.

## Parallel work

When several agents work at once, split them by disjoint ownership before implementation starts:

- one feature directory under `apps/expo/src/features/`;
- one shared module under `src/common/`, `src/helpers/`, `src/redux/` or `src/state/`;
- documentation-only changes under `docs/`;
- one native or build configuration area such as `app.config.ts`, `eas.json` or the Firebase config paths.

Avoid giving two agents the same files or tightly coupled Redux and UI behavior unless one of them owns the integration.

## PR gate

`.github/workflows/pr-checks.yml` runs on every pull request to `master`: typecheck, the Resource architecture check, migrations, Resource service and PostgreSQL integration tests, lint, tests, format check and the agent architecture check. Branch protection requires it before merge.

These checks are JavaScript-only. Native builds, simulator smoke paths, Firebase-backed sync and store releases are separate gates because they need credentials, simulator assets or paid resources. A mobile pull request records its device validation in the mobile validation section of `.github/pull_request_template.md`: device, scenario, result, and what could not be checked. Keep every section of the template and mark the ones that don't apply as not needed.

## Sensitive areas

Read `docs/agents/sensitive-areas.md` before changing authentication, account data, Firestore sync, local migrations, backup/import/export, build identity, native config or external services. For such a change, the pull request or the commit report names the area touched, the environment used for validation, what was not validated against production, staging or a real account, and the rollback or mitigation when user data could be affected.

## Builds and releases

Local checks do not prove release readiness. A native build is needed only when the change touches native config, Expo plugins, Firebase service files, app identity, update channels, audio background modes, native dependencies or release behavior. Builds, OTA updates and store releases are the owner's decision: never start one without being asked. Build commands are in `docs/agents/validation.md` and `docs/dev-guide.md`.
