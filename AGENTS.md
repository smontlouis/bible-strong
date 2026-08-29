# Bible Strong Monorepo

This repository is the shared Yarn workspace for Bible Strong products and supporting packages.

## Read context first

1. Read `CONTEXT-MAP.md`.
2. Read the `CONTEXT.md` belonging to every app or package in scope.
3. Read relevant system ADRs under `docs/adr/` and any local ADRs next to the affected context.

`CONTEXT.md` files are glossaries. Keep implementation details in normal documentation or ADRs.

## Workspace layout

- `apps/mobile` — Expo/React Native application (`@bible-strong/mobile`).
- `apps/web` — web application (`@bible-strong/web`).
- `apps/api` — API workspace and Firebase functions (`@bible-strong/api-functions`).
- `apps/resource-studio` — resource authoring application and workflows (`@bible-strong/resource-studio`).
- `packages/resource-service` — resource publication and delivery service.
- `packages/bible-reference-parser` — Bible passage reference parser.

App-specific instructions live in nested `AGENTS.md` files. In particular, read `apps/mobile/AGENTS.md` before changing the mobile app.

## Essential commands

```bash
yarn install
yarn typecheck
yarn lint
yarn test
yarn build
```

Start one product from the root with `yarn dev:mobile`, `yarn dev:web`, `yarn dev:api`, `yarn dev:studio`, or `yarn dev:resources`. Resource-authoring commands use the `resources:<domain>:<action>` prefix; production import, upload, and activation remain owned by the Resource service. Run a workspace-specific command with `yarn workspace <package-name> <script>`.

## Dependency rules

- Keep one root `yarn.lock`; do not add workspace lockfiles.
- Keep Yarn patches under root `.yarn/patches` and preserve `patch:` resolutions when changing affected dependencies.
- Use `workspace:*` for dependencies between workspaces when the consumer is intended to resolve the local package.
- Do not move source across contexts merely to bypass a dependency boundary. Record durable boundary changes in an ADR.
- Preserve imported repository history when reorganizing existing applications.

## Validation

Use `docs/agents/validation.md` for the canonical validation matrix. At minimum, validate the workspaces touched by a change. Run root-wide checks for dependency, lockfile, shared package, or workspace configuration changes.
