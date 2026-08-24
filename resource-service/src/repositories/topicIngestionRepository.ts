import { createHash } from 'node:crypto'
import { Pool, type PoolClient } from 'pg'

import { createTopicEmbeddingDocument, type TopicEmbeddingProvider } from '../search/topicEmbedding'

const OPENBIBLE_SCORES_URL = 'https://a.openbible.info/data/topic-scores.zip'
const NEUU_REPOSITORY_URL = 'https://github.com/neuu-org/bible-topics-dataset.git'

type ImportTopic = {
  id: string
  canonicalName: string
  normalizedName: string
  sourceNames: Map<string, { key: string; name: string; version: string }>
  aliases: Map<
    string,
    {
      language: 'en' | 'fr'
      alias: string
      normalizedAlias: string
      method: string
      validationStatus: string
      isPreferred: boolean
    }
  >
}

type ImportPassage = {
  topicId: string
  source: string
  book: number
  chapterStart: number
  verseStart: number
  chapterEnd: number
  verseEnd: number
  sourceScore?: number
  sourceVotes?: number
  provenance: Record<string, unknown>
}

type ImportRelation = {
  topicId: string
  relatedTopicId: string
  relationType: 'see-also'
  source: string
}

type ImportReport = {
  runId: string
  startedAt: string
  completedAt?: string
  durationMs?: number
  sourceVersions: Record<string, string>
  sourceSha256: Record<string, string>
  databaseBytesBefore: number
  databaseBytesAfter?: number
  databaseBytesAdded?: number
  thematicStorageBytes?: number
  [key: string]: unknown
}

const insertJsonBatches = async (
  client: PoolClient,
  rows: readonly unknown[],
  insert: (jsonParameter: string) => string,
  batchSize = 2_000
) => {
  for (let index = 0; index < rows.length; index += batchSize) {
    await client.query(insert('$1'), [JSON.stringify(rows.slice(index, index + batchSize))])
  }
}

const databaseSize = async (client: PoolClient) => {
  const result = await client.query<{ bytes: string }>(
    'select pg_database_size(current_database())::text as bytes'
  )
  return Number(result.rows[0]?.bytes ?? 0)
}

