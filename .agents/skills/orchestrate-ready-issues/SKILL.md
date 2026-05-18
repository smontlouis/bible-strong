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

If the user named specific issue numbers, process only those numbers. Otherwise, process all open `ready-for-agent` issues in ascending issue number unless the user gives a different priority.

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
