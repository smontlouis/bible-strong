import { HttpApi, HttpApiEndpoint, HttpApiGroup } from '@effect/platform'
import { Schema } from 'effect'

import {
  BibleChapterDto,
  BibleChaptersDto,
  BibleChaptersQuery,
  BiblePericopeIndexDto,
  BibleChapterRequest,
  BibleMultiSearchQuery,
  BibleMultiSearchResponseDto,
  BibleVersionCoverageDto,
  BibleVersionPath,
  BibleSearchQuery,
  BibleSearchResponseDto,
  BibleVerseTextsDto,
  BibleVerseTextsQuery,
} from '../../../src/features/resources/bibleChapterContract'
import {
  NaveLanguagePath,
  NaveTopicListResponseDto,
  NaveTopicPath,
  NaveTopicResponseDto,
  NaveTopicsQuery,
  NaveVersePath,
  NaveVerseTopicsResponseDto,
} from '../../../src/features/resources/naveContract'
import {
  DictionaryEntriesBatchQuery,
  DictionaryEntriesBatchResponseDto,
  DictionaryEntriesQuery,
  DictionaryEntriesResponseDto,
  DictionaryEntryIdPath,
  DictionaryEntryPath,
  DictionaryEntryResponseDto,
  DictionaryLanguagePath,
  DictionaryVersePath,
  DictionaryVerseWordsResponseDto,
} from '../../../src/features/resources/dictionaryContract'
import {
  StrongBibleChapterDto,
  StrongBibleChapterPath,
  StrongBibleCountsDto,
  StrongBibleCoverageDto,
  StrongBibleIdentityPath,
  StrongBibleLemmaStatsDto,
  StrongBibleOccurrencesDto,
  StrongBibleOccurrencesQuery,
  StrongBibleVersionPath,
} from '../../../src/features/resources/strongBibleContract'
import {
  InterlinearBibleChapterDto,
  InterlinearBibleChapterPath,
  InterlinearBibleCoverageDto,
  InterlinearBibleCoveragePath,
} from '../../../src/features/resources/interlinearBibleContract'
import {
  StrongLexiconBrowseQuery,
  StrongLexiconChapterEntitiesPath,
  StrongLexiconChapterEntitiesQuery,
  StrongLexiconChapterEntitiesResponseDto,
  StrongLexiconEntryQuery,
  StrongLexiconEntryDto,
  StrongLexiconEntryCardsDto,
  StrongLexiconEntriesQuery,
  StrongLexiconEntryPath,
  StrongLexiconEntityPath,
  StrongLexiconEntityResponseDto,
  StrongLexiconLanguageQuery,
  StrongLexiconModulePath,
  StrongLexiconModuleStateDto,
  StrongLexiconMorphologyQuery,
  StrongLexiconMorphologyResponseDto,
  StrongLexiconRandomQuery,
  StrongLexiconSearchResponseDto,
} from '../../../src/features/resources/strongLexiconContract'
import {
  CommentaryChapterPath,
  CommentaryChapterResponseDto,
  CommentaryPath,
  CommentaryVerseResponseDto,
  CrossReferencePath,
  CrossReferenceResponseDto,
} from '../../../src/features/resources/supplementaryContract'
import {
  TimelineEventPath,
  TimelineEventResponseDto,
  TimelineEventsQuery,
  TimelineEventsResponseDto,
  TimelineLanguagePath,
} from '../../../src/features/resources/timelineContract'
import {
  InvalidResourceRequestProblem,
  ResourceInternalProblem,
  ResourceNotFoundProblem,
  ResourceRateLimitedProblem,
  ResourceUnavailableProblem,
} from './problems'

export class HealthResponse extends Schema.Class<HealthResponse>('HealthResponse')({
  status: Schema.Literal('ok'),
}) {}

const SystemApi = HttpApiGroup.make('system').add(
  HttpApiEndpoint.get('health', '/health').addSuccess(HealthResponse)
)

