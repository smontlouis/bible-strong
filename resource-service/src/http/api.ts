import { HttpApi, HttpApiEndpoint, HttpApiGroup } from '@effect/platform'
import { Schema } from 'effect'

import {
  BibleChapterDto,
  BibleChapterRequest,
  BibleVersionCoverageDto,
  BibleVersionPath,
} from '../../../src/features/resources/bibleChapterContract'
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
    HttpApiEndpoint.get('getBibleCoverage', '/v1/bibles/:version/coverage')
      .setPath(BibleVersionPath)
      .addSuccess(BibleVersionCoverageDto)
      .addError(InvalidResourceRequestProblem, { status: 400 })
      .addError(ResourceNotFoundProblem, { status: 404 })
      .addError(ResourceUnavailableProblem, { status: 503 })
      .addError(ResourceInternalProblem, { status: 500 })
  )

export class ResourceApi extends HttpApi.make('resource-api').add(SystemApi).add(BibleApi) {}
