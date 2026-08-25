import {
  TOPIC_EMBEDDING_CONTRACT,
  TOPIC_EMBEDDING_MIN_SIMILARITY,
  TOPIC_EMBEDDING_MODEL,
} from './topicEmbedding'

// Bump the index revision after importing a new thematic dataset, and the ranking revision
// whenever the lexical/thematic fusion or ordering rules change.
export const THEMATIC_SEARCH_INDEX_REVISION =
  'neuu-eeb9b741-openbible-2026-08-17-e0dc0a5a-fr-aliases-v1'
export const BIBLE_SEARCH_RANKING_REVISION = 'hybrid-rrf-v1'

export const BIBLE_SEARCH_CACHE_REVISION = JSON.stringify({
  index: THEMATIC_SEARCH_INDEX_REVISION,
  embeddingModel: TOPIC_EMBEDDING_MODEL,
  embeddingContract: TOPIC_EMBEDDING_CONTRACT,
  embeddingThreshold: TOPIC_EMBEDDING_MIN_SIMILARITY,
  ranking: BIBLE_SEARCH_RANKING_REVISION,
})
