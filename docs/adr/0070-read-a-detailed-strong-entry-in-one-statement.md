# ADR-0070: Read a detailed Strong entry in one statement

## Status

Accepted

## Context

A detailed Strong lexicon entry (`GET /v1/strong-lexicon/entries/:reference`, without
`level=simple`) is assembled from three publications that are activated independently:
`strong-lexicon:core`, `strong-lexicon:resources` and `strong-lexicon:entities`
([ADR-0064](./0064-separate-simple-and-detailed-strong-lexicons.md)). The repository read
it with 17 to 27 statements, each waiting for the previous one: the entry, its identity,
its translation, its relations and their targets, every relation kind, every morphology
code, the state of the two addons, the dictionary articles, the entity and its relations.

The Worker opens one connection per request, so each statement is a round trip to Neon
through Hyperdrive. An uncached entry took 0.76 to 1.1 s in production, against 0.26 s for
the five statements of a simple entry and 0.08 s for a cached response. On a local copy of
the lexicon (22,717 entries) the same statements take 13 to 28 ms in all: the time is spent
waiting on the network, not in PostgreSQL.

Storing each entry as a finished document, written at import and read by primary key, was
considered. An addon is only read while its declared core revision is the active one, so
documents kept per module would stay correct. It would still need three tables, an
assembly of the 22,717 entries in both languages at each import, about as much storage
again as the lexicon, and a backfill of the publications already active in production,
which cannot be imported again under the same revision. It would save a few milliseconds
of PostgreSQL time over a single statement, and the read would keep a fallback for
publications without documents.

## Decision

A detailed entry is read with one statement. Common table expressions gather the three
active publications, the entry and every row the response is made of, and return them as
one row of JSON columns. The response is then composed in TypeScript by the functions that
composed it before.

The statement only fetches. It applies the filters and the row order of the earlier
statements. Where a choice depends on text normalisation (the entity named like an entry,
the classical number a relation names) it returns the candidates, and TypeScript chooses.

Rows are matched through the typed columns that the importer projects from each payload
(`entry_id`, `e_strong`, `d_strong`, `u_strong`, `entity_id`, `to_entry_id`…), which are
the indexed ones, instead of the payload fields the earlier statements filtered on. The
importer is the only writer of these tables, and the complete-publication integration test
checks that the columns hold the payload values.

`content=definitions` builds the statement without the addon tables.

The earlier read stays in the repository as `detailedEntryRead: 'statement-by-statement'`.
It is not used at runtime: it is the reference the single statement is tested against, on
fixtures and on the complete publications. Both reads share the row choices and the
composition, so they can differ only in how rows are fetched.

`strong_lexicon_entries` gains an index on `(publication_id, u_strong)`, as
`strong_lexicon_entities` already has: an entity names its lexical entries by their unified
code, and no index led with it.

Simple entries, entry cards, the entity route and the other lexicon reads are unchanged.

## Consequences

An uncached detailed entry costs one round trip whatever it contains. With a simulated
36 ms round trip, local reads go from 680–1,085 ms to 41–45 ms. The statement itself takes
2 to 6 ms on a local copy of the lexicon.

The three publications are read in the snapshot of one statement. An activation can no
longer fall between two reads of the same response.

The response is unchanged, byte for byte, as are its revision and ETag: the 143,591 reads
compared on the complete lexicon (every identity in both languages, every classical
number, every identity kind) returned the same JSON as before.

No publication is imported again and nothing is backfilled. The index is optional for
correctness: without it the statement returns the same rows and takes up to 10 ms locally,
on the entities that have the most relations.

The statement is long, and a new kind of row means a new expression in it and a new field
in the composition. A change to the response must keep both reads equal until the
statement-by-statement read is removed.

A change to how the importer projects a payload into typed columns now changes this read.
