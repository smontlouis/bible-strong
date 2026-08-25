import { sql } from 'drizzle-orm'
import {
  boolean,
  customType,
  doublePrecision,
  index,
  foreignKey,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

import type { BibleVersePresentation } from '../../../src/features/resources/bibleChapterContract'

const vector = customType<{ data: number[]; driverData: string; config: { dimensions: number } }>({
  dataType: config => `vector(${config!.dimensions})`,
  toDriver: value => `[${value.join(',')}]`,
  fromDriver: value => value.slice(1, -1).split(',').filter(Boolean).map(Number),
})

export type ResourceProvenance = {
  generator?: string
  source: string
  source_version?: string
  source_sha256?: string
  generated_at?: string
  attribution?: string
  imported_at: string
}

export type ResourceRights = {
  holder: string
  terms_reference?: string
  online: boolean
  offline: boolean
  reviewed_at?: string
}

export const publicationStatus = pgEnum('resource_publication_status', ['staged', 'active'])

export const resourcePublications = pgTable(
  'resource_publications',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    resource_identity: text('resource_identity').notNull(),
    resource_kind: text('resource_kind').notNull(),
    revision: text('revision').notNull(),
    language: text('language'),
    status: publicationStatus('status').notNull().default('staged'),
    canonical_sha256: text('canonical_sha256').notNull(),
    offline_artifact_sha256: text('offline_artifact_sha256').notNull(),
    provenance: jsonb('provenance').$type<ResourceProvenance>().notNull(),
    rights: jsonb('rights').$type<ResourceRights>().notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    activated_at: timestamp('activated_at', { withTimezone: true }),
  },
  table => [
    uniqueIndex('resource_publications_identity_revision_unique').on(
      table.resource_identity,
      table.revision
    ),
    uniqueIndex('resource_publications_one_active_identity')
      .on(table.resource_identity)
      .where(sql`${table.status} = 'active'`),
  ]
)

export const bibleVerses = pgTable(
  'bible_verses',
  {
    publication_id: integer('publication_id')
      .notNull()
      .references(() => resourcePublications.id, { onDelete: 'cascade' }),
    book: integer('book').notNull(),
    chapter: integer('chapter').notNull(),
    verse: integer('verse').notNull(),
    text: text('text').notNull(),
    presentation: jsonb('presentation')
      .$type<BibleVersePresentation>()
      .notNull()
      .default({ startTags: [], layout: [], notes: [], headings: [] }),
  },
  table => [
    primaryKey({
      name: 'bible_verses_publication_location_primary',
      columns: [table.publication_id, table.book, table.chapter, table.verse],
    }),
    index('bible_verses_chapter_lookup').on(
      table.publication_id,
      table.book,
      table.chapter,
      table.verse
    ),
    index('bible_verses_normalized_fts').using(
      'gin',
      sql`to_tsvector('simple', bible_search_normalize(${table.text}))`
    ),
    index('bible_verses_normalized_french_fts').using(
      'gin',
      sql`to_tsvector('french', bible_search_normalize(${table.text}))`
    ),
    index('bible_verses_normalized_english_fts').using(
      'gin',
      sql`to_tsvector('english', bible_search_normalize(${table.text}))`
    ),
    index('bible_verses_normalized_trigram').using(
      'gin',
      sql`bible_search_normalize(${table.text}) gin_trgm_ops`
    ),
  ]
)

export const naveTopics = pgTable(
  'nave_topics',
  {
    publication_id: integer('publication_id')
      .notNull()
      .references(() => resourcePublications.id, { onDelete: 'cascade' }),
    normalized_name: text('normalized_name').notNull(),
    name: text('name').notNull(),
    initial: text('initial').notNull(),
    description: text('description').notNull(),
    random_key: doublePrecision('random_key')
      .notNull()
      .default(sql`random()`),
  },
  table => [
    primaryKey({
      name: 'nave_topics_publication_name_primary',
      columns: [table.publication_id, table.normalized_name],
    }),
    index('nave_topics_browse').on(table.publication_id, table.initial, table.name),
    index('nave_topics_search').on(table.publication_id, table.name),
    index('nave_topics_name_trgm').using('gin', sql`${table.name} gin_trgm_ops`),
    index('nave_topics_random').on(table.publication_id, table.random_key),
  ]
)

export const naveVerseLinks = pgTable(
  'nave_verse_links',
  {
    publication_id: integer('publication_id')
      .notNull()
      .references(() => resourcePublications.id, { onDelete: 'cascade' }),
    verse_key: text('verse_key').notNull(),
    normalized_name: text('normalized_name').notNull(),
  },
  table => [
    primaryKey({
      name: 'nave_verse_links_publication_verse_topic_primary',
      columns: [table.publication_id, table.verse_key, table.normalized_name],
    }),
    foreignKey({
      name: 'nave_verse_links_topic_fk',
      columns: [table.publication_id, table.normalized_name],
      foreignColumns: [naveTopics.publication_id, naveTopics.normalized_name],
    }).onDelete('cascade'),
    index('nave_verse_links_verse_lookup').on(table.publication_id, table.verse_key),
    index('nave_verse_links_topic_lookup').on(table.publication_id, table.normalized_name),
  ]
)

