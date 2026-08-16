import { sql } from 'drizzle-orm'
import {
  index,
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
  source: string
  attribution?: string
  imported_at: string
}

export type ResourceRights = {
  holder: string
  terms_reference?: string
  online: boolean
  offline: boolean
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
