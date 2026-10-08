# ADR-0071: Publish the verse numbers of irregular chapters in a Bible's coverage

## Status

Accepted

## Context

The coverage of a Bible (`GET /v1/bibles/:version/coverage`) gives, for each chapter, the
number of verse rows the publication holds: `verseCountByBookChapter`. A count is not a
numbering. A Bible may leave a number out (ESV Matthew 17 has 26 rows, numbered 1 to 20 and
22 to 27), translate several verses as one (NLT Numbers 1 has 30 rows, numbered 1 to 19 and
44 to 54), keep a verse its manuscripts omit as a row without text (NIV Matthew 17:21 is a
line break, NBS Matthew 17:21 a closing bracket), or number a title 0 (the Psalms of BHG).

The public site lists every verse page of a Bible in its sitemaps
([ADR-0068](./0068-serve-indexable-resource-pages-from-the-public-site.md)). Without the
numbering it asks the Resource API for the last numbers of every chapter and reads the
chapters that do not answer like a chapter numbered from 1 to its count: 25 to 50 reads for
a Bible, an answer that one shape of chapter escapes, and no way to see a row without text.

Of the 47 Bibles of the catalog, 16 have no such chapter and the others have 1 to 173, out
of about 1,189.

## Decision

The coverage publishes `verseNumbersByBookChapter`, keyed like `verseCountByBookChapter`.
For a chapter it gives the ascending numbers of the verses that have text, and it holds a
chapter only when that list is not exactly 1 to the count of the chapter. A Bible without
such a chapter has an empty object. A client reads the numbers of a chapter as the published
list, or 1 to its count when there is none.

`verseCountByBookChapter` keeps its meaning: the number of rows, with or without text.

A verse has text when something remains once white space and punctuation marks are removed
from its row. The list of those characters is fixed in the repository rather than taken from
the character classes of PostgreSQL, whose meaning for Hebrew or Greek letters depends on
the locale of the database. Over the 47 Bibles it selects the same 161 rows as "no letter
and no digit".

A verse numbered 0 that has text is published like any other number.

The field is optional in the shared contract, so that a client built with it still decodes
the coverage of a Resource service older than the field. Its presence, even empty, tells a
client that the service publishes it.

The publication and its chapters are read in one statement, where the coverage ran two. The
numbers are gathered in the aggregation that counts the rows and written out only for the
chapters that need them.

## Consequences

A verse sitemap needs one read for a Bible, and its answer is exact: the chapter shape the
probes missed is listed correctly, and a verse without text is no longer listed.

The response, about 17 KB, grows by a few bytes for a regular Bible and by 0.1 to 16 KB for
the others: under 3 KB for most, 13 to 16 KB for the four French Bibles that often translate
neighbouring verses as one (BFC, FRC97, NFC, PDV2017).

The read now looks at the text of every verse, which the count alone did not: on a local
copy of a complete Bible (31,000 verses) the statement takes 12 ms in PostgreSQL where the
earlier aggregation took 2 ms, and the read 15 ms in all. It saves a round trip to the
database, and the response is kept for thirty days.

No publication is imported again and no migration is needed: the numbers are computed from
the rows the importer already writes.

A client that does not want a page for a title numbered 0 leaves that number out itself.
