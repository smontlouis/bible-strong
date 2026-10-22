# ADR-0088: Gather a verse study under a verse in focus

## Status

Accepted

## Context

A verse page of the public site gathers around its verse the verse in other Bibles, its
original words, the passages read with it, how commentaries begin on it, its topics and the
dictionary articles that name it
([ADR-0068](./0068-serve-indexable-resource-pages-from-the-public-site.md)). The app had each
of these as a study card, opened one at a time from the selected verses, and nothing under a
verse held in the reader's focus.

The focus already isolates a verse, a range, or scattered verses of one chapter, and many
paths lead to it: a cross-reference, a compared verse, the concordance, a public link opened
in the app. Under the focused verse the reader now finds a short preview of each study, each
a door to its card.

Two ways of reading the data were weighed. One answer from the Resource API holding the whole
study would cost one request, but the app reads each resource from its offline copy when it
has one, compares the versions the reader chose and reads the commentaries the reader chose:
a single answer would ignore the offline copies, differ for almost every reader, and keep
nothing shared in the cache.

## Decision

- The app reads each section through the resource access it already has for the matching
  study card, offline copy first, with the same query keys where they read the same thing, so
  a card opened from the preview shows what is already loaded. No route of the Resource API is
  added.
- The commentaries are the reader's, or the default ones when none is chosen. An offline copy is
  read from its chapter; the others come from the excerpts of the verse
  ([ADR-0073](./0073-read-the-commentary-sections-of-a-verse-in-one-read.md)), one read per
  language, instead of the whole chapter of each commentary: about 750 KB for a chapter of
  John with ten commentaries, against a few kilobytes.
- The three passages quoted under the verse are read in one request, and a Strong chapter read
  for one verse stays in memory for the next ones (the last eight, for half an hour). The study
  is read only for the reader on screen, not for a tab kept in the background.
- The study is shown for one verse. When the focus holds several verses, the reader picks the
  verse studied among them; the first is studied until then.
- What is named, and how much, is a domain rule shared by the site and the app:
  `@bible-strong/resource-domain/verse-study` holds the reading of a cross-reference list (verse
  keys of the canon, each once, never the verse itself), the order of dictionary articles (the
  words of the verse first, one article per word) and the counts of each surface. The site keeps
  its counts (four other Bibles, sixteen passages, five commentaries, ten words); the focus names
  three versions, five words, three passages, two commentaries and eight words.
- A section with nothing to show is left out, offline included: a resource without its offline
  copy shows nothing until the reader is online.

## Consequences

- The site's verse page and the app's focus name the same passages and articles for a verse.
  A change to that choice is made once, in the domain package.
- Opening a focus reads up to six resources when nothing is downloaded. They load in parallel,
  each section appears when it is ready, and a verse already studied is read from the cache.
- The study is drawn by the reader's DOM component under the verses; the cards it opens stay
  native.
