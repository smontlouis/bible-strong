---
name: orchestrate-ready-issues
description: Sequentially orchestrate GitHub issues labeled ready-for-agent through the Bible Strong harness. Use when the user asks to run, drain, process, or coordinate ready-for-agent issues, or asks for an agent orchestrator for issue-to-PR work.
---

# Orchestrate Ready Issues

Run the Bible Strong issue harness as a sequential orchestrator. Do not parallelize issue work unless the user explicitly changes the repo policy.

## Source of truth

Read these before acting:

- `docs/agents/orchestration.md`
- `docs/agents/issue-tracker.md`
- `docs/agents/triage-labels.md`
- `docs/agents/validation.md`
- `docs/agents/smoke-tests.md` for mobile or UI-facing changes
- `docs/agents/sensitive-areas.md` when an issue touches auth, sync, storage, backup/import/export, native config, releases, external services, or user-owned data

## Operating mode

Use `mobile-sequential`:

- one issue at a time;
- one dedicated `codex/issue-<number>-<slug>` branch per issue;
- current worktree only, no per-issue worktree by default;
- PRs are ready for review by default;
- use draft PRs only when validation is blocked or intentionally deferred;
- never continue to the next issue from a dirty or ambiguous repo state.

## Queue discovery

List ready issues with GitHub CLI:

```bash
gh issue list --state open --label ready-for-agent --json number,title,labels,updatedAt --limit 50
```

If the user named specific issue numbers, treat those numbers as the initial queue roots. Otherwise, process all open `ready-for-agent` issues in ascending issue number unless the user gives a different priority.

## Sub-issues and dependency discovery

Before starting implementation, expand each queue root into an execution queue.

1. Fetch the issue root:

```bash
gh issue view <issue-number> --comments --json number,title,body,labels,state,url
```

2. Check whether the root has GitHub sub-issues. Prefer GraphQL because the local `gh issue view --json` fields may not expose hierarchy:

```bash
gh api graphql \
  -F owner='<owner>' \
  -F repo='<repo>' \
  -F number=<issue-number> \
  -f query='
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $number) {
          number
          title
          state
          url
          labels(first: 50) { nodes { name } }
          parent { number title state url labels(first: 50) { nodes { name } } }
          subIssues(first: 100) {
            nodes {
              number
              title
              state
              url
              labels(first: 50) { nodes { name } }
            }
          }
        }
      }
    }'
```

If this GraphQL query is rejected because the GitHub schema or token does not expose issue hierarchy, fall back to the issue body and comments. Look for explicit task lists or references such as `Sub-issues`, `Sub issues`, `Children`, `Depends on`, `Blocked by`, `#123`, or full GitHub issue URLs. Treat body/comment references as candidates and verify each candidate issue with `gh issue view` before adding it.

3. Check native issue dependencies for every queue candidate:

```bash
gh api repos/<owner>/<repo>/issues/<issue-number>/dependencies/blocked_by --paginate
gh api repos/<owner>/<repo>/issues/<issue-number>/dependencies/blocking --paginate
```

If dependency endpoints are unavailable for the repository or token, fall back to body/comment references using `blocked by`, `depends on`, `after`, `before`, and `blocking` language. Clearly report that dependency discovery used the fallback.

4. Build the execution queue:

- If a root issue has open sub-issues, process the open sub-issues instead of the root implementation issue, unless the root also has its own explicit implementation checklist.
- Process dependency blockers before blocked issues.
- For sibling sub-issues without dependencies, process in ascending issue number unless the root issue or user gives a different priority.
- Include only issues that are open and labeled `ready-for-agent`. Skip sub-issues that are closed, missing `ready-for-agent`, labeled `needs-info`, labeled `ready-for-human`, or blocked by unresolved dependencies outside the queue.
- If an issue is blocked by another open issue that is not `ready-for-agent`, stop before implementation and report the blocker instead of working around it.
- If an issue is a parent/epic issue with sub-issues, do not run `yarn agents:issue:run` on the parent until all required sub-issues are completed or the parent has explicit remaining implementation work.
- Never process both a parent issue and its sub-issues as duplicate work in the same run.

Before starting, report the planned queue briefly. Do not ask for approval unless the user requested a dry run or the repo state is risky.

## Preflight

Before each issue:

1. Check `git status --short`.
2. If dirty, stop and report the files unless the user explicitly allowed `--allow-dirty`.
3. Fetch the issue details if needed:

```bash
gh issue view <issue-number> --comments
```

4. Confirm the issue still has `ready-for-agent`. If it does not, skip it and report why.

## Run one issue

Use the repo wrapper. Do not reimplement branch, commit, or PR creation manually.

```bash
yarn agents:issue:run <issue-number>
```

Allowed overrides:

- `--dry-run` when the user asks for a plan or simulation only.
- `--draft` when validation is blocked or intentionally deferred.
- `--no-pr` when the user explicitly wants implementation without PR publication.
- `--codex-sandbox workspace-write` for static-only issues where host-level simulator access is not needed.
- `--allow-dirty` only when the user explicitly accepts the current dirty state.

The wrapper is expected to create branch, run Codex, commit tracked repo changes, push, attach evidence when present, and create a ready PR by default.

## Failure handling

If `agents:issue:run` fails:

1. Do not start another issue.
2. Summarize the failed step and the issue number.
3. Check whether `.scratch/issues/<issue-number>/mobile-validation.md`, `codex-final.md`, `change-summary.md`, or `pr-notes.md` explains the blocker.
4. If the issue is blocked by missing info or policy, suggest moving it out of `ready-for-agent`; do not change labels unless the user asked you to manage labels.
5. Leave the repo state visible with `git status --short`.

## Completion report

At the end, report:

- issues processed;
- PR URLs or branch names created;
- issues skipped and why;
- validation status;
- any dirty worktree state;
- recommended next human action, if any.

Keep the report short and factual.
