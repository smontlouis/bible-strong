# ADR-0087: Write the sections of a commentary chapter at publication

## Status

Accepted

## Context

A verse page of the public site asks the Resource API for the section of up to five
commentaries that bears on its verse
([ADR-0073](./0073-read-the-commentary-sections-of-a-verse-in-one-read.md)). The answer was
small, but the Worker built it from the comments of the whole chapter of each commentary,
read from PostgreSQL for every verse: about 740 KB on average, 1.4 MB for John 3 in
French, to keep a few kilobytes.

Crawlers read every verse page, and the Worker cache keeps an answer per verse and per data
centre. In October 2026, with Neon billing the database's network transfer, these reads were
about 94 GB a day, two fifths of the transfer, next to the Bible chapter reads that sent
the whole publication metadata with every verse.

The sections of a chapter cannot be read one verse at a time: a section may cover several
verses, its slug counts the sections on the same range before it, and the anthology read by
source document gathers its excerpts across the chapter.

## Decision

The importer writes the sections of every chapter of a commentary publication in
`commentary_chapter_sections`, in the same transaction as its comments: slug, verse range,
content and place among the sections of the chapter. They are built by
`buildCommentaryChapterSections` from the comments of verses 0 to 200, the verses the
chapter read of ADR-0073 asked for, and for the collection named by the publication identity.

`GET /v1/commentaries/verses/:verseKey/sections` reads, in one statement, the section of each
commentary that `closestCommentarySection` would pick: among the sections that cover the
verse, the one on the fewest verses, then the one that starts last, then the first in the
chapter. Only those sections leave the database.

A publication without any written section was imported before this decision. The read
refuses it with a failure, which the Worker does not keep, rather than answering that the
commentary says nothing. `yarn resources:commentaries:sections:backfill` writes the sections
of active publications from their comments.

The projection of the reading index (`commentary_reading_sections`) is kept apart: it
splits the anthology differently and serves the study workspace.

## Consequences

A verse page costs the database a few kilobytes instead of the chapters of five
commentaries, and the Worker no longer builds sections on each read. The answer is
unchanged, byte for byte.

The sections take as much room as the comments they come from, about 1 GB for the
commentaries published in October 2026.

A change to `buildCommentaryChapterSections` or to `closestCommentarySection` now needs the
sections written again for every publication, with the backfill, before the Worker that
reads them is deployed; and the site still keeps its own copy of both rules (ADR-0073).
