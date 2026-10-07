# ADR-0069: Remove the public shell and do not index the web workspace

## Status

Accepted. Supersedes
[ADR-0057](./0057-render-public-routes-outside-the-workspace-for-guests.md) and applies the
indexing decision of
[ADR-0068](./0068-serve-indexable-resource-pages-from-the-public-site.md) to the workspace.

## Context

ADR-0057 gave unauthenticated visitors a standalone public shell on canonical resource routes,
so that a shared URL would not open a personal workspace. To do so, the web runtime chose its
layout from the authentication state, hid itself while a session was being restored, and carried
a public variant in the shared page header, the Bible reader and the route panel.

Since ADR-0068, the public site serves the read-only, indexable page of every public resource at
`bible-strong.app`. The workspace no longer has a public reading role. Its single-page export
also answers every URL with the same document, which has no value in a search index.

## Decision

The web application at `web.bible-strong.app` is the personal study workspace only.

- It has no public shell. A visitor without an account who opens a canonical route gets the
  normal workspace as a guest, like an authenticated user.
- It is not indexed. Every response carries `X-Robots-Tag: noindex`, declared in
  `apps/expo/public/_headers` and applied by Cloudflare Workers Static Assets
  (see `docs/expo-web-deployment.md`).
- Public reading lives on the site. A link shared with other people targets
  `bible-strong.app`, at the canonical path of the resource when it has one.

The canonical routes, their parsers and builders, and the route normalization seam of
[ADR-0053](./0053-add-canonical-public-bible-and-strong-routes.md) to
[ADR-0056](./0056-add-canonical-public-timeline-routes.md) stay. They are the URL grammar the
workspace shares with the site, and the destination of the site's "open the app" entry.

## Consequences

The web runtime renders a single layout without waiting for authentication, and always mounts
workspace analytics, the assistant launcher, dialogs and modals. Native applications are
unchanged: the shell never applied to them.

A guest who follows a link to `web.bible-strong.app` lands in the workspace, where the resource
opens like any other route, not on a focused reading page. Share actions carry text and at most
a `bible-strong.app` link; none builds a workspace URL.

The header only asks crawlers not to index. The workspace must not publish a `robots.txt` that
disallows crawling, or crawlers would never see the header. Pages indexed before this decision
leave search results as they are crawled again.
