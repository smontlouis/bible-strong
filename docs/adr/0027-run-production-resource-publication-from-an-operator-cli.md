# ADR-0027: Run production resource publication from an operator CLI

## Status

Accepted

## Context

ADR-0010 initially placed production publication credentials in protected CI. Bible Strong is
currently operated by one publisher, and maintaining a GitHub Actions runner, environment, and
automatic repository push adds operational complexity without adding a separate human approval.
The publication workflow already has exhaustive catalog validation, differential additive immutable R2 writes, live
baseline checks, post-deployment smoke tests, and compensation for Neon and Worker activation.

## Decision

Production publication runs from the versioned local CLI. Candidate generation remains the default
and performs no production writes. Live activation requires both `--activate-production` and the
exact `--confirm-production bible-strong.app` confirmation. Production credentials live only in the
gitignored `.env.resource-publication.local` file or the operator's authenticated Wrangler session.
The operator enters the confirmation value for each run. Before live preflight, the CLI requires a
clean tracked and untracked worktree so Wrangler cannot deploy unrelated local code, and it holds a
Neon advisory lock through activation and compensation so two publications cannot interleave. The
clean `master` checkout must also match the freshly fetched `origin/master` revision.

Ordinary releases publish only the bundles selected as changed by the validated overlay. The full
catalog remains checked and deployed atomically, while exhaustive R2 traversal is reserved for an
explicit bucket bootstrap or storage audit.

The CLI never commits or pushes Git changes. After a successful publication it leaves the deployed
mobile catalog modified in the working tree and retains the complete workspace, including the
previous catalog and verified 72-bundle baseline. The operator reviews and commits the catalog using
the normal repository workflow and retains the baseline for the next publication.

## Consequences

The operator can publish end to end without GitHub Actions. A clean checked-in catalog is still a
preflight requirement, preventing accidental overwrite of uncommitted code or catalog edits. A failed step
after Neon activation restores the previous Neon publications and Worker catalog; immutable R2
objects remain additive recovery material. Local credentials and workspaces must be protected and
must never be committed.
