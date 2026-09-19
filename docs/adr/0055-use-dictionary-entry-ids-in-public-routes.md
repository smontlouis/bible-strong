# ADR-0055: Use Dictionary entry IDs in public routes

- Status: Accepted
- Date: 2026-09-19

## Context

Dictionary articles already have an exact numeric ID inside each work. Public URLs also benefit
from a readable label, but normalized headings are not guaranteed to be unique.

Introducing a second durable identity registry would add publication state, migrations, and an
editorial bootstrap solely to protect against a hypothetical future reassignment of source IDs.

## Decision

Use the existing `(language, work, entryId)` identity and append a descriptive slug:

`/dictionary/:language/:work/:entryId/:slug`

The numeric ID resolves the article. The slug is derived from the current heading and is not used
for lookup. If an inbound slug is stale, the loaded article replaces the URL with its current
canonical slug.

Keep `/dictionnary-detail` for old inbound links. Navigation intents containing the language,
work, exact entry ID, and heading are normalized to the public route.

## Consequences

No Resource schema, database migration, key manifest, or publication bootstrap is required. A
future source that deliberately reassigns article IDs would require a separate migration decision;
that hypothetical case is not handled pre-emptively.
