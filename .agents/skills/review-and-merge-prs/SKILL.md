---
name: review-and-merge-prs
description: Sequentially review and merge GitHub pull requests one at a time. Use when the user asks to process PRs by checking out each PR, running checks, preparing simulator/manual test instructions, waiting for explicit validation, then merging before moving to the next PR.
---

# Review And Merge PRs

Process PRs as a sequential human-in-the-loop merge gate. Work on one PR, make it ready for manual testing, stop for maintainer validation, merge only after approval, then move to the next PR.

## Core rule

Do not merge a PR or start deep work on the next PR until the user explicitly validates the current PR in the current conversation. A prior request to review, check, pull, rebase, prepare, or "start" PRs is not merge approval.

Approval must be specific enough to mean the maintainer tested or accepts the current PR, for example: "ok merge", "validé", "merge celle-ci", or "c'est bon pour la #123".

## Source of truth

Read these when relevant:

- `docs/agents/validation.md`
- `docs/agents/smoke-tests.md` for UI, mobile, navigation, WebView, audio, sync, download, or data-flow changes
- `docs/agents/sensitive-areas.md` for auth, sync, storage, backup/import/export, native config, releases, external services, or user-owned data
- `CONTEXT.md` and relevant `docs/adr/` files when the PR changes domain behavior or architecture

## Inputs

If the user names PR numbers, inspect only those PRs. Otherwise, inspect open PRs targeting `master`.

Build a lightweight queue first. Do not checkout every PR before processing the first one.

```bash
gh pr list --state open --base master --json number,title,headRefName,baseRefName,isDraft,mergeStateStatus,reviewDecision,statusCheckRollup,updatedAt,url
```

Default queue order:

1. PRs named by the user, in the order given.
2. Otherwise, open non-draft PRs targeting `master`, oldest first unless the user asks for a different priority.

Before starting the first PR, briefly report the queue and say which PR is first.

## Per-PR cycle

Repeat this cycle for exactly one PR at a time.

### 1. Checkout and update

Fetch and inspect the current PR:

```bash
gh pr view <number> --json number,title,body,url,headRefName,baseRefName,isDraft,mergeStateStatus,reviewDecision,comments,reviews,statusCheckRollup,files,commits
gh api repos/smontlouis/bible-strong/pulls/<number>/comments --paginate
```

Then check it out:

```bash
gh pr checkout <number>
```

If the PR is behind `origin/master`, rebase it before asking the maintainer to test:

```bash
git fetch origin master
git rebase origin/master
```

If the rebase changes the branch, run validation and push the rebased branch:

```bash
git push --force-with-lease
```

### 2. Review and fix blockers

Inspect the diff against the target base:

```bash
git diff --stat origin/master...HEAD
git diff --name-only origin/master...HEAD
git diff origin/master...HEAD
```

Identify and resolve, before the manual test handoff:

- merge conflicts;
- red or missing checks that can be reproduced locally;
- action-worthy review comments;
- obvious regressions found in the diff;
- stale generated docs or validation artifacts that would create avoidable conflicts.

If a fix is needed, implement it on the PR branch, run relevant validation, commit, push, and mention the new commit in the handoff.

### 3. Run automated checks

Run the smallest useful validation set for the PR:

- focused ESLint for touched code;
- `yarn format:check` when formatting-sensitive files changed;
- `yarn typecheck` for TypeScript, navigation params, Redux, Jotai, helper, or shared API changes;
- focused `yarn test ...` for touched tests or helpers;
- resource checks such as CDN `curl -I -L` or generator commands when the PR changes downloadable resources.

Use full `yarn lint`, `yarn test`, or broader agent checks only when the change scope justifies it or focused checks are insufficient.

### 4. Handoff for manual testing

Stop after the current PR is ready to test. Do not merge and do not move to the next PR.

Give the maintainer a concise handoff:

- PR number, title, and URL;
- branch currently checked out;
- what changed in product terms;
- automated checks run and their result;
- review comments handled or still open;
- risk level and reason;
- exact simulator/manual test checklist;
- explicit next instruction: ask the maintainer to test and reply with approval to merge, or describe what failed.

Do not claim mobile behavior is verified unless you actually ran a simulator/emulator or inspected a real device flow. If simulator testing is expected from the maintainer, say that clearly.

## Preflight

Before starting or switching PRs:

1. Run `git status --short`.
2. If the worktree is dirty, stop and report the files unless the user explicitly allowed continuing with the dirty state.
3. Fetch the latest refs:

```bash
git fetch origin master
```

## Merge after approval

Only after explicit user approval for the current PR:

1. Re-check the worktree is clean.
2. Update `master`:

```bash
git checkout master
git pull --ff-only origin master
```

3. Re-check the approved PR:
   - check out the PR branch again if needed;
   - rebase on `origin/master` if `master` changed since the handoff;
   - resolve conflicts without discarding unrelated user changes;
   - rerun the relevant local validation if the branch changed;
   - force-push only if the branch was rebased;
   - confirm GitHub checks are green.

Prefer GitHub CLI merge commands over manual local merges:

```bash
gh pr merge <number> --squash --delete-branch
```

If the repo clearly uses a different merge strategy for the active PR set, follow that strategy and say so.

After the merge:

1. Fetch and update local `master`.
2. Report the merge result.
3. Return to the queue and start the next PR's per-PR cycle, unless the user asked to stop.

## Stop conditions

Stop and report instead of asking for manual testing or merging when:

- CI is red or missing for the PR head;
- the PR is draft;
- merge conflicts require product judgment;
- review comments are action-worthy and unresolved;
- local validation fails;
- a sensitive area changed without clear validation evidence;
- the user has not explicitly approved merging.

If the maintainer rejects the PR during manual testing, do not merge. Either fix the issue on the PR branch and produce a new handoff, or skip the PR if the maintainer asks to move on.

## Final report

After all approved PRs have been merged, or when stopping, report:

- PRs merged, with URLs;
- PRs left open and why;
- current branch;
- validation run locally for the current or last processed PR;
- GitHub checks status;
- remaining manual tests or next PR in the queue, if any.
