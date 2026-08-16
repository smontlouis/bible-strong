import type { Kyselify } from 'drizzle-orm/kysely'

import type { bibleVerses, naveTopics, naveVerseLinks, resourcePublications } from './schema'

export type ResourcePublicationRow = Kyselify<typeof resourcePublications>
export type BibleVerseRow = Kyselify<typeof bibleVerses>
export type NaveTopicRow = Kyselify<typeof naveTopics>
export type NaveVerseLinkRow = Kyselify<typeof naveVerseLinks>

export type ResourceDatabase = {
  resource_publications: ResourcePublicationRow
  bible_verses: BibleVerseRow
  nave_topics: NaveTopicRow
  nave_verse_links: NaveVerseLinkRow
}
