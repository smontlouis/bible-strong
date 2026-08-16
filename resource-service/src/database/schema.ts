import { sql } from 'drizzle-orm'
import {
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
