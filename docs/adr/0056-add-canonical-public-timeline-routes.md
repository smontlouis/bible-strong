# ADR-0056: Add canonical public Timeline routes

- Status: Accepted
- Date: 2026-09-19

## Context

Timeline events are public editorial resources. Each published event already has a durable slug and
an explicit French or English resource language, while Expo currently exposes the technical
`/event?slug=...` route and a preference-driven Timeline landing page.

## Decision

Add canonical routes:

- `/timeline/:language`
- `/timeline/:language/:slug`

The event slug is the published Timeline identity and is not translated in the URL. The language
selects the localized publication. Normalize internal `/event` and `/timeline-home` navigations at
the shared route seam, and redirect representable legacy inbound URLs to their canonical route.

The interactive section viewer remains an internal application route because a section index is a
presentation position, not a durable public resource identity.

## Consequences

Timeline landing pages and events can be shared and indexed without depending on the user's saved
language preference. No Resource schema or publication change is required. SSR, static rendering,
metadata, and sitemap generation remain separate deployment decisions.
