# ADR-0103: Search the library by meaning for the study assistant

## Status

Accepted.

## Context

The study assistant finds Bible Strong resources only by title or by verse. Its dictionary, Nave,
profile and timeline searches compare the words of the question with article titles, and a
commentary is reached only from the verse it comments. A 150-question bench (private repository,
2026-11-06) showed what this costs: the model spends its six reads guessing titles (six searches
for « l’exil à Babylone »), and some answers exist in the library without any way to reach them,
such as the commentaries on Revelation 20 for « the views of the millennium ».

The thematic search already embeds Bible topics with `@cf/qwen/qwen3-embedding-0.6b` in
PostgreSQL with pgvector (issue 325). The assistant reaches this service through a service
binding, whose requests carry no client address and so share one rate-limit bucket.

## Decision

- A `library_passages` table indexes passages of the active commentaries (all 37 publications),
  dictionaries (each work in its language; the legacy `dictionary:fr` and `dictionary:en`
  aggregates repeat a work and are left out), Nave topics, timeline events and the people and
  places profiles of `strong-lexicon:entities`.
- A passage is plain text of at most 1,800 characters, cut at paragraphs, then sentences. It
  keeps a heading that names its work, tradition and reference, the identifiers the existing
  read routes need (`target`), its language, and the verses it comments.
- Each passage has a `halfvec(1024)` vector of the same Qwen model under its own contract
  (`library-qwen3-v1`) and a `tsvector` in the configuration of its language. HNSW and GIN
  indexes serve them; half precision halves the storage of the 650,000 passages.
- A search fuses the nearest passages by meaning and by words with reciprocal rank fusion
  (k = 60). Words exclude function words in French, English and Spanish; of the remaining
  lexemes, the rarest ones are kept while they match about 3,000 passages in all, and any of
  them may match. `library_lexemes` counts the passages of every lexeme found in more than 300
  of them (10,026 lexemes, rebuilt with `ts_stat` in about 2 min after an index run that changed
  passages); PostgreSQL's own column statistics list only the 1,000 most frequent ones. The frequent ones are left
  to the search by meaning: ranking reads every matching passage, and the 77,000 passages
  holding « testament » took 3 s, 15,000 passages up to 6.5 s on a cold cache. Both searches
  run at the same time. Filters (corpus, language, tradition and tags, work, book and chapter) apply
  inside the HNSW walk with pgvector's iterative scan. One hit per resource is returned, in the
  first requested language when a commentary exists in both.
- Rows belong to their publication and are deleted with it. `library:index` indexes every active
  publication and embeds only passages whose embedded text changed; a run after a republication
  indexes the new publication in full.
- The assistant calls the search through a named RPC entrypoint, `LibrarySearch`, exported by the
  Worker's main module (`src/runtime/entry.ts`). It is reachable only through a service binding
  that names it: there is no public route and no per-address limit. The search code and the
  database client load on the first call.

## Consequences

- About 650,000 passages and 185 million embedded tokens for a full build, about $2 of Workers AI
  at $0.012 per million tokens, and roughly 5 GB in Neon with the indexes.
- A republished commentary or dictionary is unsearchable until the next `library:index` run.
- A first build of 674,693 passages took 1 h 25 from a Mac (2026-11-07), 5.2 GB with the indexes,
  of which 1.76 GB for HNSW. Workers AI refused some batches with internal errors; the import
  splits a refused batch until the refused passage is left out and reported.
- The vector floor is not set: the nearest passages are always returned. It is to be calibrated
  on the real index with the assistant bench.
- A public library search for the app or the site would be a route over the same repository,
  decided with the screen that needs it.
- Other text corpora (books, articles) can join through a builder that yields passages with a
  `target` their own read route understands.

## Amendment of 2026-11-11: whole passages and sections

### Context

A hit carried only the first 700 characters of its passage, and a passage is at most 1,800
characters of a section that may hold several. On the production index, 17 % of the 491,281
sections are cut into several passages, and they hold 44 % of the 721,133 passages: the long
commentaries, articles and dictionary entries, where a hit is a fragment of an argument. A caller
that wants to answer from the hits without opening each resource needs their whole text.

### Decision

- A search may ask for at most 25 hits (10 before).
- `fullText: true` adds `text` to every hit: its whole passage. `snippet` is unchanged.
- With it, `sections: n` (at most 10) gives the `n` best hits by score their whole section as
  `text`: every passage of the same section in order, when the section holds at most 6,000
  characters, otherwise the passage found with the one before and after it, an ellipsis marking
  the cut. A section of one passage is that passage.
- Without these fields, a search returns what it returned before.

### Consequences