export const thematicTopics = pgTable(
  'thematic_topics',
  {
    id: text('id').primaryKey(),
    canonical_name: text('canonical_name').notNull(),
    normalized_name: text('normalized_name').notNull(),
    language: text('language').notNull().default('en'),
    parent_id: text('parent_id'),
    active: boolean('active').notNull().default(true),
  },
  table => [
    uniqueIndex('thematic_topics_normalized_name_unique').on(table.normalized_name),
    index('thematic_topics_name_search').using(
      'gin',
      sql`to_tsvector('simple', bible_search_normalize(${table.canonical_name}))`
    ),
    index('thematic_topics_name_trigram').using(
      'gin',
      sql`bible_search_normalize(${table.canonical_name}) gin_trgm_ops`
    ),
  ]
)

export const thematicTopicSources = pgTable(
  'thematic_topic_sources',
  {
    topic_id: text('topic_id')
      .notNull()
      .references(() => thematicTopics.id, { onDelete: 'cascade' }),
    source: text('source').notNull(),
    source_key: text('source_key').notNull(),
    source_version: text('source_version').notNull(),
    original_name: text('original_name').notNull(),
    provenance: jsonb('provenance').$type<Record<string, unknown>>().notNull(),
  },
  table => [
    primaryKey({
      name: 'thematic_topic_sources_primary',
      columns: [table.source, table.source_key],
    }),
    index('thematic_topic_sources_topic_lookup').on(table.topic_id, table.source),
  ]
)

export const thematicTopicAliases = pgTable(
  'thematic_topic_aliases',
  {
    topic_id: text('topic_id')
      .notNull()
      .references(() => thematicTopics.id, { onDelete: 'cascade' }),
    language: text('language').notNull(),
    alias: text('alias').notNull(),
    normalized_alias: text('normalized_alias').notNull(),
    method: text('method').notNull(),
    validation_status: text('validation_status').notNull(),
    is_preferred: boolean('is_preferred').notNull().default(false),
  },
  table => [
    primaryKey({
      name: 'thematic_topic_aliases_primary',
      columns: [table.topic_id, table.language, table.normalized_alias],
    }),
    index('thematic_topic_aliases_exact_lookup').on(table.language, table.normalized_alias),
    index('thematic_topic_aliases_fts').using(
      'gin',
      sql`to_tsvector('simple', bible_search_normalize(${table.alias}))`
    ),
    index('thematic_topic_aliases_trigram').using(
      'gin',
      sql`bible_search_normalize(${table.alias}) gin_trgm_ops`
    ),
  ]
)

export const thematicTopicPassages = pgTable(
  'thematic_topic_passages',
  {
    topic_id: text('topic_id')
      .notNull()
      .references(() => thematicTopics.id, { onDelete: 'cascade' }),
    source: text('source').notNull(),
    book: integer('book').notNull(),
    chapter_start: integer('chapter_start').notNull(),
    verse_start: integer('verse_start').notNull(),
    chapter_end: integer('chapter_end').notNull(),
    verse_end: integer('verse_end').notNull(),
    source_score: doublePrecision('source_score'),
    source_votes: integer('source_votes'),
    provenance: jsonb('provenance').$type<Record<string, unknown>>().notNull(),
  },
  table => [
    primaryKey({
      name: 'thematic_topic_passages_primary',
      columns: [
        table.topic_id,
        table.source,
        table.book,
        table.chapter_start,
        table.verse_start,
        table.chapter_end,
        table.verse_end,
      ],
    }),
    index('thematic_topic_passages_topic_lookup').on(
      table.topic_id,
      table.source,
      table.source_score
    ),
    index('thematic_topic_passages_reference_lookup').on(
      table.book,
      table.chapter_start,
      table.verse_start
    ),
  ]
)

export const thematicTopicRelations = pgTable(
  'thematic_topic_relations',
  {
    topic_id: text('topic_id')
      .notNull()
      .references(() => thematicTopics.id, { onDelete: 'cascade' }),
    related_topic_id: text('related_topic_id')
      .notNull()
      .references(() => thematicTopics.id, { onDelete: 'cascade' }),
    relation_type: text('relation_type').notNull(),
    source: text('source').notNull(),
  },
  table => [
    primaryKey({
      name: 'thematic_topic_relations_primary',
      columns: [table.topic_id, table.related_topic_id, table.relation_type, table.source],
    }),
    index('thematic_topic_relations_topic_lookup').on(table.topic_id, table.relation_type),
  ]
)

export const thematicTopicEmbeddings = pgTable(
  'thematic_topic_embeddings',
  {
    topic_id: text('topic_id')
      .notNull()
      .references(() => thematicTopics.id, { onDelete: 'cascade' }),
    model: text('model').notNull(),
    contract: text('contract').notNull(),
    input_sha256: text('input_sha256').notNull(),
    dimensions: integer('dimensions').notNull(),
    embedding: vector('embedding', { dimensions: 1024 }).notNull(),
  },
  table => [
    primaryKey({
      name: 'thematic_topic_embeddings_primary',
      columns: [table.topic_id, table.model, table.contract],
    }),
    index('thematic_topic_embeddings_cosine_hnsw')
      .using('hnsw', table.embedding.op('vector_cosine_ops'))
      .with({ m: 16, ef_construction: 64 }),
  ]
)

