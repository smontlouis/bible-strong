# ADR-0103: Search the library by meaning for the study assistant

## Status

Accepted.

## Context

The study assistant finds Bible Strong resources only by title or by verse. Its dictionary, Nave,
profile and timeline searches compare the words of the question with article titles, and a
commentary is reached only from the verse it comments. A 150-question bench (private repository,
2026-11-06) showed what this costs: the model spends its six reads guessing titles (six searches
for « l’exil à Babylone »), and some answers exist in the library without any way to reach them,
such as the Adventist commentary on Revelation 20 for « the Adventist position on the millennium ».

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
  (k = 60). Words exclude function words in French, English and Spanish and match any of the
  remaining ones. Filters (corpus, language, tradition and tags, work, book and chapter) apply
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
- The vector floor is not set: the nearest passages are always returned. It is to be calibrated
  on the real index with the assistant bench.
- A public library search for the app or the site would be a route over the same repository,
  decided with the screen that needs it.
- Other text corpora (books, articles) can join through a builder that yields passages with a
  `target` their own read route understands.
