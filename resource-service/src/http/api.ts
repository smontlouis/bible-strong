import { HttpApi, HttpApiEndpoint, HttpApiGroup } from '@effect/platform'
import { Schema } from 'effect'

import {
  BibleChapterDto,
  BiblePericopeIndexDto,
  BibleChapterRequest,
  BibleVersionCoverageDto,
  BibleVersionPath,
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
  InvalidResourceRequestProblem,
  ResourceInternalProblem,
  ResourceNotFoundProblem,
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
    HttpApiEndpoint.get('getBibleChapter', '/v1/bibles/:version/books/:book/chapters/:chapter')
      .setPath(BibleChapterRequest)
      .addSuccess(BibleChapterDto)
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

export class ResourceApi extends HttpApi.make('resource-api')
  .add(SystemApi)
  .add(BibleApi)
  .add(NaveApi)
  .add(StrongBibleApi)
  .add(InterlinearBibleApi)
  .add(StrongLexiconApi) {}
