---
name: review-and-merge-prs
description: Review open GitHub pull requests before merge. Use when the user asks to pull PRs, summarize what each PR does, identify what must be tested, evaluate review comments and CI, then merge only after explicit user validation.
---

# Review And Merge PRs

Review PRs as a merge gate: first produce a factual readiness report, then merge only after the maintainer explicitly approves.

## Core rule

Do not merge a PR until the user explicitly validates it in the current conversation. A prior request to review, check, pull, rebase, or prepare PRs is not merge approval.

## Source of truth

Read these when relevant:

- `docs/agents/validation.md`
- `docs/agents/smoke-tests.md` for UI, mobile, navigation, WebView, audio, sync, download, or data-flow changes
- `docs/agents/sensitive-areas.md` for auth, sync, storage, backup/import/export, native config, releases, external services, or user-owned data
- `CONTEXT.md` and relevant `docs/adr/` files when the PR changes domain behavior or architecture

## Inputs

If the user names PR numbers, inspect only those PRs. Otherwise, inspect open PRs targeting `master`.

Use GitHub CLI as the default interface:

```bash
gh pr list --state open --base master --json number,title,headRefName,baseRefName,isDraft,mergeStateStatus,reviewDecision,statusCheckRollup,updatedAt,url
```

For each PR:

```bash
gh pr view <number> --json number,title,body,url,headRefName,baseRefName,isDraft,mergeStateStatus,reviewDecision,comments,reviews,statusCheckRollup,files,commits
gh api repos/smontlouis/bible-strong/pulls/<number>/comments --paginate
```

## Preflight

Before checking out or rebasing:

1. Run `git status --short`.
2. If the worktree is dirty, stop and report the files unless the user explicitly allowed continuing with the dirty state.
3. Fetch the latest refs:

```bash
git fetch origin master
```

## Review one PR

For each PR:

1. Check out the branch:

```bash
gh pr checkout <number>
```

2. Inspect the diff against the target base:

```bash
git diff --stat origin/master...HEAD
git diff --name-only origin/master...HEAD
git diff origin/master...HEAD
```

3. Identify:
   - what changed, in product terms;
   - touched high-risk areas;
   - migrations, generated assets, data imports, or remote resources;
   - automated checks already passing or failing;
   - unresolved or action-worthy review comments;
   - manual tests the maintainer should run.

4. Run local validation when it is useful and scoped:
   - `yarn lint` or focused ESLint for code changes;
   - `yarn format:check` for formatting-sensitive changes;
   - `yarn typecheck` for TypeScript or API-shape changes;
   - focused `yarn test ...` for touched tests or helpers.

Do not claim mobile behavior is verified unless you actually ran a simulator/emulator or inspected a real device flow.

## Readiness report

Report PRs in a compact table or bullets. For each PR include:

- **Done**: what the PR changes.
- **Risk**: low / medium / high, with the reason.
- **Checks**: green / red / pending / not run, with notable failures.
- **Review comments**: none / needs action / informational.
- **Manual tests**: concrete flows the maintainer should test.
- **Recommendation**: merge / rework / wait.

If any PR needs rework, say exactly why and what should change before merge.

## Merge after approval

Only after explicit user approval:

1. Re-check the worktree is clean.
2. Update `master`:

```bash
git checkout master
git pull --ff-only origin master
```

3. For each approved PR, in dependency order:
   - check out the PR branch;
   - rebase on `origin/master` when needed;
   - resolve conflicts without discarding unrelated user changes;
   - run relevant local validation;
   - force-push only if the branch was rebased;
   - confirm GitHub checks are green;
   - merge using the repository's existing merge style.

Prefer GitHub CLI merge commands over manual local merges:

```bash
gh pr merge <number> --squash --delete-branch
```

If the repo clearly uses a different merge strategy for the active PR set, follow that strategy and say so.

## After each merge

After a PR is merged:

1. Fetch `origin/master`.
2. Rebase remaining open PRs that depend on files or behavior changed by the merge.
3. Force-push rebased branches.
4. Wait for or re-check CI before recommending the next merge.

## Stop conditions

Stop and report instead of merging when:

- CI is red or missing for the PR head;
- the PR is draft;
- merge conflicts require product judgment;
- review comments are action-worthy and unresolved;
- local validation fails;
- a sensitive area changed without clear validation evidence;
- the user has not explicitly approved merging.

## Final report

When done, report:

- PRs merged, with URLs;
- PRs left open and why;
- branches rebased or force-pushed;
- validation run locally;
- GitHub checks status;
- remaining manual tests, if any.
