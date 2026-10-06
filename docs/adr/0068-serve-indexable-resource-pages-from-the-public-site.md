# ADR-0068: Serve indexable resource pages from the public site

## Status

Accepted. Settles the server rendering, metadata and indexing questions left open by
[ADR-0053](./0053-add-canonical-public-bible-and-strong-routes.md) to
[ADR-0057](./0057-render-public-routes-outside-the-workspace-for-guests.md).

## Context

The canonical public routes live in the Expo study workspace, which is exported as a
single-page application ([ADR-0047](./0047-host-expo-web-on-cloudflare.md)). Every URL
therefore answers with the same HTML document, without content or specific metadata, and a
visitor must download the whole workspace before reading one entry.

Expo Router can render on the server from SDK 57, but only behind an experimental flag, for
every route at once, and only if the complete workspace tree (persisted state, Firebase
authentication, audio, offline storage) can render without a browser. A page that hydrates
the workspace also stays as heavy as the workspace.

The public site already renders shared studies on the server with their own metadata.

## Decision

The public site serves the indexable page of each public resource at `bible-strong.app`.
A page is a light server-rendered document built from the Resource API; it does not load
the study workspace. Its content links to other site pages; only the header's "open the
app" entry leads to the same resource in the workspace, whose canonical routes remain the
destination of shared and in-app links.

The workspace at `web.bible-strong.app` is not indexed.

### Routes

Site routes reuse the grammar of ADR-0053 to ADR-0056:

- `/bible/:version[/:presentation]/:book/:chapter[/:passage]`
- `/strong/:language/:code`
- `/strong/:language/:code/concordance`, with an optional `book` filter
- `/strong/:code` redirects permanently to the default language, `fr`.

A Bible presentation is a reading mode, each with its own URL:

- the text, without a presentation segment;
- `strong`, where every tagged word is followed by its Strong numbers, as in the workspace;
- `reverse-interlinear`, the translation in its own order with the original words under it;
- `interlinear`, the original-language Bible (`BHG`) word by word, with transliteration
  and gloss.

`strong` and `reverse-interlinear` exist for the Strong-tagged translations, `interlinear`
only for `BHG`. The interlinear reading names the language of its glosses in the path
(`/bible/bhg/interlinear/fr/…` and `/bible/bhg/interlinear/en/…`), which is also the
language of its interface. The workspace opens the same paths (ADR-0053).

A Strong number on a Bible page is a plain link to its entry. Where the browser supports
popovers, a click previews the entry in a card instead of leaving the passage; the preview
is loaded on demand and cached like a page.

Strong pages add the resource language, like every other family. The code grammar is
unchanged: lowercase prefix, four-digit number, suffix case preserved. One site page
gathers what the workspace spreads over several Strong subpages: both definition levels of
[ADR-0064](./0064-separate-simple-and-detailed-strong-lexicons.md), related entries and a
concordance sample in the Bible matching the page language.

Bible pages accept only the canonical lowercase OSIS book identity; any other spelling of
a valid path redirects to it. Their interface language follows the version: English for an
English Bible, French otherwise.

### Indexing

A Bible chapter and a single verse in every reading mode, a Strong entry and the first
page of its concordance are indexable. Verse ranges, concordance book filters and following
concordance pages are served with `noindex, follow`. Sitemaps are generated from the
Resource API: one per Bible and reading mode listing its chapters, and the classical
Strong numbers. Verses and disambiguated senses are reached through links.

The CDN keeps a rendered page for a day and may serve it stale while revalidating. Only a
successfully rendered resource is cacheable. Because a cached page is identical for every
visitor, the theme preference is applied in the browser from the cookie shared with the
landing page, never rendered on the server.

### Boundaries

The site depends on `@bible-strong/resource-domain` for wire contracts and Strong
identities, on `@bible-strong/resource-catalog` for Bible, Strong-Bible and interlinear
identities, and on `@bible-strong/bible-reference-parser` for OSIS book identities. It
never imports Expo sources. Its route parsers are written over those shared identities;
the Expo parsers keep their own input aliases.

Families are delivered one at a time: Strong and Bible first. Dictionary, Nave, Timeline,
commentary and biblical-entity pages follow the same shape.

## Consequences

Public pages are fast and indexable without changing the workspace or the native
applications.

Each resource has two renderings, a site document and a workspace screen. Sharing the wire
contracts and the identities limits drift, but the route grammar is implemented twice, and
the site applies a simpler reading order than the workspace: the historical definition
first, the detailed one second.

Bible display names, languages and copyright notices are not in the shared catalog. The
site mirrors them from the workspace; a test keeps the list of versions aligned with the
catalog, not their names.

The version selector only links to versions that carry the passage. A Bible page therefore
reads the coverage of every version; a server instance keeps each coverage for an hour.

The site renders the canonical formatting of a Bible with its own engine: paragraphs,
poetry stanzas and lines, section titles, words of Jesus, added words, divine names and
notes. A version without paragraph marks gets one paragraph per verse. Note marks are not
links, because they would be tiny tap targets next to verse numbers; the list of notes
under the text links back to each mark.

The Resource API limits requests per client address
([ADR-0065](./0065-protect-resources-without-mandatory-attestation.md)), and the site
server reaches it from few addresses. CDN caching is the first protection; a
server-to-server exemption is added only if rate limiting is observed.
