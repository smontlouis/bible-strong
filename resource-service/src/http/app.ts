import { HttpApiBuilder, HttpApp, HttpServer, HttpServerResponse } from '@effect/platform'
import { Effect, Layer } from 'effect'

import {
  ActiveBiblePublicationUnavailable,
  BibleChapterNotFound,
  BibleChapterRepository,
  BibleChapterRepositoryFailure,
  readBibleChapter,
  readBibleCoverage,
  UnsupportedBibleVersion,
  type BibleChapterRepositoryService,
} from '../domain/bibleChapter'
import { HealthResponse, ResourceApi } from './api'
import {
  InvalidResourceRequestProblem,
  ResourceInternalProblem,
  ResourceNotFoundProblem,
  ResourceUnavailableProblem,
} from './problems'

const SystemApiLive = HttpApiBuilder.group(ResourceApi, 'system', handlers =>
  handlers.handle('health', () => Effect.succeed(new HealthResponse({ status: 'ok' })))
)

const requestIdFrom = (value: string | undefined) =>
  value && /^[A-Za-z0-9._:-]{1,128}$/.test(value) ? value : crypto.randomUUID()

const problemFields = (requestId: string, detail: string) => ({
  type: 'https://bible-strong.app/problems/resource',
  title: 'Resource request failed',
  detail,
  requestId,
})

const toHttpProblem = (
  cause:
    | UnsupportedBibleVersion
    | ActiveBiblePublicationUnavailable
    | BibleChapterNotFound
    | BibleChapterRepositoryFailure,
  requestId: string
) => {
  switch (cause._tag) {
    case 'UnsupportedBibleVersion':
      return new ResourceNotFoundProblem({
        ...problemFields(requestId, 'This Bible version is not available from this service.'),
        status: 404,
        code: 'BIBLE_UNSUPPORTED',
      })
    case 'BibleChapterNotFound':
      return new ResourceNotFoundProblem({
        ...problemFields(requestId, 'This chapter does not exist in the active publication.'),
        status: 404,
        code: 'BIBLE_CHAPTER_NOT_FOUND',
      })
    case 'ActiveBiblePublicationUnavailable':
      return new ResourceUnavailableProblem({
        ...problemFields(requestId, 'The Bible publication is temporarily unavailable.'),
        status: 503,
        code: 'BIBLE_PUBLICATION_INACTIVE',
        retryAfterSeconds: 30,
      })
    case 'BibleChapterRepositoryFailure':
      return new ResourceInternalProblem({
        ...problemFields(requestId, 'The Resource service could not complete the request.'),
        status: 500,
        code: 'RESOURCE_INTERNAL_FAILURE',
      })
  }
}

const representationEtag = (versionId: string, revision: string, book: number, chapter: number) =>
  Effect.promise(async () => {
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`${versionId}:${revision}:${book}:${chapter}`)
    )
    return `"${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join(
      ''
    )}"`
  })

const etagMatches = (ifNoneMatch: string | undefined, etag: string) =>
  ifNoneMatch
    ?.split(',')
    .map(candidate => candidate.trim())
    .some(candidate => candidate === '*' || candidate.replace(/^W\//, '') === etag) ?? false

const addResponseHeaders = (headers: Record<string, string>) =>
  HttpApp.appendPreResponseHandler((_request, response) =>
    Effect.succeed(HttpServerResponse.setHeaders(response, headers))
  )

const BibleApiLive = HttpApiBuilder.group(ResourceApi, 'bibles', handlers =>
  handlers
    .handle('getBibleChapter', ({ path, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])

      return Effect.gen(function* () {
        yield* addResponseHeaders({ 'x-request-id': requestId })
        const response = yield* readBibleChapter({
          versionId: path.version,
          book: path.book,
          chapter: path.chapter,
        }).pipe(Effect.mapError(cause => toHttpProblem(cause, requestId)))
        const etag = yield* representationEtag(
          response.resource.versionId,
          response.resource.revision,
          response.book,
          response.chapter
        )
        const headers = {
          etag,
          'x-resource-revision': response.resource.revision,
        }
        if (etagMatches(request.headers['if-none-match'], etag)) {
          return HttpServerResponse.empty({ status: 304, headers })
        }
        yield* addResponseHeaders(headers)
        return response
      })
    })
    .handle('getBibleCoverage', ({ path, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      return readBibleCoverage(path.version).pipe(
        Effect.tap(() => addResponseHeaders({ 'x-request-id': requestId })),
        Effect.mapError(cause => toHttpProblem(cause, requestId))
      )
    })
)

export const ResourceApiLive = HttpApiBuilder.api(ResourceApi).pipe(
  Layer.provide(SystemApiLive),
  Layer.provide(BibleApiLive)
)

const unavailableRepository: BibleChapterRepositoryService = {
  findActiveChapter: input =>
    Effect.fail(new ActiveBiblePublicationUnavailable({ versionId: input.versionId })),
  findActiveCoverage: versionId =>
    Effect.fail(new ActiveBiblePublicationUnavailable({ versionId })),
}

export const provideBibleChapterRepository = (repository: BibleChapterRepositoryService) =>
  ResourceApiLive.pipe(Layer.provide(Layer.succeed(BibleChapterRepository, repository)))

export const makeResourceWebHandler = (
  repository: BibleChapterRepositoryService = unavailableRepository
) => {
  const web = HttpApiBuilder.toWebHandler(
    Layer.mergeAll(provideBibleChapterRepository(repository), HttpServer.layerContext)
  )
  return {
    ...web,
    handler: async (request: Request) => {
      const requestId = requestIdFrom(request.headers.get('x-request-id') ?? undefined)
      const response = await web.handler(request)
      const headers = new Headers(response.headers)
      if (!headers.has('x-request-id')) headers.set('x-request-id', requestId)
      if (response.status === 503 && !headers.has('retry-after')) headers.set('retry-after', '30')
      if (response.status === 400) {
        const payload: unknown = await response
          .clone()
          .json()
          .catch(() => undefined)
        if (payload && typeof payload === 'object' && '_tag' in payload) {
          return Response.json(
            new InvalidResourceRequestProblem({
              ...problemFields(requestId, 'Version, book, or chapter is invalid.'),
              status: 400,
              code: 'INVALID_RESOURCE_REQUEST',
            }),
            { status: 400, headers }
          )
        }
      }
      return new Response(response.body, { status: response.status, headers })
    },
  }
}
