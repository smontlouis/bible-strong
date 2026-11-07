# ADR-0106: Add document collections and perspectives to the library

## Status

Accepted.

## Context

The library index (ADR-0103) holds passages of resources the app publishes. The study assistant
should also draw on texts the app does not show: the articles of the Biblical Research Institute
of the General Conference and the adult Sabbath School Bible Study Guide, granted to Bible Strong
and prepared in the private assistant repository (Ellen G. White material left out there).

These additions make the Adventist works the largest block of the library, next to the Seventh-day
Adventist Bible Commentary and the Ellen G. White writings. On a point Christians understand
differently (the millennium, the tongues of 1 Corinthians 14, the state of the dead), the nearest
passages to a question could then all come from one tradition, while the assistant should present
the Adventist reading as one of several.

## Decision

- A **document collection** is imported from prepared JSON lines by `library:collection` as a
  publication of kind `library-collection`, identity `library:<collection>:<language>`
  (`library:bri:en`, `library:sabbath-school:en`). Its documents become passages of the corpus
  `document`, with a heading that names the collection, its tradition and the document, and a
  target that names the collection, the document and its part. There is no table of documents: the
  passages of a document, in order, are its text.
- A new file is a new revision: its passages are written under a staged publication, which then
  replaces the active one in one transaction; the previous passages go with it by cascade. A
  passage whose embedded text did not change keeps its vector. A file whose documents did not change
  leaves the collection as it is. `library:index` does not touch collections.
- The collections known to the code (`search/libraryCollections.ts`) say how to read their
  records, their attribution and their rights. A source slug with other characters than letters,
  digits, dots and hyphens (Greek, « — ») is spelled without them and tagged with a hash. A
  document keeps the address of its source page when the collection has one (BRI).
- The Ellen G. White writings are indexed but returned only to a search that names them
  (`LIBRARY_ON_REQUEST_WORKS`): the assistant reads them only when the reader asks what she wrote.
  The « Ellen G. White Comments » that close the sections of the Seventh-day Adventist Bible
  Commentary, under their own heading, are cut before indexing (3,809 passages on 2026-11-07).
  Adventist understandings otherwise come from the Bible texts, the commentary and the studies.
- A document may name, in English, the points where it departs from the Seventh-day Adventist
  reading: its target then carries them as `divergence`, which the search returns with every hit.
  They stay out of the heading, which feeds both the search by meaning and the search by words. The
  articles of Got Questions (`library:gotquestions:en`, evangelical), sorted and labelled in the
  private assistant repository, carry them, so that the assistant presents such an article there as
  one understanding among others.
- The `LibrarySearch` entrypoint gains `read`, which joins the passages of a document back into its
  text (at most 12,000 characters, cut text reported).
- Every search ranks each language on its own list before fusing them, the other language at
  0.85 of the weight: a question is nearer to passages in its own language, and works published in
  one language only (the BRI articles, Calvin) never reached the candidates of a French question.
  It keeps 100 candidates by meaning and by words, and at most two hits a work, so that a large
  work (70,000 passages of the Ellen G. White writings) does not fill the answer.
- A search may ask for **perspectives**: it then gathers 150 candidates by meaning and by words,
  takes the best passage of each perspective (Adventist, Catholic, patristic, Jewish, evangelical,
  other Protestant, reference works), then the next best ones, one per work. Each hit names its
  perspective, derived from the tradition and tags of its work.

## Consequences

- Text that is not in git lives only in Neon; importing it again needs the prepared file.
- The perspectives are coarse: a tradition such as Lutheran or Methodist counts as Protestant.
  A finer split, or a perspective for Pentecostal works, needs works that hold it.
- A collection in a new language is a new identity, imported from its own file.
- The app does not open these documents: the assistant cites them, with the source page when there
  is one.
