# ADR-0115: Read the verse study of a language in one read, and a term by its slug

## Status

Accepted

## Context

The public site renders between 1.2 and 2 million pages a day, about 85 % of them verse pages in
48 Bibles, mostly for crawlers, and nearly nine in ten miss the page cache
([ADR-0084](./0084-keep-rendered-pages-in-the-cache-in-front-of-the-worker.md)). A verse page
gathered its study ([ADR-0088](./0088-gather-a-verse-study-under-a-verse-in-focus.md)) in about ten
reads of the Resource API, two of them waiting for another: the Strong chapter before the entries
of its words, the cross-references before the texts of the passages they name. Everything but the
verse itself, the verse in the other Bibles and the texts of those passages is the same in every
Bible of a language, and was asked for again by each of them: each read wakes the API Worker, looks
in its cache, and on a miss opens the database.

A term page found its notion by searching the dictionary directory for the first word of its slug,
up to four searches of a hundred notions one after the other. A heading whose normalized form keeps
its accents (`Ésaïe`) was never found that way.

ADR-0088 weighed one answer holding the whole study and left it out for the app: the app reads each
resource from its offline copy, compares the Bibles its reader chose and reads the commentaries its
reader chose, so one answer would ignore the copies, differ for every reader and be kept for nobody.
None of this holds for the site: it has no offline copy, and its choices are the same for every
reader of a language.

## Decision

- **One verse study per verse and language.** `GET /v1/verse-studies/:language/:verseKey`, with
  `commentaries` naming the commentaries to quote in order, answers what the routes of its parts
  answer for the verse: the tagged words of the Strong Bible the language borrows from (LSG, KJV)
  with the entries of the codes they name, the cross-references as published, the section of each
  commentary, the Nave topics, the dictionary articles and the entities of the verse. The API reads
  the parts together on four connections, and the verse alone where the chapter route reads its
  chapter. The per-resource routes stay: the app and the study assistant use them.
- **What changes with the Bible stays out.** The verse in the Bible being read and in the other
  Bibles, by chapter, and the texts of the passages the study names, in the Bible being read, are
  read beside it. A Strong-tagged Bible other than LSG and KJV reads its own words, in two reads.
  The site names the same commentaries for every Bible of a language, so all 48 share one answer.
- **The same entries on both sides.** Which Strong entries a verse's words open is a domain rule,
  `verseStudyStrongCodes` (`@bible-strong/resource-domain/verse-study`): the API reads the entries the
  site will look a word up by, and a test keeps them equal to the codes the page shows.
- **Never absent, never half.** A part the verse has nothing for is empty, as its own route answers
  404. A part that cannot be read fails the whole study, which is not kept: an empty part would be
  kept thirty days, and the page rendered from it a month. The site leaves every part out and marks
  the page incomplete; it does not read the parts again one by one from an API that already refuses.
- **Kept like the answers it gathers.** A study is kept thirty days under the whole catalog, every
  hand invalidation ([ADR-0076](./0076-answer-a-new-worker-version-from-the-cache-of-the-one-before.md))
  and the revisions of the routes it gathers: the dictionaries of a language are not listed in the
  catalog by language, so any publication renews every study, and so does an invalidation of any
  resource.
- **A term by its slug.** `GET /v1/dictionaries/terms/:slug?language=` answers the first notion, in
  the order of the directory, whose label has that slug, or no notion: never 404. The slug rule is
  `dictionaryTermSlug` (`@bible-strong/resource-domain/contracts/dictionaryContract`), written in SQL
  once (`dictionaryTermSlugSql`) for an expression index on the headings, migration 0043. It is
  neither `unaccent` nor `bible_search_normalize`, which spell œ, æ and ß as letters where an address
  leaves them out. The database finds candidates through the index; the label is checked again with
  the rule of the site.
- **The API first.** Migration 0043 is applied, then the API is deployed by hand, before the site,
  which deploys itself on a push. Without the index the term route still answers, reading every
  heading. An API without the routes answers them 404, uncached: the site then reads each part of a
  study on its own, and searches a term by its first word, as before. A slug longer than the route
  accepts is searched that way too.

## Consequences

- A verse page reads the chapter of its Bible, the verse in the other Bibles (shared by the whole
  chapter), the verse study (shared by every Bible of the language) and the texts of the passages it
  names: four reads where it made about ten, and six for a tagged Bible other than LSG and KJV. Every
  page of a verse in a language after the first finds the study in the cache of its data center.
- The texts of the passages still wait for the study, as they waited for the list of
  cross-references. The study waits for the commentaries that comment the chapter, which the server
  instance keeps an hour.
- A first study opens four connections to Hyperdrive and reads about a dozen statements; a study
  is read where ten separate requests were.
- Any publication renews every verse study, where it renewed only the parts it touched; the
  dictionary articles of a verse were already renewed so.
- A term page finds terms the search missed: its pages are a superset of those it had.
- A part the API answers wrongly is wrong for every Bible of the language at once; the parity tests
  of the Resource service and of the site compare the study with the routes of its parts.
