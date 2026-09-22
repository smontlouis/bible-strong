# Bible Strong Context Map

## Contexts

- [Study workspace](./apps/expo/CONTEXT.md) — Bible reading, study, offline resources, and user-owned study data across iOS, Android, and Web.
- [Resource delivery](./packages/resource-service/CONTEXT.md) — validates, publishes, imports, and serves versioned Bible resources.
- [Resource domain](./packages/resource-domain/CONTEXT.md) — owns shared resource schemas, identities, cursors, and pure invariants.
- [Resource catalog](./packages/resource-catalog/CONTEXT.md) — owns generated artifact catalogs and immutable publication metadata.
- [Resource authoring](./apps/resource-studio/CONTEXT.md) — acquires, transforms, validates, and packages Bible Strong resources.
- [Public site](./apps/site/CONTEXT.md) — exposes public Bible Strong pages and shared study content on the web.
- [Event exploration world](./apps/world/CONTEXT.md) — presents Bible Strong resources through a joystick-driven illustrated world for ASI Europe.
- [Application API](./apps/api/CONTEXT.md) — owns Firebase-backed server operations used by Bible Strong clients.
- [Bible reference parsing](./packages/bible-reference-parser/CONTEXT.md) — turns French and English Bible-reference text into canonical passage references.

- [Study assistant API contract](./packages/ai-contract/CONTEXT.md) — public requests and streamed responses for a separately hosted service.

## Relationships

- **Resource authoring → Resource delivery**: Resource Studio produces immutable publication bundles; the Resource service validates and activates them.
- **Resource delivery → Study workspace**: the service exposes online resources and downloadable Offline copies consumed by the Expo app.
- **Resource domain → Resource delivery / Study workspace**: both use the same platform-neutral wire contracts and invariants.
- **Resource catalog → Resource delivery / Study workspace**: publisher and client consume the same versioned artifact catalog.
- **Bible reference parsing → Study workspace**: the parser recognizes inline references used for navigation and study links.
- **Application API → Study workspace / Public site**: Firebase functions provide account-adjacent and content-processing operations to both clients.
- **Event exploration world → Bible Strong product**: the standalone event experience introduces the six study-resource families without owning their publication data.

- **Study assistant → Resource delivery**: bounded read-only tools use the Resource API through a Worker service binding.
- **Study workspace → Study assistant**: authenticated clients consume the same Markdown stream contract on native and web; provider implementation is maintained in a separate private repository.

- **Event exploration world → Gloo Grounded**: optional avatar games use provider-grounded generation; Jev adjudicates free-text answers.
