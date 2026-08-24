UPDATE "thematic_topic_embeddings"
SET "contract" = 'bible-topic-qwen3-v2'
WHERE "model" = '@cf/qwen/qwen3-embedding-0.6b'
  AND "contract" = 'bible-topic-qwen3-v1';
