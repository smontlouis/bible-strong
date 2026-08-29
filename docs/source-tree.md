# Source Tree

## Monorepo root

| Path | Purpose |
|---|---|
| `apps/` | Independently runnable Bible Strong products. |
| `packages/` | Shared libraries and backend/resource packages. |
| `docs/` | System documentation, ADRs, mobile architecture, and agent guidance. |
| `scripts/` | Repository-wide agent and quality scripts. |
| `.yarn/patches/` | Versioned Yarn patches used by workspace dependencies. |
| `.agents/skills/` | Repository-local Codex skills. |
| `CONTEXT-MAP.md` | Map from system concerns to bounded-context glossaries. |
| `package.json` | Root workspace commands and cross-workspace resolutions. |
| `yarn.lock` | The only dependency lockfile in the repository. |

## Applications

| Path | Package | Purpose |
|---|---|---|
| `apps/mobile/` | `@bible-strong/mobile` | Expo/React Native Bible reading and study application. |
| `apps/web/` | `@bible-strong/web` | Browser Bible Strong experience. |
| `apps/api/` | `@bible-strong/api` | API workspace and Firebase deployment boundary. |
| `apps/api/functions/` | `@bible-strong/api-functions` | Firebase Functions implementation. |
| `apps/resource-studio/` | `@bible-strong/resource-studio` | Editorial UI and authoring workflows for every Bible Strong resource family. |

Resource Studio keeps one workflow per Resource family. The complete commentary workflow and its
local reader live under `apps/resource-studio/workflows/commentaries/`; documentation under `docs/`
records audits and decisions but does not own production generators.

## Packages

| Path | Package | Purpose |
|---|---|---|
| `packages/resource-service/` | `@bible-strong/resource-service` | Resource validation, publication, import, storage, and delivery. |
| `packages/resource-domain/` | `@bible-strong/resource-domain` | Platform-neutral resource schemas, identities, cursors, and invariants. |
| `packages/resource-catalog/` | `@bible-strong/resource-catalog` | Generated artifact catalog and immutable publication metadata. |
| `packages/bible-reference-parser/` | `@bible-strong/bible-reference-parser` | French and English Bible passage parsing and OSIS conversion. |

## Mobile application

The mobile routes live in `apps/mobile/app/`; its feature, state, helper, theme, and shared UI code lives in `apps/mobile/src/`. Environment files, Expo configuration, Firebase configuration, native projects, and EAS profiles are also scoped to `apps/mobile/`.

Read `apps/mobile/AGENTS.md` before changing it. Detailed mobile architecture remains in `architecture.md`, `data-models.md`, `app-flows.md`, and `mobile-domain-reference.md`.

## Context and decisions

Each top-level app or package has a `CONTEXT.md` containing only its domain vocabulary. Begin at `CONTEXT-MAP.md`, then read relevant ADRs under `docs/adr/`. A context may add local ADRs under its own `docs/adr/` when a decision does not affect the rest of the system.