export const persistThematicSearchImport = async ({
  topics,
  passages,
  relations,
  report,
  embeddingProvider,
}: {
  topics: Map<string, ImportTopic>
  passages: Map<string, ImportPassage>
  relations: ImportRelation[]
  report: ImportReport
  embeddingProvider: TopicEmbeddingProvider
}) => {
  const topicValues = [...topics.values()]
  const embeddingRows: {
    topic_id: string
    model: string
    contract: string
    input_sha256: string
    dimensions: number
    embedding: string
  }[] = []
  const embeddingBatchSize = 100
  const embeddingConcurrency = 2
  const batches = Array.from(
    { length: Math.ceil(topicValues.length / embeddingBatchSize) },
    (_, index) => topicValues.slice(index * embeddingBatchSize, (index + 1) * embeddingBatchSize)
  )
  for (let index = 0; index < batches.length; index += embeddingConcurrency) {
    const groupRows = await Promise.all(
      batches.slice(index, index + embeddingConcurrency).map(async batch => {
        const documents = batch.map(topic => {
          const aliases = [...topic.aliases.values()]
          return createTopicEmbeddingDocument({
            canonicalName: topic.canonicalName,
            englishAliases: aliases
              .filter(alias => alias.language === 'en')
              .map(alias => alias.alias),
            frenchAliases: aliases
              .filter(alias => alias.language === 'fr')
              .map(alias => alias.alias),
          })
        })
        const embeddings = await embeddingProvider.embedDocuments(documents)
        return batch.map((topic, topicIndex) => ({
          topic_id: topic.id,
          model: embeddingProvider.model,
          contract: embeddingProvider.contract,
          input_sha256: createHash('sha256').update(documents[topicIndex]!).digest('hex'),
          dimensions: embeddingProvider.dimensions,
          embedding: `[${embeddings[topicIndex]!.join(',')}]`,
        }))
      })
    )
    embeddingRows.push(...groupRows.flat())
    console.log(
      JSON.stringify({
        message: 'topic embeddings generated',
        model: embeddingProvider.model,
        completed: embeddingRows.length,
        total: topicValues.length,
      })
    )
  }

  const pool = new Pool({
    connectionString:
      process.env.RESOURCE_DATABASE_URL ??
      'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong',
    max: 1,
  })
  const client = await pool.connect()
  try {
    report.databaseBytesBefore = await databaseSize(client)
    await client.query('begin')
    await client.query('select pg_advisory_xact_lock(3252026)')
    await client.query(
      'truncate thematic_topic_embeddings, thematic_topic_relations, thematic_topic_passages, thematic_topic_aliases, thematic_topic_sources, thematic_topics cascade'
    )

    const topicRows = [...topics.values()].map(topic => ({
      id: topic.id,
      canonical_name: topic.canonicalName,
      normalized_name: topic.normalizedName,
      language: 'en',
      active: true,
    }))
    await insertJsonBatches(
      client,
      topicRows,
      parameter => `
      insert into thematic_topics (id, canonical_name, normalized_name, language, active)
      select id, canonical_name, normalized_name, language, active
      from jsonb_to_recordset(${parameter}::jsonb)
        as row(id text, canonical_name text, normalized_name text, language text, active boolean)
    `
    )

    const sourceRows = [...topics.values()].flatMap(topic =>
      [...topic.sourceNames.entries()].map(([source, value]) => ({
        topic_id: topic.id,
        source,
        source_key: value.key,
        source_version: value.version,
        original_name: value.name,
        provenance: {
          source:
            source === 'openbible'
              ? OPENBIBLE_SCORES_URL
              : `${NEUU_REPOSITORY_URL}#data/02_sources/${source}`,
        },
      }))
    )
    await insertJsonBatches(
      client,
      sourceRows,
      parameter => `
      insert into thematic_topic_sources
        (topic_id, source, source_key, source_version, original_name, provenance)
      select topic_id, source, source_key, source_version, original_name, provenance
      from jsonb_to_recordset(${parameter}::jsonb)
        as row(topic_id text, source text, source_key text, source_version text,
               original_name text, provenance jsonb)
    `
    )

    const aliasRows = [...topics.values()].flatMap(topic =>
      [...topic.aliases.values()].map(alias => ({
        topic_id: topic.id,
        language: alias.language,
        alias: alias.alias,
        normalized_alias: alias.normalizedAlias,
        method: alias.method,
        validation_status: alias.validationStatus,
        is_preferred: alias.isPreferred,
      }))
    )
    await insertJsonBatches(
      client,
      aliasRows,
      parameter => `
      insert into thematic_topic_aliases
        (topic_id, language, alias, normalized_alias, method, validation_status, is_preferred)
      select topic_id, language, alias, normalized_alias, method, validation_status, is_preferred
      from jsonb_to_recordset(${parameter}::jsonb)
        as row(topic_id text, language text, alias text, normalized_alias text, method text,
               validation_status text, is_preferred boolean)
    `
    )

    const passageRows = [...passages.values()].map(passage => ({
      topic_id: passage.topicId,
      source: passage.source,
      book: passage.book,
      chapter_start: passage.chapterStart,
      verse_start: passage.verseStart,
      chapter_end: passage.chapterEnd,
      verse_end: passage.verseEnd,
      source_score: passage.sourceScore ?? null,
      source_votes: passage.sourceVotes ?? null,
      provenance: passage.provenance,
    }))
    await insertJsonBatches(
      client,
      passageRows,
      parameter => `
      insert into thematic_topic_passages
        (topic_id, source, book, chapter_start, verse_start, chapter_end, verse_end,
         source_score, source_votes, provenance)
      select topic_id, source, book, chapter_start, verse_start, chapter_end, verse_end,
             source_score, source_votes, provenance
      from jsonb_to_recordset(${parameter}::jsonb)
        as row(topic_id text, source text, book integer, chapter_start integer, verse_start integer,
               chapter_end integer, verse_end integer, source_score double precision,
               source_votes integer, provenance jsonb)
    `
    )

    await insertJsonBatches(
      client,
      relations,
      parameter => `
      insert into thematic_topic_relations (topic_id, related_topic_id, relation_type, source)
      select "topicId", "relatedTopicId", "relationType", source
      from jsonb_to_recordset(${parameter}::jsonb)
        as row("topicId" text, "relatedTopicId" text, "relationType" text, source text)
    `
    )

    await insertJsonBatches(
      client,
      embeddingRows,
      parameter => `
      insert into thematic_topic_embeddings
        (topic_id, model, contract, input_sha256, dimensions, embedding)
      select topic_id, model, contract, input_sha256, dimensions, embedding::vector
      from jsonb_to_recordset(${parameter}::jsonb)
        as row(topic_id text, model text, contract text, input_sha256 text,
               dimensions integer, embedding text)
    `,
      500
    )

    await client.query(
      `insert into thematic_import_runs
        (id, source_versions, source_sha256, started_at, completed_at, report)
       values ($1, $2, $3, $4, now(), $5)`,
      [report.runId, report.sourceVersions, report.sourceSha256, report.startedAt, report]
    )
    await client.query('commit')
    report.databaseBytesAfter = await databaseSize(client)
    report.databaseBytesAdded = report.databaseBytesAfter - report.databaseBytesBefore
    const storage = await client.query<{ bytes: string }>(`
      select coalesce(sum(pg_total_relation_size(oid)), 0)::text as bytes
      from pg_class
      where relkind = 'r' and relname like 'thematic_%'
    `)
    report.thematicStorageBytes = Number(storage.rows[0]?.bytes ?? 0)
    report.completedAt = new Date().toISOString()
    report.durationMs = Date.now() - Date.parse(report.startedAt)
    await client.query(
      'update thematic_import_runs set completed_at = $2, report = $3 where id = $1',
      [report.runId, report.completedAt, report]
    )
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}
