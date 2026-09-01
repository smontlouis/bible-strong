import type { Kyselify } from 'drizzle-orm/kysely'

import type {
  bibleVerses,
  commentaryVerses,
  crossReferenceLinks,
  timelineEvents,
  interlinearBibleSegmentIdentities,
  interlinearBibleSegments,
  interlinearBibleTokens,
  interlinearBibleVerses,
  naveTopics,
  naveVerseLinks,
  thematicImportRuns,
  thematicTopicAliases,
  thematicTopicEmbeddings,
  thematicTopicPassages,
  thematicTopicRelations,
  thematicTopics,
  thematicTopicSources,
  dictionaryEntries,
  dictionaryDirectoryVersePresences,
  dictionaryVerseLinks,
  resourcePublications,
  strongBibleIdentities,
  strongBibleLexemes,
  strongBibleSpanIdentities,
  strongBibleSpans,
  strongBibleVerses,
  strongLexiconRecords,
  strongLexiconEntries,
  strongLexiconRelationKinds,
  strongLexiconMorphologyCodes,
  strongLexiconMorphologyCodeTranslations,
  strongLexiconEntryIdentities,
  strongLexiconTranslations,
  strongLexiconRelations,
  strongLexiconResources,
  strongLexiconResourceTranslations,
  strongLexiconEntities,
  strongLexiconEntityTranslations,
  strongLexiconEntityRefs,
  strongLexiconEntityPlaces,
  strongLexiconEntityRelations,
} from './schema'

export type ResourcePublicationRow = Kyselify<typeof resourcePublications>
export type BibleVerseRow = Kyselify<typeof bibleVerses>
export type CommentaryVerseRow = Kyselify<typeof commentaryVerses>
export type CrossReferenceLinkRow = Kyselify<typeof crossReferenceLinks>
export type TimelineEventRow = Kyselify<typeof timelineEvents>
export type NaveTopicRow = Kyselify<typeof naveTopics>
export type NaveVerseLinkRow = Kyselify<typeof naveVerseLinks>
export type ThematicTopicRow = Kyselify<typeof thematicTopics>
export type ThematicTopicSourceRow = Kyselify<typeof thematicTopicSources>
export type ThematicTopicAliasRow = Kyselify<typeof thematicTopicAliases>
export type ThematicTopicPassageRow = Kyselify<typeof thematicTopicPassages>
export type ThematicTopicRelationRow = Kyselify<typeof thematicTopicRelations>
export type ThematicTopicEmbeddingRow = Kyselify<typeof thematicTopicEmbeddings>
export type ThematicImportRunRow = Kyselify<typeof thematicImportRuns>
export type DictionaryEntryRow = Kyselify<typeof dictionaryEntries>
export type DictionaryDirectoryVersePresenceRow = Kyselify<typeof dictionaryDirectoryVersePresences>
export type DictionaryVerseLinkRow = Kyselify<typeof dictionaryVerseLinks>
export type StrongBibleVerseRow = Kyselify<typeof strongBibleVerses>
export type StrongBibleLexemeRow = Kyselify<typeof strongBibleLexemes>
export type StrongBibleIdentityRow = Kyselify<typeof strongBibleIdentities>
export type StrongBibleSpanRow = Kyselify<typeof strongBibleSpans>
export type StrongBibleSpanIdentityRow = Kyselify<typeof strongBibleSpanIdentities>
export type InterlinearBibleVerseRow = Kyselify<typeof interlinearBibleVerses>
export type InterlinearBibleTokenRow = Kyselify<typeof interlinearBibleTokens>
export type InterlinearBibleSegmentRow = Kyselify<typeof interlinearBibleSegments>
export type InterlinearBibleSegmentIdentityRow = Kyselify<typeof interlinearBibleSegmentIdentities>
export type StrongLexiconRecordRow = Kyselify<typeof strongLexiconRecords>
export type StrongLexiconEntryRow = Kyselify<typeof strongLexiconEntries>
export type StrongLexiconRelationKindRow = Kyselify<typeof strongLexiconRelationKinds>
export type StrongLexiconMorphologyCodeRow = Kyselify<typeof strongLexiconMorphologyCodes>
export type StrongLexiconMorphologyCodeTranslationRow = Kyselify<
  typeof strongLexiconMorphologyCodeTranslations
