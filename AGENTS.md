# Bible Strong Monorepo

This repository is the shared Yarn workspace for Bible Strong products and supporting packages.

## Read context first

1. Read `CONTEXT-MAP.md`.
2. Read the `CONTEXT.md` belonging to every app or package in scope.
3. Read relevant system ADRs under `docs/adr/` and any local ADRs next to the affected context.

`CONTEXT.md` files are glossaries. Keep implementation details in normal documentation or ADRs.

## Workspace layout

- `apps/expo` — multiplatform Expo application for iOS, Android, and Web (`@bible-strong/expo`).
- `apps/site` — public TanStack Start site (`@bible-strong/site`).
- `apps/world` — explorable illustrated world with multiplayer and games (`@bible-strong/world`).
- `apps/api` — API workspace and Firebase functions (`@bible-strong/api-functions`).
- `apps/resource-studio` — resource authoring application and workflows (`@bible-strong/resource-studio`).
- `packages/resource-service` — resource publication and delivery service.
- `packages/resource-domain` — shared resource schemas, identities, and invariants.
- `packages/resource-catalog` — generated catalog of published artifacts.
- `packages/bible-reference-parser` — Bible passage reference parser.
- `packages/ai-contract` — public API contract of the separately hosted study assistant.

App-specific instructions live in nested `AGENTS.md` files. In particular, read `apps/expo/AGENTS.md` before changing the Expo app and `apps/world/AGENTS.md` before changing World.

## Essential commands

```bash
yarn install
yarn typecheck
yarn lint
yarn test
yarn build
```

Start one product from the root with `yarn dev:expo`, `yarn dev:site`, `yarn dev:world`, `yarn dev:api`, `yarn dev:studio`, or `yarn dev:resources`. Resource-authoring commands use the `resources:<domain>:<action>` prefix; production import, upload, and activation remain owned by the Resource service. Run a workspace-specific command with `yarn workspace <package-name> <script>`.

## Dependency rules

- Keep one root `yarn.lock`; do not add workspace lockfiles.
- Keep Yarn patches under root `.yarn/patches` and preserve `patch:` resolutions when changing affected dependencies.
- Use `workspace:*` for dependencies between workspaces when the consumer is intended to resolve the local package.
- Do not move source across contexts merely to bypass a dependency boundary. Record durable boundary changes in an ADR.
- Preserve imported repository history when reorganizing existing applications.

## Validation

Use `docs/agents/validation.md` for the canonical validation matrix. At minimum, validate the workspaces touched by a change. Run root-wide checks for dependency, lockfile, shared package, or workspace configuration changes.