- A search with sections makes one more query, on the primary keys of the sections it expands.
- On the assistant's bench (private repository, 2026-11-11), 25 hits with 8 whole sections gave
  answers at least as good as 5 snippets, faster and cheaper, because the model no longer opens
  the resources one round at a time.

## Amendment of 2026-11-11: a search within each perspective

### Context

`perspectives: true` (ADR-0106) keeps the best hit of each perspective among the 150 nearest
passages of the whole library. A small tradition reaches that pool only when one of its passages
happens to be near the question: the 5,782 Catholic passages are 0.7 % of the index, the
patristic ones exist in French only, and on many questions the pool held none of them. A caller
that wants every tradition heard needs each one searched on its own.

### Decision

- `perPerspective: n` (1 to 4) adds `perspectiveHits` to the result: up to `n` hits of each
  perspective, one per work first, in the order of `LIBRARY_PERSPECTIVES`, best first within each.
  Each perspective is searched by meaning (its nearest passages in each language) and by words
  (its best ranked passages), fused by reciprocal rank as the plain search is. `hits` is
  unchanged, and the query is embedded once for both.
- A perspective is a list of works: the works of the active publications, read by primary key
  (one passage each, 22 ms for 123 publications), are sorted with `perspectiveOf`. The lists filter
  on `work`, so the planner walks the vector index or reads a small work whole. A filter on
  tradition and tags read most of the index (12 to 21 s a search on 2026-11-11), and a perspective
  without a work in a language would walk all of it: it gets no list in that language.
- The lists of the perspectives run beside the plain ones, spread over three statements on their
  own connections; the entrypoint opens five connections for such a search instead of two.
- `perspectiveSections: n`, with `fullText`, gives the first `n` hits of each perspective their
  whole section, by the rule of `sections`.
- `labelledDocuments`: in these perspectives, a document counts only when it carries labels
  (`target.labels`). A collection labels the documents that argue a view, so a caller can ask for
  those alone.
- `perspectiveExcludeWorks` replaces `excludeWorks` for the search within each perspective, which
  otherwise takes the same exclusions: a work can stay out of every plain search and still speak
  for its perspective.
- Without `perPerspective`, a search returns what it returned before.

### Consequences

- Warm, the database answers the lists of all perspectives in about 300 ms when one statement
  runs them one after the other, and about a third of that side by side; cold pages cost more.
  From a laptop on 2026-11-11 the search took about 0.5 s more in the median.
- Every perspective with a work in a language gets its nearest passages there, however far they
  are from the question: the caller decides what to do with a remote excerpt.
