import type { Kyselify } from 'drizzle-orm/kysely'

import type {
  bibleVerses,
  interlinearBibleSegmentIdentities,
  interlinearBibleSegments,
  interlinearBibleTokens,
  interlinearBibleVerses,
  naveTopics,
  naveVerseLinks,
  resourcePublications,
  strongBibleIdentities,
  strongBibleLexemes,
  strongBibleSpanIdentities,
  strongBibleSpans,
  strongBibleVerses,
} from './schema'

export type ResourcePublicationRow = Kyselify<typeof resourcePublications>
export type BibleVerseRow = Kyselify<typeof bibleVerses>
export type NaveTopicRow = Kyselify<typeof naveTopics>
export type NaveVerseLinkRow = Kyselify<typeof naveVerseLinks>
export type StrongBibleVerseRow = Kyselify<typeof strongBibleVerses>
export type StrongBibleLexemeRow = Kyselify<typeof strongBibleLexemes>
export type StrongBibleIdentityRow = Kyselify<typeof strongBibleIdentities>
export type StrongBibleSpanRow = Kyselify<typeof strongBibleSpans>
export type StrongBibleSpanIdentityRow = Kyselify<typeof strongBibleSpanIdentities>
export type InterlinearBibleVerseRow = Kyselify<typeof interlinearBibleVerses>
export type InterlinearBibleTokenRow = Kyselify<typeof interlinearBibleTokens>
export type InterlinearBibleSegmentRow = Kyselify<typeof interlinearBibleSegments>
export type InterlinearBibleSegmentIdentityRow = Kyselify<typeof interlinearBibleSegmentIdentities>

export type ResourceDatabase = {
  resource_publications: ResourcePublicationRow
  bible_verses: BibleVerseRow
  nave_topics: NaveTopicRow
  nave_verse_links: NaveVerseLinkRow
  strong_bible_verses: StrongBibleVerseRow
  strong_bible_lexemes: StrongBibleLexemeRow
  strong_bible_identities: StrongBibleIdentityRow
  strong_bible_spans: StrongBibleSpanRow
  strong_bible_span_identities: StrongBibleSpanIdentityRow
  interlinear_bible_verses: InterlinearBibleVerseRow
  interlinear_bible_tokens: InterlinearBibleTokenRow
  interlinear_bible_segments: InterlinearBibleSegmentRow
  interlinear_bible_segment_identities: InterlinearBibleSegmentIdentityRow
}
