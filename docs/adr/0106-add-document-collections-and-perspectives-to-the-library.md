# ADR-0106: Add document collections and perspectives to the library

## Status

Accepted.

## Context

The library index (ADR-0103) holds passages of resources the app publishes. The study assistant
should also draw on texts the app does not show, such as study articles and Bible study guides
whose publishers allow their use. The assistant repository chooses and prepares them.

When one tradition holds many works, the nearest passages to a question can all come from it,
while on a point Christians understand differently the assistant should be able to give each
tradition its place.

## Decision

- A **document collection** is imported by `library:collection` from a prepared file of JSON
  lines. The first line describes the collection: identifier, title, tradition and tags,
  language and rights. Every other line is one document, with its key, title, authors, date,
  source page, context, Bible reference, text and labels. The collection becomes a publication of
  kind `library-collection`, identity `library:<collection>:<language>`, and its documents become
  passages of the corpus `document`. Each passage has a heading that names the collection, its
  tradition and the document, and a target that names the collection, the document and its part.
  There is no table of documents: the passages of a document, in order, are its text.
- This repository checks and imports what a file says. Which collections exist, how their files
  are prepared and what their labels mean is decided where the files are prepared.
- A new file is a new revision: its passages are written under a staged publication, which then
  replaces the active one in one transaction; the previous passages go with it by cascade. A
  passage whose embedded text did not change keeps its vector. A file whose documents did not change
  leaves the collection as it is. `library:index` does not touch collections.
- A document may carry short labels. They are stored in the target of its passages and returned
  with every hit. They stay out of the heading, which feeds both the search by meaning and the
  search by words.
- A document may also label some of its passages only (`passageLabels`): each entry gives an
  excerpt of the text and its labels, which go to every passage that contains the excerpt, spaces
  collapsed. The prepared file need not know how the text is cut; the import reports the entries
  whose excerpt no passage contains (`unmatchedPassageLabels`). A file without passage labels
  keeps the revision it had before they existed.
- A search may name works to leave out (`excludeWorks`), unless it also names them in `works`.
- The index may cut part of each section of a commentary: the part that matches a pattern of the
  index policy (`--policy` or `RESOURCE_LIBRARY_POLICY`), a file kept with the assistant.
- The `LibrarySearch` entrypoint gains `read`, which joins the passages of a document back into its
  text (at most 12,000 characters, cut text reported).
- Every search ranks each language on its own list before fusing them, the other language at
  0.85 of the weight. A question is nearer to passages in its own language, and works published in
  one language only never reached the candidates of a question in the other. A search keeps 100
  candidates by meaning and by words, and at most two hits a work, so that a large work does not
  fill the answer.
- A search may ask for **perspectives**. It then gathers 150 candidates by meaning and by words,
  takes the best passage of each perspective (Adventist, Catholic, patristic, Jewish,
  evangelical, other Protestant, reference works), then the next best ones, one per work. Each
  hit names its perspective, derived from the tradition and tags of its work.

## Consequences

- Text that is not in git lives only in Neon; importing it again needs the prepared file.
- The perspectives are coarse: a tradition such as Lutheran or Methodist counts as Protestant.
  A finer split, or a perspective for Pentecostal works, needs works that hold it.
- A collection in a new language is a new identity, imported from its own file.
- The app does not open these documents: the assistant cites them, with the source page when there
  is one.
