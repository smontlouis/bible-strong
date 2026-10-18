---
name: issue
description: Carry one Bible Strong issue end to end in its own lane — a git worktree with a full install, a simulator cloned from bs-template (or the PC's Android emulator with --android), a Metro on a dedicated port — then discuss the approach with the user, implement, test on the device with screenshots, and open a PR to master. Use when the user types /issue or asks to start work on an issue this way.
argument-hint: "<issue number | issue URL | short description> [--android]"
---

# /issue

One issue = one lane: its own worktree, its own simulator, its own Metro. Several lanes can run at once.

All lane plumbing goes through one script. Define it once per shell command (it resolves to the main checkout, so it works from inside a worktree too):

```bash
LANE="$(git rev-parse --path-format=absolute --git-common-dir)/../.claude/skills/issue/scripts/lane.mjs"
```

Subcommands: `template`, `start`, `worktree`, `install`, `device`, `metro`, `open`, `status`, `stop`, `cleanup`. `node "$LANE"` prints the help. Lane state lives in `~/.cache/bible-strong-issues/<slug>.json` (worktree, branch, `simUdid`, `port`, Metro log).

## 1. Frame the issue

- Arguments: an issue number or URL → `gh issue view <n> --comments --json number,title,body,labels,url,state`. Free text → that text is the issue. `--android` → Android lane; iOS by default.
- Slug: `<number>-<3-5 words of the title>` for a GitHub issue, else 3-5 words of the text, kebab-case ASCII. Branch: `issue/<slug>`.
- `node "$LANE" status`: another lane with this slug means resume it (skip to the step it reached) instead of creating a new one.
- iOS only: if `bs-template` does not exist (`xcrun simctl list devices | grep bs-template`), stop and ask the user before running `node "$LANE" template`. It clones the booted iPhone (signed in, slim) into a shut-down template, and **shuts that simulator down for a moment**. That is done once, and again only when the user wants a fresher template.
- Android only: the PC emulator is shared, so only one Android lane at a time. If `status` shows another Android lane with Metro running, say so and ask.

## 2. Open the lane

1. `node "$LANE" worktree <slug>` (foreground, a few seconds): creates `.claude/worktrees/<slug>` from `origin/master` and copies the ignored `.env*` files.
2. Switch the session into it: `EnterWorktree` with `path` = the printed worktree path. From now on every edit happens in the worktree, never in the main checkout (other sessions use it).
3. Start the rest **in the background** (Bash `run_in_background`): `node "$LANE" start <slug> [--android]`. It is idempotent: the full `yarn install` (several minutes, about 7.5 GB), the simulator clone `bs-<slug>` with the newest dev client from `~/Builds/bible-strong/` installed over it (app data kept), Metro on the first free port from 8082, then the app opened on it. It ends with `[lane] PRÊT` and the state JSON.
4. Don't wait for it: go to step 3 now. When it finishes, read its output. Every `ATTENTION` line about the dev client (runtime mismatch, native files changed since the build) goes to the user: building a new dev client is their call, never start one unasked.

## 3. Discuss before coding

The user's rule: no code before their go.

- Read `AGENTS.md`, `CONTEXT-MAP.md`, the `CONTEXT.md` of every app or package touched, `apps/expo/AGENTS.md` for the app, the relevant ADRs, and `docs/agents/sensitive-areas.md` when auth, sync, storage, backup, native config or build identity is involved.
- Explore the code read-only (subagents are fine for wide sweeps).
- Then write to the user: your understanding of the issue, the approach (plus alternatives when they really differ), risks and trade-offs, **the test plan on the device** (screens, steps, what the screenshots must show), and your questions.
- Wait for "go", "vas-y", "fais-le" or similar. Adjust and re-propose if they push back.

## 4. Implement

- Work in the worktree, following the repo conventions (`AGENTS.md`, nested `AGENTS.md`, your memory notes on eslint-disable and `==`).
- Use `yarn expo …`, never `npx expo …`.
- JS changes reach the device through Metro's Fast Refresh. A native change (dependency with native code, config plugin, `app.config.ts`, `apps/expo/modules`) needs a new dev client: stop and tell the user (iOS build recipe in your project memory; Android: `ANDROID_PC_REPO=<worktree> android-pc build && android-pc install`).

## 5. Test on the device

Wait for `[lane] PRÊT` (or `node "$LANE" status`). Then:

- Load `argent-device-interact` and `argent-react-native-app-workflow` before the first device call.
- iOS: argent tools (`mcp__argent__*`), device = the lane's `simUdid`. Android: `mcp__argent-android__*`, device `emulator-5554`.
- Metro debugger: `debugger-connect` with `port` = the lane's port. Pass the device id explicitly: several simulators can be booted, so never pick "the booted one".
- App not on Metro or showing the dev launcher: `node "$LANE" open <slug>`. Metro died: `node "$LANE" metro <slug>`, then `open`. Metro log: the `metroLog` path in the state.
- Run the test plan agreed in step 3, plus the relevant smoke paths of `docs/agents/smoke-tests.md`.
- Screenshots: take them with argent at the meaningful moments (result after the change, edge cases, errors). Copy the ones that prove the result into `apps/expo/.scratch/issue/` of the worktree (git-ignored), with names that say what they show, and show them to the user with `SendUserFile`. They stay with the agent: **not** in the PR.
- Static checks per `docs/agents/validation.md` for the touched workspaces. For the Expo app: `yarn workspace @bible-strong/expo typecheck`, `yarn workspace @bible-strong/expo lint`, and the **whole** Jest suite (`apps/expo/node_modules/.bin/jest`, about 80 s) before saying tests pass.
- Known limits, to state rather than fight:
  - App Check fails in the simulator: the study assistant, dictation and Offline copies can't be exercised for real.
  - The simulator keyboard is AZERTY: drive with taps or `debugger-evaluate`, not typed words.
  - Never sign in with the user's credentials. The clone inherits the template's session.
  - The template is slim: push, StoreKit and universal links are off.
- Failure → fix in the worktree and re-run. Report faithfully what passed, failed or could not be checked.

## 6. Open the PR

1. Show the user: a short summary of the diff, the commit message (Conventional Commits, lowercase, imperative, no mention of Claude), and the PR title and body. Ask for one go before pushing.
2. Commit in the worktree. Never commit `.yarn/install-state.gz` (unless `yarn.lock` changed on purpose), any `.env*` file, or `apps/expo/.scratch/`. Add the commit attribution lines the session asks for.
3. `git push -u origin issue/<slug>`.
4. `gh pr create --base master --head issue/<slug> --title "<title>" --body-file <file>`. Base the body on `.github/pull_request_template.md`: keep every section, mark the ones that don't apply as not needed, and say why. Mobile validation in words: device, scenario, result, what couldn't be checked. No screenshots. `Closes #<n>` for a GitHub issue. End with the PR attribution line the session asks for.
5. Bind the PR with the app's ccd_pr tools (`get_status`, then `bind_pr`) and give the user the link.

## 7. Close the lane

The lane stays up while the PR is under review (fixes go in the same worktree, then push).

After merge, or when the user drops the issue:

- `ExitWorktree` with `action: "keep"`: the script owns the removal.
- `node "$LANE" cleanup <slug>`: stops Metro (and the Android tunnel), deletes `bs-<slug>`, removes the worktree. It refuses a worktree with uncommitted changes: show them to the user, and only pass `--force` if the user says to drop them. The branch is kept.
- Stop the argent simulator server of the lane's device (`stop-simulator-server` / `stop-all-simulator-servers` with `devices: [<simUdid>]`, never unscoped).
