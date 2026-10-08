# ADR-0073: Read the commentary sections of a verse in one read

## Status

Accepted

## Context

A verse page of the public site shows how the first five commentaries of its language begin
on the verse ([ADR-0068](./0068-serve-indexable-resource-pages-from-the-public-site.md)). The
Resource API had no read for that. The site read the whole chapter of each commentary
(`GET /v1/commentaries/:collection/:language/chapters/:book/:chapter`), built the sections of
the chapter and kept one: five reads and, for John 3, 466 KB in French and 5 MB in English,
where one of the five is an anthology of 4.9 MB on that chapter.

The reads that existed do not answer the question. A verse read
(`/v1/commentaries/:collection/:language/verses/:verseKey`) gives the comments filed under a
verse, not the run of verses a comment covers nor its place among the sections of the
chapter, which its address is made of. The reading index and its section read are two
`POST` reads the Worker does not keep, served from a projection written at publication that
splits the anthology differently from the chapter page, and that a publication may lack.

The sections of a chapter were built by two modules: one in the Resource domain, which also
writes previews with an HTML parser and which the study workspace and the importer use, and
one in the site, written again because the site does not load that parser. The rule that
picks the section of a verse was in the site only.

## Decision

`GET /v1/commentaries/verses/:verseKey/sections?language=…&commentaries=…` answers, for a
verse and up to ten commentaries of one language named by their publication, the section of
each that bears most closely on the verse: its slug, its verse range and its content, in the
order asked. A commentary that does not comment the verse is left out. One without an active
publication is named in `unavailable`, and the others are answered.

The section is the one the site showed: the sections of the chapter are built as its chapter
page builds them, and the closest is kept, the one on the fewest verses among those that
cover the verse. Both rules now live in `@bible-strong/resource-domain`
(`commentary-chapter-sections`), a module that loads nothing, so that the Resource service
and the site apply the same code. The module of the study workspace is unchanged.

The comments of the chapter are read for every commentary in one statement. They are asked
for by their keys, which the index serves: a pattern on the key is tested on every verse of
each commentary, as the chapter read does. The importer only accepts keys written
`book-chapter-verse`, and the read asks for verses 0 to 200, more than any chapter has.

The response is kept by the Worker like the other revisioned reads.

## Consequences

A verse page asks for its comments once and receives what it shows: 24 KB instead of 466 KB
for John 3:16 in French, 11 KB instead of 5 MB in English. Over every verse of the Bible and
the commentaries imported locally (six in French, five in English), the answer weighs 9 KB
on average where the chapter reads weighed 425 KB in French and 1.2 MB in English.

The answer is the one the site computed: on those 62,447 verses, the 265,767 sections
returned are the ones the code of the site picks from the chapter reads, slug, range and
content.

The Resource service still reads the whole chapters from the database to build their
sections, since the slug of a section depends on the sections before it. That is one
statement, 3 to 9 ms on a local copy with the transfer of its rows, where the five chapter
reads ran ten statements for 45 to 190 ms in all. But the Worker receives as much text as
the site did, and builds the sections of the chapter again for each of its verses, once per
deployment: 5 to 30 ms for a verse, the longest on a chapter of 5 MB.

The site keeps its own copies of both rules until it imports the shared module. Until then a
change to one side must be made on the other.

A response names the revision of each commentary it quotes. A commentary activated without
deploying the Worker stays unseen by kept responses, as for the other reads.
