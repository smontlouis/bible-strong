# ADR-0072: Read Strong entry cards and a simple entry in one statement

## Status

Accepted

## Context

[ADR-0070](./0070-read-a-detailed-strong-entry-in-one-statement.md) brought a detailed
Strong entry to one statement and left the other lexicon reads as they were. Two of them
are read on every uncached rendering of a public Strong page and of a public verse page:
the simple entry (`GET /v1/strong-lexicon/entries/:reference` with `level=simple`) and the
entry cards of a list of identities (`GET /v1/strong-lexicon/entries/batch`). A simple entry
is the card of its reference, so both are one read.

That read ran 7 to 9 statements, each waiting for the previous one: the publication, the
identities named, those written in another case, their entries, the entries that carry a
reference no identity names, then identities, translations, morphology codes and their
translations. With a round trip of about 36 ms a simple entry took 0.31 s in production and
a batch 0.32 to 0.40 s, against 0.17 s for a detailed entry.

One statement was slow in PostgreSQL too. The page of a classical number asks for the 53
codes its senses can carry (`H0430`, `H0430A` … `H0430z`); most name no identity, and the
entries carrying one of them were looked up with one condition per code on every entry of
the lexicon: 30 ms on a local copy.

The three concordance reads of the same page (`counts`, `occurrences` and `lemmas` under
`/v1/strong-bibles/:version/books/:book/identities/:reference`) ran 4 to 5 statements: the
index publication, the Bible text it was aligned on, the identity, the rows, and the spans of
the verses for `occurrences`. The identity was looked up once per spelling a reference may
have, so a code the index does not hold cost as many statements as it has spellings before
answering nothing: 8 for `H0430z`.

## Decision

Entry cards are read with one statement, written like the one of a detailed entry: common
table expressions gather the publication and every row the cards are made of, and return
them as one row of JSON columns. The cards are composed in TypeScript by the function that
composed them before.

The statement only fetches. Two choices depend on rows it reads itself: which reference
written in another case names a single identity, and so which references are left for the
entries that carry them. It returns the candidates of both, each entry with the values it
was matched on, and TypeScript chooses with the rules of the earlier read.

The entries that carry a reference are looked up once per way of carrying it (extended,
disambiguated or unified code, classical number), each on the index that serves it. No
index is added.

The earlier read stays in the repository as `entryCardsRead: 'statement-by-statement'`. It
is not used at runtime: it is the reference the single statement is tested against, on
fixtures and on the complete publications. Both reads share the row choices and the
composition.

The concordance reads keep their statements for the rows, and read what comes before them
together: the index publication, the Bible text and the identities a reference may name are
one statement. The identity is then chosen in the order its spellings were tried.

## Consequences

A simple entry and a batch of cards cost one round trip. With a simulated 36 ms round trip,
local reads go from 270 ms to 43 ms for a simple entry, from 400 ms to 58 ms for the senses
of a number and from 356 ms to 49 ms for the words of a verse. In PostgreSQL the statement
takes 1 to 2 ms for an entry, 4 ms for the words of a verse and 8 ms for the senses of a
number, where the earlier statements took 2, 5 and 32 ms in all.

The response is unchanged: the 939,286 reads compared on the complete lexicon (every
identity under each kind, every classical number, every code an entry carries, the case
variants, the 53 codes of every number and 12,000 mixed batches, in the detailed lexicon and
in the two simple ones) returned the same JSON as before, with 939,286 statements where the
earlier read ran 6.6 million.

`counts` and `lemmas` run 2 statements instead of 4, `occurrences` 3 instead of 5, and a
reference the index does not hold 1 instead of 3 to 10. The chapter and the coverage of a
Strong Bible save one statement as well. The responses are unchanged: the 162,844 reads
compared on the complete LSG and KJV indexes are identical, with 325,501 statements where
they ran 716,455.

The rows of a concordance read are still read in a second statement, and its time in
PostgreSQL is unchanged: 2 to 7 ms for `counts`, 10 to 35 ms for `lemmas` on the most
frequent words, 12 to 28 ms for the spans of 100 verses, half of it spent planning a
condition per verse.

No migration is needed and no publication is imported again.

A change to the cards must keep both reads equal until the statement-by-statement read is
removed, as for a detailed entry.