export const thematicImportRuns = pgTable(
  'thematic_import_runs',
  {
    id: text('id').primaryKey(),
    source_versions: jsonb('source_versions').$type<Record<string, string>>().notNull(),
    source_sha256: jsonb('source_sha256').$type<Record<string, string>>().notNull(),
    started_at: timestamp('started_at', { withTimezone: true }).notNull(),
    completed_at: timestamp('completed_at', { withTimezone: true }),
    report: jsonb('report').$type<Record<string, unknown>>().notNull(),
  },
  table => [index('thematic_import_runs_completed').on(table.completed_at)]
)

export const commentaryVerses = pgTable(
  'commentary_verses',
  {
    publication_id: integer('publication_id')
      .notNull()
      .references(() => resourcePublications.id, { onDelete: 'cascade' }),
    verse_key: text('verse_key').notNull(),
    content: text('content').notNull(),
  },
  table => [
    primaryKey({
      name: 'commentary_verses_publication_verse_primary',
      columns: [table.publication_id, table.verse_key],
    }),
    index('commentary_verses_lookup').on(table.publication_id, table.verse_key),
  ]
)

export const crossReferenceLinks = pgTable(
  'cross_reference_links',
  {
    publication_id: integer('publication_id')
      .notNull()
      .references(() => resourcePublications.id, { onDelete: 'cascade' }),
    verse_key: text('verse_key').notNull(),
    ordinal: integer('ordinal').notNull(),
    reference: text('reference').notNull(),
  },
  table => [
    primaryKey({
      name: 'cross_reference_links_publication_verse_ordinal_primary',
      columns: [table.publication_id, table.verse_key, table.ordinal],
    }),
    index('cross_reference_links_lookup').on(table.publication_id, table.verse_key, table.ordinal),
  ]
)

