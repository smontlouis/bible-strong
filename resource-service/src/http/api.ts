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

export class ResourceApi extends HttpApi.make('resource-api')
  .add(SystemApi)
  .add(BibleApi)
  .add(NaveApi) {}