>
export type StrongLexiconEntryIdentityRow = Kyselify<typeof strongLexiconEntryIdentities>
export type StrongLexiconTranslationRow = Kyselify<typeof strongLexiconTranslations>
export type StrongLexiconRelationRow = Kyselify<typeof strongLexiconRelations>
export type StrongLexiconResourceRow = Kyselify<typeof strongLexiconResources>
export type StrongLexiconResourceTranslationRow = Kyselify<typeof strongLexiconResourceTranslations>
export type StrongLexiconEntityRow = Kyselify<typeof strongLexiconEntities>
export type StrongLexiconEntityTranslationRow = Kyselify<typeof strongLexiconEntityTranslations>
export type StrongLexiconEntityRefRow = Kyselify<typeof strongLexiconEntityRefs>
export type StrongLexiconEntityPlaceRow = Kyselify<typeof strongLexiconEntityPlaces>
export type StrongLexiconEntityRelationRow = Kyselify<typeof strongLexiconEntityRelations>

export type ResourceDatabase = {
  resource_publications: ResourcePublicationRow
  bible_verses: BibleVerseRow
  commentary_verses: CommentaryVerseRow
  cross_reference_links: CrossReferenceLinkRow
  timeline_events: TimelineEventRow
  nave_topics: NaveTopicRow
  nave_verse_links: NaveVerseLinkRow
  thematic_topics: ThematicTopicRow
  thematic_topic_sources: ThematicTopicSourceRow
  thematic_topic_aliases: ThematicTopicAliasRow
  thematic_topic_passages: ThematicTopicPassageRow
  thematic_topic_relations: ThematicTopicRelationRow
  thematic_topic_embeddings: ThematicTopicEmbeddingRow
  thematic_import_runs: ThematicImportRunRow
  dictionary_entries: DictionaryEntryRow
  dictionary_directory_verse_presences: DictionaryDirectoryVersePresenceRow
  dictionary_verse_links: DictionaryVerseLinkRow
  strong_bible_verses: StrongBibleVerseRow
  strong_bible_lexemes: StrongBibleLexemeRow
  strong_bible_identities: StrongBibleIdentityRow
  strong_bible_spans: StrongBibleSpanRow
  strong_bible_span_identities: StrongBibleSpanIdentityRow
  interlinear_bible_verses: InterlinearBibleVerseRow
  interlinear_bible_tokens: InterlinearBibleTokenRow
  interlinear_bible_segments: InterlinearBibleSegmentRow
  interlinear_bible_segment_identities: InterlinearBibleSegmentIdentityRow
  strong_lexicon_records: StrongLexiconRecordRow
  strong_lexicon_entries: StrongLexiconEntryRow
  strong_lexicon_relation_kinds: StrongLexiconRelationKindRow
  strong_lexicon_morphology_codes: StrongLexiconMorphologyCodeRow
  strong_lexicon_morphology_code_translations: StrongLexiconMorphologyCodeTranslationRow
  strong_lexicon_entry_identities: StrongLexiconEntryIdentityRow
  strong_lexicon_translations: StrongLexiconTranslationRow
  strong_lexicon_relations: StrongLexiconRelationRow
  strong_lexicon_resources: StrongLexiconResourceRow
  strong_lexicon_resource_translations: StrongLexiconResourceTranslationRow
  strong_lexicon_entities: StrongLexiconEntityRow
  strong_lexicon_entity_translations: StrongLexiconEntityTranslationRow
  strong_lexicon_entity_refs: StrongLexiconEntityRefRow
  strong_lexicon_entity_places: StrongLexiconEntityPlaceRow
  strong_lexicon_entity_relations: StrongLexiconEntityRelationRow
}
