# ADR-0068: Serve indexable resource pages from the public site

## Status

Accepted. Settles the server rendering, metadata and indexing questions left open by
[ADR-0053](./0053-add-canonical-public-bible-and-strong-routes.md) to
[ADR-0056](./0056-add-canonical-public-timeline-routes.md).
[ADR-0069](./0069-remove-the-public-shell-from-the-web-workspace.md) applies it to the
workspace.

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
app" entry and the invitation closing a page lead to the same resource in the workspace.
Links shared from the applications target the site.

The workspace at `web.bible-strong.app` is not indexed (ADR-0069).

### Sections

The site offers six sections, each with an entry page, lists and resource pages: Bible,
lexicon, dictionary, topics, commentaries and timeline. Every page carries the same header,
with a menu of the sections, the path leading to the page, and a footer listing the
sections again. The landing page links to each of them.

### Routes

Site routes reuse the grammar of ADR-0053 to ADR-0056 and add the lists that lead to it:

- `/bible` and `/fr/bible`, the versions, in each interface language
- `/bible/:version`, the books and chapters of a version
- `/bible/:version[/:presentation]/:book/:chapter[/:passage]`
- `/strong/:language`, the lexicon, and `/strong/:language/:lexicon/:letter`, its Hebrew or
  Greek entries filed under the first letter of their gloss
- `/strong/:language/:code`
- `/strong/:language/:code/concordance[/:page]`, the occurrences fifty verses to a numbered
  page, with an optional `book` filter
- `/strong/:code` redirects permanently to the default language, `fr`.
- `/dictionary/:language`, the dictionaries; `/dictionary/:language/:work`, a dictionary
  and its alphabet; `/dictionary/:language/:work/:letter`, its articles under a letter
- `/dictionary/:language/:work/:entryId/:slug`, an article (ADR-0055)
- `/nave/:language`, the topics; `/nave/:language/index/:letter[/:page]`, the topics under
  a letter
- `/nave/:language/:topic`, a topic (ADR-0054)
- `/commentary/:language`, the commentaries; `/commentary/:language/:resource`, a
  commentary and the chapters it covers
- `/commentary/:language/:resource/:book/:chapter`, the commentary of a chapter (ADR-0054)
- `/timeline/:language`, every event by period, and `/timeline/:language/:slug`, an event
  (ADR-0056)

A commentary section has no page of its own: every section of a chapter is on the chapter
page, so `/commentary/:language/:resource/:book/:chapter/:section` redirects permanently to
its anchor there. A list or a chapter too long for one document continues on numbered
pages: a path segment for topics and concordances, a `page` parameter where a segment
would collide with the route of a resource (dictionary letters, commentary chapters).

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
is loaded on demand and cached like a page. A note mark works the same way: a plain link
to the note under the text, and a card next to the mark where popovers are supported. The
cross-references of a note open in the version being read.

Strong pages add the resource language, like every other family. The code grammar is
unchanged: lowercase prefix, four-digit number, suffix case preserved. One site page
gathers what the workspace spreads over several Strong subpages: both definition levels of
[ADR-0064](./0064-separate-simple-and-detailed-strong-lexicons.md), related entries and a
concordance sample in the Bible matching the page language.

Bible pages accept only the canonical lowercase OSIS book identity; any other spelling of
a valid path redirects to it. Their interface language follows the version: English for an
English Bible, French otherwise.

### Indexing

A Bible chapter and a single verse in every reading mode, a Strong entry, every numbered
page of its concordance, a dictionary article, a topic, the commentary of a chapter, a
timeline event and the lists leading to them are indexable. Verse ranges and concordance
book filters are served with `noindex, follow`. So is a commentary whose holder reserves
all rights: it stays readable, as in the workspace, but is kept out of search indexes and
sitemaps.

Sitemaps are generated from the Resource API: one per Bible and reading mode listing its
chapters, the classical Strong numbers, one per dictionary, per language of the topics and
per indexable commentary, and the timeline. Verses and disambiguated senses are reached
through links.

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

Each family lives in its own folder of the site and shares the header, the head builder,
the sanitizer and the link resolver of the resource pages. Biblical-entity pages follow the
same shape.

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
notes. A version without paragraph marks gets one paragraph per verse.

Editorial content reaches the site in the dialects of its sources. Each family normalizes
its own before the shared sanitizer, which rebuilds the markup from an allowlist and keeps
a link only when it resolves to a site page.

Some presentation data is not in the Resource API and is mirrored from the workspace: the
names and spans of the timeline periods, and the English names of commentary authors.
Timeline images are not shown: they are originals served by the source of the timeline,
several from a stock library. The French topics are a machine translation of Nave's
English text; their pages say so.

A page that needs a whole list to place its resource (the neighbours of a topic or of an
event, the letters of a lexicon) keeps that list for an hour in each server instance.

The Resource API limits requests per client address
([ADR-0065](./0065-protect-resources-without-mandatory-attestation.md)), and the site
server reaches it from few addresses. CDN caching is the first protection; a
server-to-server exemption is added only if rate limiting is observed.