- Two perspectives join the list for the collections being added: `orthodox` (a tradition or
  tag naming Orthodoxy) and `academic` (critical, university or modernist exegesis, whatever its
  authors' confession), sorted before `protestant`. Until a work of theirs is indexed they have no
  list and no hit.
- The Jewish perspective is tested before the Orthodox one: Malbim is tagged « Orthodoxe
  moderne ».
- A hit found by meaning carries `distance`, the cosine distance of its passage to the query.
  Scores rank hits within one search; the best hit of a perspective always ranks first in its own
  lists, however far it is, so a caller that wants a relevance floor reads the distance.
- After 30 more works were imported the same day, the lists of a rare perspective in a language
  (the Catholic works in English) walked pgvector's 20,000 tuples, about a second cold. Each list
  by perspective now asks for 12 passages and stops after 5,000 tuples, keeping what it found;
  from a laptop the vector part went from 1.1 s to 0.4 to 0.85 s in the median.
- The entrypoint and the development server keep the vectors of the last 64 queries for ten
  minutes in the isolate (`withQueryEmbeddingCache`): the assistant asks for the search within each
  perspective after the wide search of the same question, and that call no longer embeds it again.

## Amendment of 2026-11-12: an index for each large perspective

### Context

After the imports of 2026-11-11 the library holds 1,009,757 passages, and the search within a
perspective walked the shared vector index with a filter on the perspective's works, stopping after
5,000 tuples. The perspectives are 82,000 (Adventist, 152,000 with the writings of Ellen G. White)
to 307,000 passages (Protestant); in a language where a perspective is rare, the walk stopped
before it reached the perspective's works.

### Decision

- `perspectiveOf` also exists in SQL (`LIBRARY_PERSPECTIVE_SQL` in `src/search/libraryPerspectives.ts`),
  an immutable expression of `tradition` and `tags`. Migration 0041 creates one partial HNSW index
  per large perspective with that expression as predicate: Adventist, Catholic, patristic, Jewish,
  evangelical, academic and reference works. The Protestant perspective, a third of the library,
  keeps the shared index; the Orthodox one, a few hundred passages, is read whole.
- A list of an indexed perspective repeats the index's predicate, so the planner walks that index;
  the other lists filter the shared index on their works, as before. No column is added: filling one
  would have rewritten the million rows and the shared index, and a work imported later joins its
  perspective's index by itself.
- The integration test checks that the SQL rule places every catalog work where `perspectiveOf`
  does, and that each index can serve its perspective's list. On production on 2026-11-12 it placed
  the 99 works of the 106 active publications as `perspectiveOf` does.
- `searchLibrary` takes `{ perspectiveIndexes: false }`, and the development server
  `RESOURCE_LIBRARY_PERSPECTIVE_INDEXES=off`, to search as before for a bench.

### Consequences

- The seven indexes take 1.83 GB on Neon (the database went from 19 to 20 GB) and were built in
  5 min 40 s with `maintenance_work_mem` at 1 GB; the table refused writes meanwhile. Every passage
  written to the library is now also inserted in its perspective's index.
- On production every list of an indexed perspective walks its own index and returns its 12
  passages, where the Catholic list in English returned 6 and the patristic one in English 1. Cold,
  a new index costs seconds on its first reads (9 s for the first search); warm, a search within
  each perspective took 1.95 s in the median from a laptop, against 1.7 s on the shared index: the
  indexes buy coverage, not speed.
- The Neon file cache holds 2.2 GB; the new indexes compete with the shared one for it.
- On the assistant's bench of 2026-11-12 (private repository, ADR-0107), answers built on the
  family indexes were no better than on the shared index (−0.08 ± 0.15 on the debated points), and
  the search within each perspective was slower (1.36 s in the median from a laptop, against
  0.87 s).

## Amendment of 2026-11-12: the family indexes dropped

Migration 0042 drops the seven partial indexes of 0041 (in 3 s on production, which went back to
19 GB), and the search within a perspective filters the shared index on its works again, with the
bounds of the first amendment. `perspectiveOf` stays in `src/search/libraryPerspectives.ts`; its
SQL form and the `perspectiveIndexes` option are gone. What kept the new works out of the
assistant's excerpts was its own filter on unlabelled documents (private ADR-0107), not the index.

## Amendment of 2026-11-12: the vectors in Vectorize

### Context

With 1,009,757 passages the HNSW index takes 2.63 GB, more than the file cache of Neon (2.2 to
3 GB). In production the search by meaning took 4.3 to 9.7 s on 2026-11-12, and both preloads of
the assistant ran past its 4 s timeout. The vectors are only read by this search: the passages, the
search by words and the publications stay in Neon.

### Decision

- The vectors are also kept in Cloudflare Vectorize, one index per language
  (`bible-strong-library-fr`, `bible-strong-library-en`, 1,024 dimensions, cosine). Neon stays the
  source of truth: `library_passages.embedding` is kept, and every vector of an index is a copy of
  it, never embedded again.
- In a shared index, the search lost the nearest passages of a list in the other language than
  the question: the approximate search explores the regions nearest the query, which hold passages
  of its language, and a namespace or filter only then keeps the others.
- Each vector has an identifier and indexed metadata.
  - Its identifier is `<publication id>:<passage key>`. A key that does not fit Vectorize's 64 bytes
    becomes `<publication id>:<start of the key>~<11 characters of its SHA-256>` (3,877 passages);
    the query that reads the passages finds it among the keys of its publication that start alike.
  - Its indexed metadata are `work`, `corpus`, `perspective`, `book`, `chapter`, `labelled` (false
    for a document passage without labels) and `bucket` (0 or 1, from a hash). A new filter field
    needs its metadata index before any vector, so every vector would be written again.
- `LIBRARY_VECTOR_BACKEND` (`pgvector` by default, or `vectorize`) chooses where `LibrarySearch`
  takes the nearest passages; its input and output do not change.
  - With Vectorize, the lists keep their filters. `traditions` becomes the works whose tradition or
    tags match, which is exact, since every passage of a work shares them.
  - The first 100 passages of a list are scored on the stored vectors (`returnValues`: two queries
    of 50, one per bucket). A deeper list (the 150 candidates of `perspectives`) is completed with
    Vectorize's scores on its compressed vectors, which are 0.03 to 0.1 farther than the exact
    distance and only approximately ordered.
  - The `distance` of a hit is read from Neon for the hits alone.
- Vectorize follows Neon two ways.
  - `library:index` and `library:collection` with `--vectors` write what they change: the passages
    they wrote are upserted from their rows, the deleted ones and those of the revisions a
    collection replaces are deleted.
  - `library:vectors:sync` lists every identifier of both indexes, upserts the passages of active
    publications that are missing, and deletes the others. A republication of a commentary or
    dictionary deletes the passages of its previous publication by cascade, which no writer
    reports, so `library:index --vectors` ends with this reconciliation unless `--no-reconcile`.
  - A reconciliation that would delete more than a quarter of an index (and more than 1,000
    vectors) stops unless `--allow-mass-delete`: compared with a local database, it would empty
    the production indexes.
  - The vector writers take the lock of the index runs. `--vectors` is never the default, so that
    a local run does not write the production indexes.

### Consequences

- These figures come from the assistant's 292 bench questions on 2026-11-12, against exact
  neighbours computed by brute force on the exported vectors.
  - The 10 nearest passages of a wide list are found 98 % of the time in French and 99 % in
    English, against 99 % and 95 % with pgvector.
  - The 12 nearest of a perspective are found 93 % and 97 % of the time, against 86 % and 61 %:
    pgvector's walk stops after 5,000 tuples.
  - The final hits of `LibrarySearch` are those of an exact search 96 to 97 % of the time, against
    92 to 94 % with pgvector.
- Measured from a Worker on 98 questions:
  - the wide preload took 0.94 s in the median and 3.8 s at the 95th percentile, against 2.27 s
    and 6.8 s, and 4 searches ran past 4 s against 23. All 4 were waiting for the query embedding
    of Workers AI (332 ms in the median, 3.6 s at the 95th percentile, up to 12 s, spread over the
    run: not a cold start).
  - The search within each perspective sends about 21 precise queries side by side: 1.29 s in the
    median against 0.79 s, 1.8 s at the 95th percentile for both.
- About 1.035 billion stored dimensions. Vectorize counts them each month as queried dimensions
  as well: about $10.4 a month fixed, then about $0.00001 a query. An assistant question sends
  about 20 queries, about $6 a month for 1,000 questions a day.
- Vectorize applies writes seconds to minutes later; its REST API takes at most 5,000 vectors (or
  100 MB, uncompressed) an upsert, 100 identifiers a deletion, 20 a read, and lists 1,000
  identifiers a page in about 1.1 s. A reconciliation lists both indexes in about 11 min, side by
  side.
- The HNSW index stays until the switch has run in production for a while; dropping it is decided
  then. Once it is gone, going back to pgvector needs the index built again, about 6 min with 1 GB
  of `maintenance_work_mem`.

## Amendment of 2026-11-12: a late query vector is asked twice

### Context

The query vector is the slow part of a search that the vectors of Vectorize made fast. Workers
AI serves `@cf/qwen/qwen3-embedding-0.6b` with a heavy tail: a question of at most 31 tokens took
the following.

| Measure | Median | p90 | p95 | Max | Over 1 s |
|---|---|---|---|---|---|
| AI Gateway logs, 200 calls | 0.48 s | 2.3 s | 4.0 s | 8.3 s | 24 % |
| Called directly, 40 calls | 0.54 s | 3.7 s | 5.4 s | 8.1 s | 25 % |
| `@cf/baai/bge-m3`, alternated with the above | 0.18 s | 0.54 s | 0.66 s | 0.67 s | 0 % |

- **It is the Qwen3 model.** The tail is neither AI Gateway (direct calls have it too) nor our code
  (BGE-M3 stays fast in the same minutes).
- **It is not the capacity queue Cloudflare documents.** With `rejectIfBusy` no call was refused,
  and the tail was the same.
- **Slow calls fall at random.** Within a minute one call takes 0.1 s and the next 5 s. After a
  slow call the next one was slow 3 times in 10.

In production on 2026-11-12, a question's vector took 3.1 s, and its preload ran out of its 4 s.

### Decision

- **The second call.** A query vector not back after `QUERY_EMBEDDING_HEDGE_MS` (600 ms) is asked
  again with the same text, without cancelling the first call. The first answer serves, and the
  other is ignored. A first call that fails early starts the second at once.
- **The bound.** After `QUERY_EMBEDDING_TIMEOUT_MS` (2 s) the query has no vector, and the search
  goes on by words alone, as it already did when the embedding failed. The bound is 10 s on the
  development server, whose benches measure answers, not speed.
- **The log.** `library search` logs `embeddingAttempts` and `embeddingTimedOut`. When they are
  absent, the vector came from the isolate's cache.
- The model and the index are unchanged. Documents are embedded as before.

### Consequences

- About a third of the questions get a second embedding call, of 31 tokens at most: a negligible
  cost.
- A wait of several seconds should mostly become about one second. Our estimate is that 3 to 4 %
  of the vectors stay above 1.5 s, against about 15 %; the logs will tell.
- A search that reaches the bound gives excerpts found by words, which are weaker than by meaning
  but better than a preload that runs out with none.
- Moving to BGE-M3 would remove the cause. It needs the million passages embedded again and a
  bench of their recall and relevance, since Qwen3-Embedding usually ranks above it on
  multilingual retrieval. That is decided only if the tail stays after this change.
