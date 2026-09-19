# ADR-0054: Add canonical public Nave and commentary routes

- Status: Accepted
- Date: 2026-09-19

## Context

Nave topics and commentary chapters are public editorial resources, but their Expo routes expose
screen names and query parameters. Both resource families already carry durable identities and an
explicit French or English resource language.

## Decision

Add canonical routes:

- `/nave/:language/:topic`
- `/commentary/:language/:resource/:book/:chapter`
- `/commentary/:language/:resource/:book/:chapter/:section`

The Nave topic is its published `normalizedName`, URL-encoded without changing its identity. A
commentary uses the catalog Resource identity, resource language, lowercase OSIS book identity,
chapter, and a section suffix derived from its deterministic section ID.

Normalize the historical `/nave-detail`, `/commentary-chapter`, and `/commentary-entry` navigation
intents at the shared navigation seam. Keep their route files for old inbound links. On canonical
commentary pages, chapter and section navigation update the canonical path directly.

Dictionary routes were deliberately deferred here. ADR-0055 subsequently chose the existing exact
entry ID plus a descriptive slug; that later decision supersedes this deferral.

## Consequences

Nave and commentary links now identify the exact editorial projection without depending on global
language preferences. Static rendering, server rendering, metadata, and HTTP redirects remain
separate deployment decisions.
