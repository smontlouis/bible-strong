import type { Kyselify } from 'drizzle-orm/kysely'

import type { bibleVerses, resourcePublications } from './schema'

export type ResourcePublicationRow = Kyselify<typeof resourcePublications>
export type BibleVerseRow = Kyselify<typeof bibleVerses>

export type ResourceDatabase = {
  resource_publications: ResourcePublicationRow
  bible_verses: BibleVerseRow
}
