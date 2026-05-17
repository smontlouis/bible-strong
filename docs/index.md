# Documentation Index

This directory is the repo-level reference set for agents and humans working on Bible Strong.

## Start Here

| Document | Purpose |
|---|---|
| `../CONTEXT.md` | Product/domain context, glossary, and invariants. |
| `architecture.md` | System architecture and cross-cutting flows. |
| `app-flows.md` | Detailed product flows, screens, states, and route inventory. |
| `assets/app-flows/dist/index.html` | Built React Flow app flow map with pan, zoom, drag, curated-flow filters, inventory filters, thumbnails, and detail panel. |
| `assets/app-flows/data/curated-flows.json` | Manual source of product surfaces, user flows, and explicit transitions between captures. |
| `assets/app-flows/data/app-flows.json` | Structured app-flow graph generated from the screenshot manifest and curated flows. |
| `assets/app-flows/data/screenshots.json` | Versioned screenshot manifest for visual and agent-consumable flow mapping. |
| `assets/app-flows/capture-notes.md` | Argent capture notes, limitations, state mutations, and remaining capture targets. |
| `source-tree.md` | Annotated map of important folders and files. |
| `dev-guide.md` | Setup, scripts, simulator workflow, and validation. |
| `data-models.md` | Persisted state, local databases, Firestore sync, and identifiers. |
| `conventions.md` | Coding conventions and project-specific rules. |

## Agent-Specific Docs

| Document | Purpose |
|---|---|
| `agents/harness-readiness.md` | Current readiness level and gaps. |
| `agents/harness-report/index.html` | Self-contained human report hub with dashboard and links to full readiness, validation, quality, risk, observability, commands, Level 2, and decisions pages. |
| `agents/validation.md` | Canonical checks before finishing work. |
| `agents/smoke-tests.md` | Manual/mobile smoke paths and evidence expectations. |
| `agents/sensitive-areas.md` | Areas requiring extra care or explicit approval. |
| `agents/observability.md` | Error reporting and debugging signals. |
| `agents/issue-tracker.md` | Issue tracker configuration. |
| `agents/triage-labels.md` | Canonical triage labels. |
| `agents/domain.md` | How agents should consume domain docs. |

## Decision Records

ADRs live in `adr/`. Do not invent ADRs retroactively; add one when a new durable engineering decision is made or when an existing implicit decision is confirmed.
