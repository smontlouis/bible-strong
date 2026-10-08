# ADR-0074: Read the senses of a Strong number in two reads

## Status

Accepted

## Context

The public site has a page for each classical Strong number the lexicon splits into senses
([ADR-0068](./0068-serve-indexable-resource-pages-from-the-public-site.md)). It lists every
sense with what tells it apart and the books it is read in. The Resource API had no read
for that, and the page asked the reads of a sense once per sense: the cards of the 53 codes
a sense of the number can carry (`GET /v1/strong-lexicon/entries/batch`), to learn which
senses exist, then the detailed entry of each
(`GET /v1/strong-lexicon/entries/:reference`) and its verses by book
(`GET /v1/strong-bibles/:version/books/:book/identities/:reference/counts`). With the entry
of the number at both levels, its own verses and their text, that is 2N+6 reads for N
senses: 10 for two senses, 30 for twelve, 66 for the thirty men named Zechariah (`H2148`).

Of a detailed entry the page keeps two values: the brief of its entity, who the person or the
place is, and its notice, of which the first line is shown when no entity tells the sense
apart. Of the counts it keeps the books and their sum.

[ADR-0070](./0070-read-a-detailed-strong-entry-in-one-statement.md) and
[ADR-0072](./0072-read-strong-entry-cards-in-one-statement.md) made each of these reads one
statement. Their number stayed. A new Worker instance spends 270 to 720 ms of CPU on its
first uncached read, and a page that sends dozens of uncached reads at once wakes many
instances: such pages took 0.9 to 3.0 s on their first rendering, where a page of six or
seven reads takes 0.3 to 0.7 s. The site passed sixteen of them at a time, three to six
rounds for the largest numbers, each as long as its slowest read.

The senses of a number are also asked for by the page of each sense, which names the page of
its number or lists its sibling senses, and by the concordance of a number, which is sent to
that page.

The lexicon and the Strong Bible indexes are published and activated independently, and the
Worker keeps a response under the revisions of the publications it reads.

## Decision

Two reads answer what the page asked sense by sense, each in one statement and from one
family of publications.

`GET /v1/strong-lexicon/numbers/:number/senses?language=…` answers the senses the simple
lexicon of a language files under a classical number. A sense is its row in that lexicon
(identifier, code, classical number, word, transliteration, gloss), followed by what its
entry in the detailed lexicon tells it apart by, when it has one: `detailedDefinitionHtml`,
its notice, and `entityBrief`, the brief of its entity. The rule that turns these into the
line a page shows stays in the site. A number the lexicon does not hold has no sense, and
answers with an empty list that the Worker keeps like any other.

`GET /v1/strong-bibles/:version/books/:book/identities/batch/counts?references=…` answers,
for up to a hundred references, what the counts read of each answers: its identity and its
verses by book, in the order asked, and nothing for a reference the index does not hold.

The senses are those the page found: the cards of the 53 codes are read by the statement of
entry cards, whose common table expressions and columns the new statement begins with, and
are composed by the same function. The statement then reads, for the identities of those
entries, the detailed entry written like each, its translation, the entities filed under its
codes or under its classical number, and their translations. TypeScript chooses the entity
and words the notice and the brief with the functions a detailed entry is composed with.

A detailed entry is found there by the identity written like the code of the sense, which is
how every published sense is named: the simple and the detailed lexicons hold the same
22,717 identities, all in the spelling a reference is normalised to. A code written
otherwise, or one the detailed lexicon does not name, is read by the statement of a detailed
entry, which knows the other ways an entry carries a code: a second statement that no
published lexicon needs, and that keeps the answer equal to the earlier reads on any other.

The counts of several references are one statement: the index, the Bible text it was aligned
on, the identities the references may name and the counts of each. Which identity a
reference names is chosen in TypeScript by the rule of the counts of one reference.

Both earlier ways stay in the repositories as `numberSensesRead: 'read-by-read'` and
`referenceCountsRead: 'read-by-read'`. They are not used at runtime: they read as the page
did, and are the reference the single statements are tested against, on fixtures and on the
complete publications.

The Worker keeps both responses for thirty days, like the other revisioned reads. The senses
are kept under the revisions of the simple lexicon of their language, of the detailed
lexicon and of its entities, the three publications they are read from; the counts under the
revision of their Strong Bible index.

The page of a number asks the lexicon for its senses and the Bible for the verses of the 52
codes a sense can carry at the same moment, without waiting for the senses to know which
codes exist. A sense named otherwise would be counted by a second read; no published sense
is. The site no longer reads the cards of the 53 codes nor any sense of a number, and its
Strong pages keep six reads in flight at most, like its other pages.

The read of the senses answers every number. A site that receives no answer is talking to a
Resource service older than the read: it fails the page, which is then not kept, rather
than take a split number for one without senses and redirect it.

One read answering the whole page was considered. It would read the lexicon and a Strong
Bible index together, so its response would be kept under the revisions of both families,
and it would be of no use to the pages of a sense. Adding the brief of an entity to the
cards of a batch was considered too: the page would still ask for 53 codes twice, in the
simple lexicon for the senses and in the detailed one for their notices, and every other
reader of the batch would receive a field it does not use.

## Consequences

The page of a number reads eight documents whatever the number of its senses, two reads
deep, where it read 10 to 66, three reads deep and three to six rounds long. Over the 1,501
numbers with several entries, in both languages, that is 23,949 reads where there were
36,507: most numbers have two or three senses, and the gain is that of the largest. The
pages of a sense are unchanged in number: six reads, or seven for a sense of a split number.

Against a local Worker and a local database, every read uncached, the data of the page of
`H2148` is loaded in 86 ms where it took 377 ms, that of a number of twelve senses in 71 ms
where it took 187 ms, that of a number of two senses in 60 ms where it took 77 ms. There the
network costs nothing and one instance answers everything; in production each read is a
round trip to the database and a burst of them wakes new instances, so the page of a number
should take what a page of six or seven reads takes.

The page is the same. The loader of the site before and after the change, run over the same
recorded answers, gives identical data for those 1,501 numbers in both languages, and for a
sample of every other kind of Strong page: senses, redirects, unknown codes, concordances
and previews.

The answers are those of the earlier reads. On the complete lexicon, the senses of every
classical number in both languages (39,140 reads, 45,430 senses) are the ones the cards and
the detailed entries give, with one statement each where those reads ran 84,570. On the
complete LSG and KJV indexes, the counts of 239,686 references, asked a hundred at a time
and as the 52 codes of every split number, are those of the counts read of each reference,
with 7,060 statements where they ran 310,750.

In PostgreSQL the senses of a number take 8 to 12 ms on a local copy of the lexicon, of
which 7 to 10 are the statement of the cards, and the counts of the 52 codes of a number 1
to 2 ms. The largest answer weighs 25 KB, the thirty senses of `H2148` 12 KB, and half of
the split numbers answer in less than 1 KB.

No migration is needed and no publication is imported again.

The Worker must be deployed before the site that asks for these reads: an older Worker
answers neither, and the pages of every number and of every sense written with a letter
would fail until it is.

A sense page now receives the notices of its sibling senses, which it does not show: it
shares the read of the number page, and its cached answer.

The statement of the senses begins with the one of entry cards. A change to the cards
changes both, and a change to how a detailed entry chooses its entity or words its notice
must keep the functions both reads share, until the read-by-read references are removed.
