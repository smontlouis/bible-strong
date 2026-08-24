# Thematic search sources

The thematic search index is an online-only derived index. It stores canonical references and
loads displayed Bible text from the version selected by the user. It never imports or redistributes
ESV text from OpenBible.

## Sources and rights

| Source | Imported data | Rights and attribution |
|---|---|---|
| Existing Bible Strong Nave publication | Topic identity and existing verse links; the search index does not copy Nave verse associations | Nave's Topical Bible (Orville J. Nave, 1896), public domain; current digitisation provenance remains attached to the Nave publication |
| [NEUU Bible Topics Dataset](https://github.com/neuu-org/bible-topics-dataset) | Torrey topics, canonical references, Nave/Torrey `see also` relations, source identity | Bible Topics Dataset by NEUU, used under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). It derives from public-domain Nave (1896) and Torrey (1897) works and credits CCEL digitisation. The exact Git commit is recorded per import. |
| [OpenBible.info Topical Bible](https://www.openbible.info/topics/) | Topic, OSIS range, quality score and matching raw vote count | OpenBible.info topical data, used under Creative Commons Attribution. Snapshot generation date and SHA-256 hashes are recorded per import. |

The importer retains source name, source key, version, hash and per-association provenance. The
controlled French alias layer is maintained in
`resource-service/src/search/topicFrenchAliases.ts`; every value is marked
`editorial-controlled` and `validated`. The full English catalog is not silently machine
translated.

## Reference and ranking policy

- References are normalized to Bible Strong book/chapter/verse coordinates.
- Unsupported books and invalid references are rejected and counted in the import report.
- A reference is shown only when the selected active Bible publication contains both its starting
  and ending verse.
- Psalm references are adjusted against the ESV/default reference versification when the selected
  publication contains one or two explicit superscription verses.
- The result explanation identifies lexical, topical, semantic, or hybrid retrieval and lists its
  topical sources.
- Reciprocal Rank Fusion combines lexical and thematic ranks. Exact/controlled topic matches are
  weighted above fuzzy topic matches, which are weighted above vector-only similarity.

## Vector representation

The thematic search uses the non-generative multilingual embedding model
`@cf/qwen/qwen3-embedding-0.6b` through Workers AI. It produces 1,024-dimensional vectors stored in
PostgreSQL `pgvector`; it does not produce answers, prose, theology, or references. Topic documents
contain the canonical English name plus English aliases and validated French aliases. Queries use
Qwen's explicit asymmetric format
`Instruct: <fixed retrieval task>\nQuery: <normalized query>` and the same versioned vector space.
The runtime accepts vector-only topics only above the locally measured cosine floor and skips
obviously non-linguistic noise. Quoted phrases remain strictly textual.

Each stored vector records the model, embedding contract, dimensions, and SHA-256 of its exact
input document. A model or prompt-contract change requires a complete transactional rebuild; the
runtime never silently falls back to another vector space. Exact and controlled topic matches stay
above vector-only similarity in the fused ranking. See
[`docs/research/issue-325-real-embeddings.md`](../research/issue-325-real-embeddings.md) for the model
comparison and operational decision record.
