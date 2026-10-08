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
- `/strong/:language/:code`, a classical number the lexicon splits into senses, or one sense
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
- `/timeline/:language`, the drawn timeline, and `/timeline/:language/:slug`, an event
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

A single verse read as text is a page of study, not the verse alone. Under the verse it
gathers what the site holds about it: the verse in four other well-known Bibles of the
language and in its original language, the two verses before and after, each of its words
with the original word behind it, the passages it is read with, how the first five
commentaries begin on it, and the topics and dictionary articles that name it. Each part
is a way into another section, and a part with nothing to show is left out. The page is
titled with how the verse begins, since a verse is looked for by its words as much as by
its reference. The other reading modes of a verse, and a range of verses, stay the text
alone.

A reader may show commentaries inside the Bible text. The choice is written in the address
of the page (`?commentary=barnes.mhy-fr`: at most five, in one spelling) and kept by every
link of the page, so it follows the reader from chapter to chapter and across reading modes
and versions; a commentary that says nothing on a chapter shows nothing there. Each comment
is read after the last verse it comments, as the first three lines of its text. It is a
plain link to its section in the commentary; where the browser has dialogs, a click reads
the whole comment over the passage instead. The choice is made with checkboxes in a form
that names the commentaries in the address, so it works without scripting; with scripting,
a box applies at once and the reader keeps their place.

Strong pages add the resource language, like every other family. The code grammar is
unchanged: lowercase prefix, four-digit number, suffix case preserved. One site page
gathers what the workspace spreads over several Strong subpages: both definition levels of
[ADR-0064](./0064-separate-simple-and-detailed-strong-lexicons.md), related entries and a
concordance sample in the Bible matching the page language.

The classical number is the door and the sense is the precision. Where the lexicon tells
the senses of a number apart (`H1254A` “to create”, `H1254B` “to fatten”; the thirty
entries named Zechariah under `H2148`), each sense has its page, named by its sense code,
with its own definitions and its own concordance, as in the workspace. The number is a page too
(`/strong/:language/h1254`): it presents the word once, its historical notice, and each
sense with what tells it apart (who the person or the place is, or else the first line of
its own notice) and the books it is read in. A reader of the workspace reaches a sense from
a verse, which has already chosen it; a reader of the site often arrives by the number,
without that context.

A number with a single sense has no page of its own: it redirects permanently to that
sense, as does an expanded spelling (`h1254a`). A number that is itself the code of one of
its senses (`G5514` next to `G5514G`) keeps its address for that sense, whose page lists the
others. A concordance belongs to a sense: the concordance paths under a split number
redirect to its page. A code whose suffix names no sense does not exist: it never falls
back on the number it is written under.

A sense links to the page of its number instead of listing its sibling senses. A lexicon
list gathers the senses of a number that read the same into one line, which opens the
number; a sense with a gloss of its own keeps its line and opens its entry. A title carries
the classical number first and adds the sense code only where it differs.

A word of a Bible page opens the most precise identity it is tagged with, the sense it has
in that verse, under its classical number. The definitions follow the reading order of
ADR-0064, applied by the rule the workspace uses.

Bible pages accept only the canonical lowercase OSIS book identity; any other spelling of
a valid path redirects to it. Their interface language follows the version: English for an
English Bible, French otherwise.

### Indexing

A Bible chapter and a single verse in every reading mode, a Strong entry, every numbered
page of its concordance, a dictionary article, a topic, the commentary of a chapter, a
timeline event and the lists leading to them are indexable. Verse ranges, concordance book
filters and Bible readings with commentaries shown in the text are served with
`noindex, follow`; such a reading names the plain one as its canonical page.

Sitemaps are generated from the Resource API: one per Bible and reading mode listing its
chapters, the entry page of every number of the Strong lexicons (the number where it is
split, its sense otherwise), one per dictionary, per language of the topics and per
commentary, and the timeline. Verses and the senses of a split number are reached through
links.

The CDN keeps a rendered page for a day and may serve it stale while revalidating. Only a
successfully rendered resource is cacheable. Because a cached page is identical for every
visitor, the theme preference is applied in the browser from the cookie shared with the
landing page, never rendered on the server.

### Boundaries

The site depends on `@bible-strong/resource-domain` for wire contracts, Strong identities
and the reading order of Strong definitions, on `@bible-strong/resource-catalog` for Bible, Strong-Bible and interlinear
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
contracts, the identities and the reading order of the definitions limits drift, but the
route grammar is implemented twice.

Sibling senses of a Greek number share one lexicon article and may share a gloss: their
pages differ by their concordance, their sense code and, for a person, who that person is.

A Bible page with commentaries shown in the text reads the chapter of each of them from the
Resource API, and every choice of commentaries is a page the CDN keeps apart.

A verse page reads about twenty documents from the Resource API when it is not cached.
What does not depend on the Bible being read (the cross-references, the commentaries, the
topics, the dictionary articles) is the same read for every version of the verse, which
the API keeps for a day.

The site functions run in the region of the database of the Resource API, Frankfurt: a
page is a chain of reads, and a function on another continent pays that distance on each.

The page of a number reads each of its senses from the Resource API, entry and verse
counts: about sixty reads for the largest number, once per cached rendering.

The lexicon list of the Resource API gathers the entries that name one person or thing
under a single representative, as the lexicon list of the workspace shows them. The
letter lists and the sitemaps of the site ask it for every sense instead, with the explicit
option `identities=all`, so that an entry behind a representative (Elohim, `H0430G`) is
listed too. A Resource service older than the option ignores it and answers with the
gathered list: the site then lists what the workspace lists, until the service is deployed.

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
names, spans and scales of the timeline periods, the years an event is drawn over and
whether it is a card or a pill, and the English names of commentary authors.

The timeline page is a stage that fills the window, where the workspace shows one period
at a time: one axis runs along its bottom through every period, each at its own scale,
finer than the workspace's where events would pile up. The years of the ministry of Jesus
are drawn wider still, and the events of one of those years are spread over it in their
order. Each period has its scene, the illustration of the workspace, pinned behind its
events for as long as it is in view. Events rest on lanes above the axis; the site
computes the lane of each one, lowest first, instead of mirroring the rows of the
workspace, which overlap. An event lasting years is a card that follows the view along a
ribbon.

Every event stays a plain link to its page. With the script, the stage moves like a map
(a thrown drag glides, a wheel travels through time, a strip of the periods scrubs
through the whole of it) and an event opens in a panel loaded on demand and cached like a
page, so the journey is not interrupted. The page has no list of events and no footer: the
drawing is the page.

A page that needs a whole list to place its resource (the neighbours of a topic or of an
event, the letters of a lexicon) keeps that list for an hour in each server instance.

The Resource API limits requests per client address
([ADR-0065](./0065-protect-resources-without-mandatory-attestation.md)), and the site
server reaches it from few addresses. CDN caching is the first protection; a
server-to-server exemption is added only if rate limiting is observed.
