# Bible Strong

Bible Strong is a Yarn 4 monorepo containing the product applications, editorial tooling, backend services, and shared Bible parsing packages.

## Workspace

```text
apps/
  mobile/          Expo / React Native application
  web/             Next.js web application
  api/             Firebase backend
  lexicon-editor/  Bible lexicon and resource publication tooling

packages/
  resource-service/        Resource API and publication runtime
  resource-domain/         Shared resource contracts and invariants
  resource-catalog/        Shared generated resource catalog
  bible-reference-parser/  French and English Bible reference parser
```

Install all workspace dependencies from the repository root:

```bash
corepack enable
yarn install
```

See [`docs/index.md`](docs/index.md) for the documentation map and [`CONTEXT-MAP.md`](CONTEXT-MAP.md) for the domain contexts.
