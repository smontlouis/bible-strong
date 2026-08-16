import { sql } from 'drizzle-orm'
import {
  boolean,
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
  },
  table => [
    primaryKey({
      name: 'nave_topics_publication_name_primary',
      columns: [table.publication_id, table.normalized_name],
    }),
    index('nave_topics_browse').on(table.publication_id, table.initial, table.name),
    index('nave_topics_search').on(table.publication_id, table.name),
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
    publication_id: integer('publication_id').notNull(),
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
  ]
)

export const strongBibleSpanIdentities = pgTable(
  'strong_bible_span_identities',
  {
    publication_id: integer('publication_id').notNull(),
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
  ]
)