export const timelineEvents = pgTable(
  'timeline_events',
  {
    publication_id: integer('publication_id')
      .notNull()
      .references(() => resourcePublications.id, { onDelete: 'cascade' }),
    event_id: text('event_id').notNull(),
    ordinal: integer('ordinal').notNull(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    article: text('article').notNull(),
    period: text('period').notNull(),
    dates: text('dates').notNull(),
    related: jsonb('related').$type<Array<{ slug: string; title: string }>>().notNull(),
    images: jsonb('images').$type<Array<{ caption: string; file: string }>>().notNull(),
    videos: jsonb('videos')
      .$type<Array<{ title: string; caption: string; filename: string }>>()
      .notNull(),
    scriptures: jsonb('scriptures').$type<string[]>().notNull(),
  },
  table => [
    primaryKey({
      name: 'timeline_events_publication_event_primary',
      columns: [table.publication_id, table.event_id],
    }),
    uniqueIndex('timeline_events_publication_slug_unique').on(table.publication_id, table.slug),
    index('timeline_events_browse').on(table.publication_id, table.ordinal),
  ]
)

export const dictionaryEntries = pgTable(
  'dictionary_entries',
  {
    publication_id: integer('publication_id')
      .notNull()
      .references(() => resourcePublications.id, { onDelete: 'cascade' }),
    entry_id: integer('entry_id').notNull(),
    word: text('word').notNull(),
    normalized_word: text('normalized_word').notNull(),
    definition: text('definition').notNull(),
    payload: jsonb('payload').$type<Record<string, string | number | null>>().notNull(),
  },
  table => [
    primaryKey({
      name: 'dictionary_entries_publication_entry_primary',
      columns: [table.publication_id, table.entry_id],
    }),
    index('dictionary_entries_browse').on(
      table.publication_id,
      table.normalized_word,
      table.entry_id
    ),
    index('dictionary_entries_search').on(table.publication_id, table.word),
    index('dictionary_entries_word_trgm').using('gin', sql`${table.word} gin_trgm_ops`),
    index('dictionary_entries_normalized_word_trgm').using(
      'gin',
      sql`${table.normalized_word} gin_trgm_ops`
    ),
  ]
)

export const dictionaryVerseLinks = pgTable(
  'dictionary_verse_links',
  {
    publication_id: integer('publication_id')
      .notNull()
      .references(() => resourcePublications.id, { onDelete: 'cascade' }),
    verse_key: text('verse_key').notNull(),
    ordinal: integer('ordinal').notNull(),
    word: text('word').notNull(),
    normalized_word: text('normalized_word').notNull(),
  },
  table => [
    primaryKey({
      name: 'dictionary_verse_links_publication_verse_ordinal_primary',
      columns: [table.publication_id, table.verse_key, table.ordinal],
    }),
    index('dictionary_verse_links_lookup').on(table.publication_id, table.verse_key, table.ordinal),
  ]
)

export const strongBibleVerses = pgTable(
  'strong_bible_verses',
  {
    publication_id: integer('publication_id')
      .notNull()
      .references(() => resourcePublications.id, { onDelete: 'cascade' }),
    book: integer('book').notNull(),
    chapter: integer('chapter').notNull(),
    verse: integer('verse').notNull(),
  },
  table => [
    primaryKey({
      name: 'strong_bible_verses_publication_location_primary',
      columns: [table.publication_id, table.book, table.chapter, table.verse],
    }),
    index('strong_bible_verses_chapter_lookup').on(
      table.publication_id,
      table.book,
      table.chapter,
      table.verse
    ),
  ]
)

export const strongBibleLexemes = pgTable(
  'strong_bible_lexemes',
  {
    publication_id: integer('publication_id')
      .notNull()
      .references(() => resourcePublications.id, { onDelete: 'cascade' }),
    lexeme_id: integer('lexeme_id').notNull(),
    lemma: text('lemma').notNull(),
    part_of_speech: text('part_of_speech').notNull(),
  },
  table => [
    primaryKey({
      name: 'strong_bible_lexemes_publication_id_primary',
      columns: [table.publication_id, table.lexeme_id],
    }),
    index('strong_bible_lexemes_label_lookup').on(
      table.publication_id,
      table.lemma,
      table.part_of_speech
    ),
  ]
)

export const strongBibleIdentities = pgTable(
  'strong_bible_identities',
  {
    publication_id: integer('publication_id')
      .notNull()
      .references(() => resourcePublications.id, { onDelete: 'cascade' }),
    identity_id: integer('identity_id').notNull(),
    kind: text('kind').notNull(),
    code: text('code').notNull(),
  },
  table => [
    primaryKey({
      name: 'strong_bible_identities_publication_id_primary',
      columns: [table.publication_id, table.identity_id],
    }),
    uniqueIndex('strong_bible_identities_code_unique').on(
      table.publication_id,
      table.kind,
      table.code
    ),
  ]
)

export const strongBibleSpans = pgTable(
  'strong_bible_spans',
  {
    publication_id: integer('publication_id')
      .notNull()
      .references(() => resourcePublications.id, { onDelete: 'cascade' }),
    book: integer('book').notNull(),
    chapter: integer('chapter').notNull(),
    verse: integer('verse').notNull(),
    ordinal: integer('ordinal').notNull(),
    start_offset: integer('start_offset').notNull(),
    length: integer('length').notNull(),
    is_aligned: boolean('is_aligned').notNull(),
    lexeme_id: integer('lexeme_id'),
    step_token_ids: jsonb('step_token_ids').$type<number[]>().notNull().default([]),
  },
  table => [
    primaryKey({
      name: 'strong_bible_spans_publication_location_primary',
      columns: [table.publication_id, table.book, table.chapter, table.verse, table.ordinal],
    }),
    foreignKey({
      name: 'strong_bible_spans_verse_fk',
      columns: [table.publication_id, table.book, table.chapter, table.verse],
      foreignColumns: [
        strongBibleVerses.publication_id,
        strongBibleVerses.book,
        strongBibleVerses.chapter,
        strongBibleVerses.verse,
      ],
    }).onDelete('cascade'),
    foreignKey({
      name: 'strong_bible_spans_lexeme_fk',
      columns: [table.publication_id, table.lexeme_id],
      foreignColumns: [strongBibleLexemes.publication_id, strongBibleLexemes.lexeme_id],
    }).onDelete('cascade'),
    index('strong_bible_spans_chapter_lookup').on(
      table.publication_id,
      table.book,
      table.chapter,
      table.verse,
      table.ordinal
    ),
    index('strong_bible_spans_lexeme_lookup').on(table.publication_id, table.lexeme_id),
    index('strong_bible_spans_lexeme_location_lookup').on(
      table.publication_id,
      table.lexeme_id,
      table.book,
      table.chapter,
      table.verse,
      table.ordinal
    ),
  ]
)

export const strongBibleSpanIdentities = pgTable(
  'strong_bible_span_identities',
  {
    publication_id: integer('publication_id')
      .notNull()
      .references(() => resourcePublications.id, { onDelete: 'cascade' }),
    book: integer('book').notNull(),
    chapter: integer('chapter').notNull(),
    verse: integer('verse').notNull(),
    ordinal: integer('ordinal').notNull(),
    identity_order: integer('identity_order').notNull(),
    identity_id: integer('identity_id').notNull(),
  },
  table => [
    primaryKey({
      name: 'strong_bible_span_identities_publication_location_primary',
      columns: [
        table.publication_id,
        table.book,
        table.chapter,
        table.verse,
        table.ordinal,
        table.identity_order,
      ],
    }),
    foreignKey({
      name: 'strong_bible_span_identities_span_fk',
      columns: [table.publication_id, table.book, table.chapter, table.verse, table.ordinal],
      foreignColumns: [
        strongBibleSpans.publication_id,
        strongBibleSpans.book,
        strongBibleSpans.chapter,
        strongBibleSpans.verse,
        strongBibleSpans.ordinal,
      ],
    }).onDelete('cascade'),
    foreignKey({
      name: 'strong_bible_span_identities_identity_fk',
      columns: [table.publication_id, table.identity_id],
      foreignColumns: [strongBibleIdentities.publication_id, strongBibleIdentities.identity_id],
    }).onDelete('cascade'),
    index('strong_bible_span_identities_lookup').on(
      table.publication_id,
      table.identity_id,
      table.book,
      table.chapter,
      table.verse
    ),
    index('strong_bible_span_identities_concordance_cursor').on(
      table.publication_id,
      table.identity_id,
      table.book,
      table.chapter,
      table.verse,
      table.ordinal
    ),
  ]
)

export const interlinearBibleVerses = pgTable(
  'interlinear_bible_verses',
  {
    publication_id: integer('publication_id')
      .notNull()
      .references(() => resourcePublications.id, { onDelete: 'cascade' }),
    verse_id: integer('verse_id').notNull(),
    book: integer('book').notNull(),
    chapter: integer('chapter').notNull(),
    verse: integer('verse').notNull(),
  },
  table => [
    primaryKey({
      name: 'interlinear_bible_verses_publication_id_primary',
      columns: [table.publication_id, table.verse_id],
    }),
    uniqueIndex('interlinear_bible_verses_location_unique').on(
      table.publication_id,
      table.book,
      table.chapter,
      table.verse
    ),
    index('interlinear_bible_verses_chapter_lookup').on(
      table.publication_id,
      table.book,
      table.chapter,
      table.verse
    ),
  ]
)

export const interlinearBibleTokens = pgTable(
  'interlinear_bible_tokens',
  {
    publication_id: integer('publication_id').notNull(),
    token_id: integer('token_id').notNull(),
    verse_id: integer('verse_id').notNull(),
    ordinal: integer('ordinal').notNull(),
    start_offset: integer('start_offset').notNull(),
    length: integer('length').notNull(),
  },
  table => [
    primaryKey({
      name: 'interlinear_bible_tokens_publication_id_primary',
      columns: [table.publication_id, table.token_id],
    }),
    foreignKey({
      name: 'interlinear_bible_tokens_verse_fk',
      columns: [table.publication_id, table.verse_id],
      foreignColumns: [interlinearBibleVerses.publication_id, interlinearBibleVerses.verse_id],
    }).onDelete('cascade'),
    uniqueIndex('interlinear_bible_tokens_verse_ordinal_unique').on(
      table.publication_id,
      table.verse_id,
      table.ordinal
    ),
    index('interlinear_bible_tokens_verse_lookup').on(
      table.publication_id,
      table.verse_id,
      table.ordinal
    ),
  ]
)

export const interlinearBibleSegments = pgTable(
  'interlinear_bible_segments',
  {
    publication_id: integer('publication_id').notNull(),
    segment_id: integer('segment_id').notNull(),
    token_id: integer('token_id').notNull(),
    ordinal: integer('ordinal').notNull(),
    start_offset: integer('start_offset').notNull(),
    length: integer('length').notNull(),
    transliteration: text('transliteration').notNull(),
    lemma: text('lemma').notNull(),
    morphology: text('morphology').notNull(),
    gloss: text('gloss').notNull(),
  },
  table => [
    primaryKey({
      name: 'interlinear_bible_segments_publication_id_primary',
      columns: [table.publication_id, table.segment_id],
    }),
    foreignKey({
      name: 'interlinear_bible_segments_token_fk',
      columns: [table.publication_id, table.token_id],
      foreignColumns: [interlinearBibleTokens.publication_id, interlinearBibleTokens.token_id],
    }).onDelete('cascade'),
    uniqueIndex('interlinear_bible_segments_token_ordinal_unique').on(
      table.publication_id,
      table.token_id,
      table.ordinal
    ),
    index('interlinear_bible_segments_token_lookup').on(
      table.publication_id,
      table.token_id,
      table.ordinal
    ),
  ]
)

export const interlinearBibleSegmentIdentities = pgTable(
  'interlinear_bible_segment_identities',
  {
    publication_id: integer('publication_id').notNull(),
    segment_id: integer('segment_id').notNull(),
    identity_order: integer('identity_order').notNull(),
    kind: text('kind').notNull(),
    code: text('code').notNull(),
  },
  table => [
    primaryKey({
      name: 'interlinear_bible_segment_identities_primary',
      columns: [table.publication_id, table.segment_id, table.identity_order],
    }),
    foreignKey({
      name: 'interlinear_bible_segment_identities_segment_fk',
      columns: [table.publication_id, table.segment_id],
      foreignColumns: [
        interlinearBibleSegments.publication_id,
        interlinearBibleSegments.segment_id,
      ],
    }).onDelete('cascade'),
    index('interlinear_bible_segment_identities_code_lookup').on(
      table.publication_id,
      table.kind,
      table.code
    ),
  ]
)

export const strongLexiconRecords = pgTable(
  'strong_lexicon_records',
  {
    publication_id: integer('publication_id')
      .notNull()
      .references(() => resourcePublications.id, { onDelete: 'cascade' }),
    table_name: text('table_name').notNull(),
    record_key: text('record_key').notNull(),
    entry_id: integer('entry_id'),
    language: text('language'),
    code: text('code'),
    unique_name: text('unique_name'),
    payload: jsonb('payload').$type<Record<string, string | number | null>>().notNull(),
  },
  table => [
    primaryKey({
      name: 'strong_lexicon_records_primary',
      columns: [table.publication_id, table.table_name, table.record_key],
    }),
    index('strong_lexicon_records_entry_lookup').on(
      table.publication_id,
      table.table_name,
      table.entry_id
    ),
    index('strong_lexicon_records_code_lookup').on(
      table.publication_id,
      table.table_name,
      table.code
    ),
    index('strong_lexicon_records_unique_name_lookup').on(
      table.publication_id,
      table.table_name,
      table.unique_name
    ),
  ]
)

// Strong lexicon domain projections keep stable identities and graph edges in
// typed PostgreSQL columns. The generic record table above remains as an
// immutable audit/read-model copy of every canonical row.
export const strongLexiconEntries = pgTable(
  'strong_lexicon_entries',
  {
    publication_id: integer('publication_id')
      .notNull()
      .references(() => resourcePublications.id, { onDelete: 'cascade' }),
    entry_id: integer('entry_id').notNull(),
    language: text('language').notNull(),
    e_strong: text('e_strong').notNull(),
    d_strong: text('d_strong').notNull(),
    u_strong: text('u_strong').notNull(),
    payload: jsonb('payload').$type<Record<string, string | number | null>>().notNull(),
  },
  table => [
    primaryKey({
      name: 'strong_lexicon_entries_primary',
      columns: [table.publication_id, table.entry_id],
    }),
    index('strong_lexicon_entries_code_lookup').on(
      table.publication_id,
      table.e_strong,
      table.d_strong,
      table.u_strong
    ),
    index('strong_lexicon_entries_browse').on(
      table.publication_id,
      sql`lower(coalesce(${table.payload}->>'gloss', ''))`,
      sql`((${table.payload}->>'baseCode')::integer)`,
      table.entry_id
    ),
    index('strong_lexicon_entries_random')
      .on(table.publication_id, table.language, table.entry_id)
      .where(sql`${table.payload}->>'gloss' <> ''`),
    index('strong_lexicon_entries_search').using(
      'gin',
      sql`bible_search_normalize(coalesce(${table.payload}->>'original', '') || ' ' || coalesce(nullif(${table.payload}->>'classicTransliteration', ''), ${table.payload}->>'transliteration', '') || ' ' || coalesce(${table.payload}->>'gloss', '') || ' ' || ${table.e_strong} || ' ' || ${table.d_strong} || ' ' || ${table.u_strong}) gin_trgm_ops`
    ),
  ]
)

export const strongLexiconRelationKinds = pgTable(
  'strong_lexicon_relation_kinds',
  {
    publication_id: integer('publication_id')
      .notNull()
      .references(() => resourcePublications.id, { onDelete: 'cascade' }),
    relation_kind_id: integer('relation_kind_id').notNull(),
    kind: text('kind').notNull(),
    label_en: text('label_en').notNull(),
    label_fr: text('label_fr').notNull(),
    payload: jsonb('payload').$type<Record<string, string | number | null>>().notNull(),
  },
  table => [
    primaryKey({
      name: 'strong_lexicon_relation_kinds_primary',
      columns: [table.publication_id, table.relation_kind_id],
    }),
  ]
)

export const strongLexiconMorphologyCodes = pgTable(
  'strong_lexicon_morphology_codes',
  {
    publication_id: integer('publication_id')
      .notNull()
      .references(() => resourcePublications.id, { onDelete: 'cascade' }),
    morphology_code_id: integer('morphology_code_id').notNull(),
    code: text('code').notNull(),
    normalized_code: text('normalized_code').notNull(),
    language: text('language').notNull(),
    scope: text('scope').notNull(),
    payload: jsonb('payload').$type<Record<string, string | number | null>>().notNull(),
  },
  table => [
    primaryKey({
      name: 'strong_lexicon_morphology_codes_primary',
      columns: [table.publication_id, table.morphology_code_id],
    }),
    index('strong_lexicon_morphology_code_lookup').on(
      table.publication_id,
      sql`lower(${table.normalized_code})`,
      sql`lower(${table.code})`
    ),
  ]
)

export const strongLexiconMorphologyCodeTranslations = pgTable(
  'strong_lexicon_morphology_code_translations',
  {
    publication_id: integer('publication_id').notNull(),
    morphology_code_id: integer('morphology_code_id').notNull(),
    language: text('language').notNull(),
    payload: jsonb('payload').$type<Record<string, string | number | null>>().notNull(),
  },
  table => [
    primaryKey({
      name: 'strong_lexicon_morphology_code_translations_primary',
      columns: [table.publication_id, table.morphology_code_id, table.language],
    }),
    foreignKey({
      name: 'strong_lexicon_morphology_code_translations_code_fk',
      columns: [table.publication_id, table.morphology_code_id],
      foreignColumns: [
        strongLexiconMorphologyCodes.publication_id,
        strongLexiconMorphologyCodes.morphology_code_id,
      ],
    }).onDelete('cascade'),
  ]
)

export const strongLexiconEntryIdentities = pgTable(
  'strong_lexicon_entry_identities',
  {
    publication_id: integer('publication_id').notNull(),
    step_entry_id: integer('step_entry_id').notNull(),
    step_code: text('step_code').notNull(),
  },
  table => [
    primaryKey({
      name: 'strong_lexicon_entry_identities_primary',
      columns: [table.publication_id, table.step_entry_id],
    }),
    foreignKey({
      name: 'strong_lexicon_entry_identities_entry_fk',
      columns: [table.publication_id, table.step_entry_id],
      foreignColumns: [strongLexiconEntries.publication_id, strongLexiconEntries.entry_id],
    }).onDelete('cascade'),
    uniqueIndex('strong_lexicon_entry_identities_code_unique').on(
      table.publication_id,
      table.step_code
    ),
    index('strong_lexicon_entry_identities_code_search').using(
      'gin',
      sql`lower(${table.step_code}) gin_trgm_ops`
    ),
  ]
)

export const strongLexiconTranslations = pgTable(
  'strong_lexicon_translations',
  {
    publication_id: integer('publication_id').notNull(),
    step_entry_id: integer('step_entry_id').notNull(),
    language: text('language').notNull(),
    payload: jsonb('payload').$type<Record<string, string | number | null>>().notNull(),
  },
  table => [
    primaryKey({
      name: 'strong_lexicon_translations_primary',
      columns: [table.publication_id, table.step_entry_id, table.language],
    }),
    foreignKey({
      name: 'strong_lexicon_translations_entry_fk',
      columns: [table.publication_id, table.step_entry_id],
      foreignColumns: [strongLexiconEntries.publication_id, strongLexiconEntries.entry_id],
    }).onDelete('cascade'),
    index('strong_lexicon_translations_gloss_search').using(
      'gin',
      sql`lower(coalesce(${table.payload}->>'gloss', '')) gin_trgm_ops`
    ),
  ]
)

export const strongLexiconRelations = pgTable(
  'strong_lexicon_relations',
  {
    publication_id: integer('publication_id').notNull(),
    relation_id: integer('relation_id').notNull(),
    from_entry_id: integer('from_entry_id').notNull(),
    to_entry_id: integer('to_entry_id'),
    relation_kind_id: integer('relation_kind_id'),
    payload: jsonb('payload').$type<Record<string, string | number | null>>().notNull(),
  },
  table => [
    primaryKey({
      name: 'strong_lexicon_relations_primary',
      columns: [table.publication_id, table.relation_id],
    }),
    foreignKey({
      name: 'strong_lexicon_relations_from_entry_fk',
      columns: [table.publication_id, table.from_entry_id],
      foreignColumns: [strongLexiconEntries.publication_id, strongLexiconEntries.entry_id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'strong_lexicon_relations_to_entry_fk',
      columns: [table.publication_id, table.to_entry_id],
      foreignColumns: [strongLexiconEntries.publication_id, strongLexiconEntries.entry_id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'strong_lexicon_relations_kind_fk',
      columns: [table.publication_id, table.relation_kind_id],
      foreignColumns: [
        strongLexiconRelationKinds.publication_id,
        strongLexiconRelationKinds.relation_kind_id,
      ],
    }).onDelete('restrict'),
    index('strong_lexicon_relations_from_lookup').on(table.publication_id, table.from_entry_id),
    index('strong_lexicon_relations_to_lookup').on(table.publication_id, table.to_entry_id),
  ]
)

export const strongLexiconResources = pgTable(
  'strong_lexicon_resources',
  {
    publication_id: integer('publication_id')
      .notNull()
      .references(() => resourcePublications.id, { onDelete: 'cascade' }),
    resource_id: integer('resource_id').notNull(),
    step_entry_id: integer('step_entry_id').notNull(),
    source: text('source').notNull(),
    kind: text('kind').notNull(),
    payload: jsonb('payload').$type<Record<string, string | number | null>>().notNull(),
  },
  table => [
    primaryKey({
      name: 'strong_lexicon_resources_primary',
      columns: [table.publication_id, table.resource_id],
    }),
    index('strong_lexicon_resources_entry_lookup').on(table.publication_id, table.step_entry_id),
  ]
)

export const strongLexiconResourceTranslations = pgTable(
  'strong_lexicon_resource_translations',
  {
    publication_id: integer('publication_id').notNull(),
    resource_id: integer('resource_id').notNull(),
    language: text('language').notNull(),
    payload: jsonb('payload').$type<Record<string, string | number | null>>().notNull(),
  },
  table => [
    primaryKey({
      name: 'strong_lexicon_resource_translations_primary',
      columns: [table.publication_id, table.resource_id, table.language],
    }),
    foreignKey({
      name: 'strong_lexicon_resource_translations_resource_fk',
      columns: [table.publication_id, table.resource_id],
      foreignColumns: [strongLexiconResources.publication_id, strongLexiconResources.resource_id],
    }).onDelete('cascade'),
  ]
)

export const strongLexiconEntities = pgTable(
  'strong_lexicon_entities',
  {
    publication_id: integer('publication_id')
      .notNull()
      .references(() => resourcePublications.id, { onDelete: 'cascade' }),
    entity_id: integer('entity_id').notNull(),
    unique_name: text('unique_name').notNull(),
    u_strong: text('u_strong').notNull(),
    payload: jsonb('payload').$type<Record<string, string | number | null>>().notNull(),
  },
  table => [
    primaryKey({
      name: 'strong_lexicon_entities_primary',
      columns: [table.publication_id, table.entity_id],
    }),
    uniqueIndex('strong_lexicon_entities_unique_name').on(table.publication_id, table.unique_name),
    index('strong_lexicon_entities_ustrong_lookup').on(table.publication_id, table.u_strong),
  ]
)

export const strongLexiconEntityTranslations = pgTable(
  'strong_lexicon_entity_translations',
  {
    publication_id: integer('publication_id').notNull(),
    translation_id: integer('translation_id').notNull(),
    entity_id: integer('entity_id').notNull(),
    language: text('language').notNull(),
    payload: jsonb('payload').$type<Record<string, string | number | null>>().notNull(),
  },
  table => [
    primaryKey({
      name: 'strong_lexicon_entity_translations_primary',
      columns: [table.publication_id, table.translation_id],
    }),
    foreignKey({
      name: 'strong_lexicon_entity_translations_entity_fk',
      columns: [table.publication_id, table.entity_id],
      foreignColumns: [strongLexiconEntities.publication_id, strongLexiconEntities.entity_id],
    }).onDelete('cascade'),
    index('strong_lexicon_entity_translations_lookup').on(
      table.publication_id,
      table.entity_id,
      table.language
    ),
  ]
)

export const strongLexiconEntityPlaces = pgTable(
  'strong_lexicon_entity_places',
  {
    publication_id: integer('publication_id').notNull(),
    entity_id: integer('entity_id').notNull(),
    payload: jsonb('payload').$type<Record<string, string | number | null>>().notNull(),
  },
  table => [
    primaryKey({
      name: 'strong_lexicon_entity_places_primary',
      columns: [table.publication_id, table.entity_id],
    }),
    foreignKey({
      name: 'strong_lexicon_entity_places_entity_fk',
      columns: [table.publication_id, table.entity_id],
      foreignColumns: [strongLexiconEntities.publication_id, strongLexiconEntities.entity_id],
    }).onDelete('cascade'),
  ]
)

export const strongLexiconEntityRefs = pgTable(
  'strong_lexicon_entity_refs',
  {
    publication_id: integer('publication_id').notNull(),
    entity_id: integer('entity_id').notNull(),
    book: text('book').notNull(),
    chapter: integer('chapter').notNull(),
    verse: integer('verse').notNull(),
    suffix: text('suffix').notNull(),
    payload: jsonb('payload').$type<Record<string, string | number | null>>().notNull(),
  },
  table => [
    primaryKey({
      name: 'strong_lexicon_entity_refs_primary',
      columns: [
        table.publication_id,
        table.entity_id,
        table.book,
        table.chapter,
        table.verse,
        table.suffix,
      ],
    }),
    foreignKey({
      name: 'strong_lexicon_entity_refs_entity_fk',
      columns: [table.publication_id, table.entity_id],
      foreignColumns: [strongLexiconEntities.publication_id, strongLexiconEntities.entity_id],
    }).onDelete('cascade'),
    index('strong_lexicon_entity_refs_chapter_lookup').on(
      table.publication_id,
      table.book,
      table.chapter
    ),
  ]
)

export const strongLexiconEntityRelations = pgTable(
  'strong_lexicon_entity_relations',
  {
    publication_id: integer('publication_id').notNull(),
    relation_id: integer('relation_id').notNull(),
    from_entity_id: integer('from_entity_id').notNull(),
    to_entity_id: integer('to_entity_id'),
    relation: text('relation').notNull(),
    payload: jsonb('payload').$type<Record<string, string | number | null>>().notNull(),
  },
  table => [
    primaryKey({
      name: 'strong_lexicon_entity_relations_primary',
      columns: [table.publication_id, table.relation_id],
    }),
    foreignKey({
      name: 'strong_lexicon_entity_relations_from_fk',
      columns: [table.publication_id, table.from_entity_id],
      foreignColumns: [strongLexiconEntities.publication_id, strongLexiconEntities.entity_id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'strong_lexicon_entity_relations_to_fk',
      columns: [table.publication_id, table.to_entity_id],
      foreignColumns: [strongLexiconEntities.publication_id, strongLexiconEntities.entity_id],
    }).onDelete('set null'),
    index('strong_lexicon_entity_relations_from_lookup').on(
      table.publication_id,
      table.from_entity_id
    ),
    index('strong_lexicon_entity_relations_to_lookup').on(table.publication_id, table.to_entity_id),
  ]
)
