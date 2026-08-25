# ADR-0032: Adopt a Yarn workspace monorepo

- Status: Accepted
- Date: 2026-08-25

## Context

Bible Strong was split across several repositories while the mobile repository also contained the Resource service and the selected Bible-reference parser as embedded source. Coordinated changes required duplicated setup, inconsistent package naming, and cross-repository documentation that could not describe the whole system.

The mobile application also relies on seven Yarn patches. A workspace migration must preserve their resolution and must not silently replace patched dependencies with unpatched releases.

## Decision

The existing Bible Strong repository becomes a Yarn 4 monorepo with one root `yarn.lock`.

Deployable or independently runnable products live under `apps/`:

- `apps/mobile` — `@bible-strong/mobile`
- `apps/web` — `@bible-strong/web`
- `apps/api` — `@bible-strong/api`; its Firebase functions workspace is `@bible-strong/api-functions`
- `apps/lexicon-editor` — `@bible-strong/lexicon-editor`

Shared or service packages live under `packages/`:

- `packages/resource-service` — `@bible-strong/resource-service`
- `packages/bible-reference-parser` — `@bible-strong/bible-reference-parser`

The external repositories are imported with their complete Git histories. Yarn patches remain under root `.yarn/patches`; their `patch:` references and any supporting root resolutions are part of the same dependency contract as the lockfile.

The `node-modules` linker limits hoisting to workspace boundaries. This prevents incompatible React, Next.js, Expo, and tooling dependency trees from leaking between applications while retaining conventional `node_modules` behavior.

The Resource service still consumes several mobile resource contracts during this structural migration. That dependency is made explicit and is transitional. Extracting those contracts into a neutral shared package requires a separate boundary decision and is not hidden inside this move.

The repository uses a root `CONTEXT-MAP.md` and one glossary-only `CONTEXT.md` per bounded context. System-wide decisions live under root `docs/adr/`.

## Consequences

- Installation and dependency resolution happen once from the repository root.
- Workspace commands and CI must address the new paths and scoped package names.
- Subproject lockfiles are removed.
- A patched dependency update must update the manifest resolution, patch file, and root lockfile together, followed by an immutable install check.
- Application histories remain inspectable with normal Git history traversal.
- The temporary Resource-service-to-mobile dependency is visible and can be removed through a future contract-extraction change.
