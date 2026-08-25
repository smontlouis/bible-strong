# Bible Strong Context Map

## Contexts

- [Mobile study workspace](./apps/mobile/CONTEXT.md) — Bible reading, study, offline resources, and user-owned study data.
- [Resource delivery](./packages/resource-service/CONTEXT.md) — validates, publishes, imports, and serves versioned Bible resources.
- [Resource domain](./packages/resource-domain/CONTEXT.md) — owns shared resource schemas, identities, cursors, and pure invariants.
- [Resource catalog](./packages/resource-catalog/CONTEXT.md) — owns generated artifact catalogs and immutable publication metadata.
- [Lexicon editorial production](./apps/lexicon-editor/CONTEXT.md) — produces reviewed lexicon data and immutable resource publication bundles.
- [Web experience](./apps/web/CONTEXT.md) — exposes Bible Strong content and study surfaces on the web.
- [Application API](./apps/api/CONTEXT.md) — owns Firebase-backed server operations used by Bible Strong clients.
- [Bible reference parsing](./packages/bible-reference-parser/CONTEXT.md) — turns French and English Bible-reference text into canonical passage references.

## Relationships

- **Lexicon editorial production → Resource delivery**: the editor produces immutable publication bundles; the Resource service validates and activates them.
- **Resource delivery → Mobile study workspace**: the service exposes online resources and downloadable Offline copies consumed by the mobile app.
- **Resource domain → Resource delivery / Mobile study workspace**: both use the same platform-neutral wire contracts and invariants.
- **Resource catalog → Resource delivery / Mobile study workspace**: publisher and client consume the same versioned artifact catalog.
- **Bible reference parsing → Mobile study workspace**: the parser recognizes inline references used for navigation and study links.
- **Application API → Mobile study workspace / Web experience**: Firebase functions provide account-adjacent and content-processing operations to both clients.