const BibleApi = HttpApiGroup.make('bibles')
  .add(
    HttpApiEndpoint.get('getBibleChapters', '/v1/bibles/chapters')
      .setUrlParams(BibleChaptersQuery)
      .addSuccess(BibleChaptersDto)
      .addError(InvalidResourceRequestProblem, { status: 400 })
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .add(
    HttpApiEndpoint.get('searchBibles', '/v1/bibles/search')
      .setUrlParams(BibleMultiSearchQuery)
      .addSuccess(BibleMultiSearchResponseDto)
      .addError(InvalidResourceRequestProblem, { status: 400 })
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .add(
    HttpApiEndpoint.get('searchBible', '/v1/bibles/:version/search')
      .setPath(BibleVersionPath)
      .setUrlParams(BibleSearchQuery)
      .addSuccess(BibleSearchResponseDto)
      .addError(InvalidResourceRequestProblem, { status: 400 })
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .add(
    HttpApiEndpoint.get('getBibleChapter', '/v1/bibles/:version/books/:book/chapters/:chapter')
      .setPath(BibleChapterRequest)
      .addSuccess(BibleChapterDto)
      .addError(InvalidResourceRequestProblem, { status: 400 })
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .add(
    HttpApiEndpoint.get('getBibleVerseTexts', '/v1/bibles/:version/verses')
      .setPath(BibleVersionPath)
      .setUrlParams(BibleVerseTextsQuery)
      .addSuccess(BibleVerseTextsDto)
      .addError(InvalidResourceRequestProblem, { status: 400 })
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .add(
    HttpApiEndpoint.get('getBiblePericopes', '/v1/bibles/:version/pericopes')
      .setPath(BibleVersionPath)
      .addSuccess(BiblePericopeIndexDto)
      .addError(InvalidResourceRequestProblem, { status: 400 })
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .add(
    HttpApiEndpoint.get('getBibleCoverage', '/v1/bibles/:version/coverage')
      .setPath(BibleVersionPath)
      .addSuccess(BibleVersionCoverageDto)
      .addError(InvalidResourceRequestProblem, { status: 400 })
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .addError(ResourceRateLimitedProblem, { status: 429 })

const NaveApi = HttpApiGroup.make('naves')
  .add(
    HttpApiEndpoint.get('getNaveTopic', '/v1/naves/:language/topics/:normalizedName')
      .setPath(NaveTopicPath)
      .addSuccess(NaveTopicResponseDto)
      .addError(InvalidResourceRequestProblem, { status: 400 })
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .add(
    HttpApiEndpoint.get('listNaveTopics', '/v1/naves/:language/topics')
      .setPath(NaveLanguagePath)
      .setUrlParams(NaveTopicsQuery)
      .addSuccess(NaveTopicListResponseDto)
      .addError(InvalidResourceRequestProblem, { status: 400 })
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .add(
    HttpApiEndpoint.get('getNaveVerseTopics', '/v1/naves/:language/verses/:verseKey/topics')
      .setPath(NaveVersePath)
      .addSuccess(NaveVerseTopicsResponseDto)
      .addError(InvalidResourceRequestProblem, { status: 400 })
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .add(
    HttpApiEndpoint.get('getRandomNaveTopic', '/v1/naves/:language/random')
      .setPath(NaveLanguagePath)
      .addSuccess(NaveTopicResponseDto)
      .addError(InvalidResourceRequestProblem, { status: 400 })
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .addError(ResourceRateLimitedProblem, { status: 429 })

const DictionaryApi = HttpApiGroup.make('dictionaries')
  .add(
    HttpApiEndpoint.get('listDictionaryEntries', '/v1/dictionaries/:language/entries')
      .setPath(DictionaryLanguagePath)
      .setUrlParams(DictionaryEntriesQuery)
      .addSuccess(DictionaryEntriesResponseDto)
      .addError(InvalidResourceRequestProblem, { status: 400 })
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .add(
    HttpApiEndpoint.get('getDictionaryEntriesBatch', '/v1/dictionaries/:language/entries/batch')
      .setPath(DictionaryLanguagePath)
      .setUrlParams(DictionaryEntriesBatchQuery)
      .addSuccess(DictionaryEntriesBatchResponseDto)
      .addError(InvalidResourceRequestProblem, { status: 400 })
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .add(
    HttpApiEndpoint.get('getDictionaryEntry', '/v1/dictionaries/:language/entries/:word')
      .setPath(DictionaryEntryPath)
      .addSuccess(DictionaryEntryResponseDto)
      .addError(InvalidResourceRequestProblem, { status: 400 })
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .add(
    HttpApiEndpoint.get('getDictionaryEntryById', '/v1/dictionaries/:language/entries/by-id/:id')
      .setPath(DictionaryEntryIdPath)
      .addSuccess(DictionaryEntryResponseDto)
      .addError(InvalidResourceRequestProblem, { status: 400 })
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .add(
    HttpApiEndpoint.get(
      'getDictionaryVerseWords',
      '/v1/dictionaries/:language/verses/:verseKey/words'
    )
      .setPath(DictionaryVersePath)
      .addSuccess(DictionaryVerseWordsResponseDto)
      .addError(InvalidResourceRequestProblem, { status: 400 })
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .addError(ResourceRateLimitedProblem, { status: 429 })

const StrongBibleApi = HttpApiGroup.make('strongBibles')
  .add(
    HttpApiEndpoint.get('getStrongBibleCoverage', '/v1/strong-bibles/:version/coverage')
      .setPath(StrongBibleVersionPath)
      .addSuccess(StrongBibleCoverageDto)
      .addError(InvalidResourceRequestProblem, { status: 400 })
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .add(
    HttpApiEndpoint.get(
      'getStrongBibleChapter',
      '/v1/strong-bibles/:version/books/:book/chapters/:chapter'
    )
      .setPath(StrongBibleChapterPath)
      .addSuccess(StrongBibleChapterDto)
      .addError(InvalidResourceRequestProblem, { status: 400 })
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .add(
    HttpApiEndpoint.get(
      'getStrongBibleCounts',
      '/v1/strong-bibles/:version/books/:book/identities/:reference/counts'
    )
      .setPath(StrongBibleIdentityPath)
      .addSuccess(StrongBibleCountsDto)
      .addError(InvalidResourceRequestProblem, { status: 400 })
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .add(
    HttpApiEndpoint.get(
      'getStrongBibleOccurrences',
      '/v1/strong-bibles/:version/books/:book/identities/:reference/occurrences'
    )
      .setPath(StrongBibleIdentityPath)
      .setUrlParams(StrongBibleOccurrencesQuery)
      .addSuccess(StrongBibleOccurrencesDto)
      .addError(InvalidResourceRequestProblem, { status: 400 })
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .add(
    HttpApiEndpoint.get(
      'getStrongBibleLemmaStats',
      '/v1/strong-bibles/:version/books/:book/identities/:reference/lemmas'
    )
      .setPath(StrongBibleIdentityPath)
      .addSuccess(StrongBibleLemmaStatsDto)
      .addError(InvalidResourceRequestProblem, { status: 400 })
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .addError(ResourceRateLimitedProblem, { status: 429 })

const InterlinearBibleApi = HttpApiGroup.make('interlinearBibles')
  .add(
    HttpApiEndpoint.get(
      'getInterlinearBibleCoverage',
      '/v1/interlinear-bibles/:version/languages/:language/coverage'
    )
      .setPath(InterlinearBibleCoveragePath)
      .addSuccess(InterlinearBibleCoverageDto)
      .addError(InvalidResourceRequestProblem, { status: 400 })
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .add(
    HttpApiEndpoint.get(
      'getInterlinearBibleChapter',
      '/v1/interlinear-bibles/:version/languages/:language/books/:book/chapters/:chapter'
    )
      .setPath(InterlinearBibleChapterPath)
      .addSuccess(InterlinearBibleChapterDto)
      .addError(InvalidResourceRequestProblem, { status: 400 })
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .addError(ResourceRateLimitedProblem, { status: 429 })

const StrongLexiconApi = HttpApiGroup.make('strongLexicon')
  .add(
    HttpApiEndpoint.get('getStrongLexiconModule', '/v1/strong-lexicon/modules/:moduleId')
      .setPath(StrongLexiconModulePath)
      .addSuccess(StrongLexiconModuleStateDto)
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .add(
    HttpApiEndpoint.get('getStrongLexiconEntries', '/v1/strong-lexicon/entries/batch')
      .setUrlParams(StrongLexiconEntriesQuery)
      .addSuccess(StrongLexiconEntryCardsDto)
      .addError(InvalidResourceRequestProblem, { status: 400 })
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .add(
    HttpApiEndpoint.get('getStrongLexiconEntry', '/v1/strong-lexicon/entries/:reference')
      .setPath(StrongLexiconEntryPath)
      .setUrlParams(StrongLexiconEntryQuery)
      .addSuccess(StrongLexiconEntryDto)
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .add(
    HttpApiEndpoint.get('browseStrongLexicon', '/v1/strong-lexicon/entries')
      .setUrlParams(StrongLexiconBrowseQuery)
      .addSuccess(StrongLexiconSearchResponseDto)
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .add(
    HttpApiEndpoint.get('getRandomStrongLexiconEntry', '/v1/strong-lexicon/random')
      .setUrlParams(StrongLexiconRandomQuery)
      .addSuccess(StrongLexiconSearchResponseDto)
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .add(
    HttpApiEndpoint.get('getStrongLexiconMorphologies', '/v1/strong-lexicon/morphologies')
      .setUrlParams(StrongLexiconMorphologyQuery)
      .addSuccess(StrongLexiconMorphologyResponseDto)
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .add(
    HttpApiEndpoint.get('getStrongLexiconEntity', '/v1/strong-lexicon/entities/:uniqueName')
      .setPath(StrongLexiconEntityPath)
      .setUrlParams(StrongLexiconLanguageQuery)
      .addSuccess(StrongLexiconEntityResponseDto)
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .add(
    HttpApiEndpoint.get(
      'getStrongLexiconChapterEntities',
      '/v1/strong-lexicon/entities/chapters/:bookCode/:chapter'
    )
      .setPath(StrongLexiconChapterEntitiesPath)
      .setUrlParams(StrongLexiconChapterEntitiesQuery)
      .addSuccess(StrongLexiconChapterEntitiesResponseDto)
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .addError(ResourceRateLimitedProblem, { status: 429 })

const SupplementaryApi = HttpApiGroup.make('supplementary')
  .add(
    HttpApiEndpoint.get(
      'getCommentaryVerse',
      '/v1/commentaries/:collection/:language/verses/:verseKey'
    )
      .setPath(CommentaryPath)
      .addSuccess(CommentaryVerseResponseDto)
      .addError(InvalidResourceRequestProblem, { status: 400 })
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .add(
    HttpApiEndpoint.get(
      'getCommentaryChapter',
      '/v1/commentaries/:collection/:language/chapters/:book/:chapter'
    )
      .setPath(CommentaryChapterPath)
      .addSuccess(CommentaryChapterResponseDto)
      .addError(InvalidResourceRequestProblem, { status: 400 })
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .add(
    HttpApiEndpoint.get('getCrossReferences', '/v1/cross-references/:language/verses/:verseKey')
      .setPath(CrossReferencePath)
      .addSuccess(CrossReferenceResponseDto)
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .addError(ResourceRateLimitedProblem, { status: 429 })

const TimelineApi = HttpApiGroup.make('timelines')
  .add(
    HttpApiEndpoint.get('listTimelineEvents', '/v1/timelines/:language/events')
      .setPath(TimelineLanguagePath)
      .setUrlParams(TimelineEventsQuery)
      .addSuccess(TimelineEventsResponseDto)
      .addError(InvalidResourceRequestProblem, { status: 400 })
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )
  .addError(ResourceRateLimitedProblem, { status: 429 })
  .add(
    HttpApiEndpoint.get('getTimelineEvent', '/v1/timelines/:language/events/:slug')
      .setPath(TimelineEventPath)
      .addSuccess(TimelineEventResponseDto)
      .addError(InvalidResourceRequestProblem, { status: 400 })
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )

export class ResourceApi extends HttpApi.make('resource-api')
  .add(SystemApi)
  .add(BibleApi)
  .add(NaveApi)
  .add(DictionaryApi)
  .add(StrongBibleApi)
  .add(InterlinearBibleApi)
  .add(StrongLexiconApi)
  .add(SupplementaryApi)
  .add(TimelineApi) {}
