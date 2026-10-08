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
- `/dictionary/:language/term/:slug`, a term in every dictionary of the language
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

A term several dictionaries of a language define has a page that reads their articles one
after the other, each under the name of its dictionary and linked to its own page. The
articles are gathered by the notion the Resource API files them under; the address is
written from the heading of that notion. A term one dictionary holds has no such page: its
address redirects permanently to the article. The article pages stay indexable under their
own address, and each names the term page when there is one.

A topic page quotes the first forty verses its outline cites, in the reference Bible of
its language, after the outline that lists every reference.

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

A Strong page says how the Bible of its language renders the word (`Dieu` 2,057 times,
`dieu` 33 times in the Segond) before it quotes its first verses, and the page of a number
does the same for the number as a whole. A Strong title opens on the word as it is typed
in a search (`Elohiym`), then names its number and what it means; a dictionary article is
titled as a question about the Bible (`Aaron dans la Bible : définition`).

A word of a Bible page opens the most precise identity it is tagged with, the sense it has
in that verse, under its classical number. The definitions follow the reading order of
ADR-0064, applied by the rule the workspace uses.

Bible pages accept only the canonical lowercase OSIS book identity; any other spelling of
a valid path redirects to it. Their interface language follows the version: English for an
English Bible, French otherwise.

### Indexing

A Bible chapter and a single verse in every reading mode, a Strong entry, every numbered
page of its concordance, a dictionary article, a dictionary term, a topic, the commentary
of a chapter, a timeline event and the lists leading to them are indexable. Verse ranges, concordance book
filters and Bible readings with commentaries shown in the text are served with
`noindex, follow`; such a reading names the plain one as its canonical page.

Sitemaps are generated from the Resource API: one per Bible and reading mode listing its
chapters, the entry page of every number of the Strong lexicons (the number where it is
split, its sense otherwise), one per dictionary, per language of the dictionary terms, per
language of the topics and per commentary, and the timeline. The senses of a split number
are reached through links.

A verse has a page in every Bible, and each is indexable, but only the five best-known
Bibles of each language have a sitemap of their verse pages (`bible-lsg-verses.xml`), about
31,000 addresses each. The verses of the other Bibles are reached through links. Such a
sitemap lists the verses its Bible numbers, which are not those of another Bible: a
translation may count the verses of a chapter differently, leave out a verse its manuscripts
do not have, or translate several verses as one, which then has one page.

A verse a Bible numbers and leaves without text is not a page either. A Bible may keep the
number of a verse its manuscripts do not have as a blank row, or with the bracket that
closed the omitted words (Matthew 17:21 in the NIV and in the NBS). Its address answers 404
in every reading mode, like the address of a verse the Bible does not number, and no verse
page quotes it or links to it. A verse has text when it holds a letter or a digit. The
chapter is read as before, and so is a range of verses, which is not indexed.

The verse sitemaps are served under `/sitemaps/` like the others, but `/sitemap.xml` does
not list them until `ANNOUNCE_BIBLE_VERSE_SITEMAPS` is set in the sitemap registry. They
are first submitted by hand, one Bible at a time, so that the crawl of some 311,000 pages
starts when it is decided.

The CDN keeps a rendered page for a day and may serve it stale while revalidating. Only a
successfully rendered resource is cacheable. A Bible or Strong page missing a part it could
not read from the Resource API is kept for a minute only, so that the readers of that minute
do not each render it again and the whole page soon takes its place. Such a page answers
with the header `X-Page-Incomplete: 1`, which a whole page and a failed load never carry:
the CDN consumes `s-maxage` and answers every page with the same `Cache-Control`, so the
header is what tells a reader of the response that the page is the short-lived one. Because
a cached page is identical for every visitor, the theme preference is applied in the browser
from the cookie shared with the landing page, never rendered on the server.

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

A term page shows text that is also on the article pages of each dictionary. Both are
indexable: the term page answers a search for the term, an article page a search for the
term in a given dictionary.

A verse page reads about thirteen documents from the Resource API when it is not cached,
at most six at a time: the API answers a few reads at once in a steady time, and out of a
dozen sent together some wait several hundred milliseconds. What does not depend on the
Bible being read (the verse in the other Bibles and in its original language, the
cross-references, the commentaries, the topics, the dictionary articles) is the same read
for every version of the verse, and the other Bibles are one read for every verse of a
chapter. The API keeps these reads for thirty days.

The coverage of a Bible counts the verse rows of each chapter, and a chapter that skips a
number is not numbered from 1 to its count. The coverage also publishes the numbers of the
verses that have text, for the chapters where they are not exactly 1 to the count
([ADR-0071](./0071-publish-the-verse-numbers-of-irregular-chapters.md)): a verse sitemap is
then one read, and exact. It leaves out a title the coverage numbers 0, which is not a
verse.

A Resource service older than that field leaves it out, and a verse sitemap falls back on
questions: it asks for the last number of every chapter and the three after it, two hundred
verses at a time, and reads the chapters where the answer is not the count alone, 25 to 50
reads for a Bible, once per cached sitemap. One shape of chapter escapes that question:
numbers skipped before the count, the count itself a verse, and the numbering resuming more
than three numbers after it. Such a chapter is listed as numbered from 1 to its count, and
a verse kept without text is listed like any other: the sixteen such verses of the NIV stay
in its sitemap, each answering 404, until the service publishes the numbers.

The site functions run in the region of the database of the Resource API, Frankfurt: a
page is a chain of reads, and a function on another continent pays that distance on each.

A Strong page reads like a Bible page: a bounded number of documents at a time, and what
does not depend on an answer does not wait for it. The verses of a code, their count by book and the
words they are translated by are asked for with its entry, so a sense is six reads on two
levels, the entry beside its verses and then their text, and a seventh beside the entry when
its code says it is one sense of a number. A page shown without the words its entry is
translated by, because they could not be read, is an incomplete page; any other read that
fails fails the page, which is then not kept.

The page of a number reads each of its senses from the Resource API, entry and verse
counts: about sixty reads for the largest number, once per cached rendering. The senses of
a number are only known from the lexicon, by asking for every code a sense could carry: the
number is asked as soon as one reading level of its entry names a sense with a code of its
own, and its senses are read once it has answered. A page of a number is therefore three
reads deep, and those of its senses pass sixteen at a time: six at a time would make ten
rounds of the largest number, each as long as its slowest read. A number with a single sense, or a
code in another letter case, is redirected as soon as its entry is known.

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
