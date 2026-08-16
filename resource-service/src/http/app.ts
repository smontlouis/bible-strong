import { HttpApiBuilder, HttpApp, HttpServer, HttpServerResponse } from '@effect/platform'
import { Effect, Layer } from 'effect'

import {
  ActiveBiblePublicationUnavailable,
  BibleChapterNotFound,
  BibleChapterRepository,
  BibleChapterRepositoryFailure,
  readBibleChapter,
  readBiblePericopes,
  readBibleCoverage,
  UnsupportedBibleVersion,
  type BibleChapterRepositoryService,
} from '../domain/bibleChapter'
import {
  ActiveNavePublicationUnavailable,
  browseNaveTopics,
  NaveRepository,
  NaveRepositoryFailure,
  NaveTopicNotFound,
  readNaveTopic,
  readNaveVerseTopics,
  readRandomNaveTopic,
  UnsupportedNaveLanguage,
  type NaveRepositoryService,
} from '../domain/nave'
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
    | BibleChapterRepositoryFailure
    | UnsupportedNaveLanguage
    | ActiveNavePublicationUnavailable
    | NaveTopicNotFound
    | NaveRepositoryFailure,
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
    case 'NaveRepositoryFailure':
      return new ResourceInternalProblem({
        ...problemFields(requestId, 'The Resource service could not complete the request.'),
        status: 500,
        code: 'RESOURCE_INTERNAL_FAILURE',
      })
    case 'UnsupportedNaveLanguage':
      return new ResourceNotFoundProblem({
        ...problemFields(requestId, 'This Nave language is not available from this service.'),
        status: 404,
        code: 'NAVE_UNSUPPORTED',
      })
    case 'NaveTopicNotFound':
      return new ResourceNotFoundProblem({
        ...problemFields(requestId, 'This Nave topic does not exist in the active publication.'),
        status: 404,
        code: 'NAVE_TOPIC_NOT_FOUND',
      })
    case 'ActiveNavePublicationUnavailable':
      return new ResourceUnavailableProblem({
        ...problemFields(requestId, 'The Nave publication is temporarily unavailable.'),
        status: 503,
        code: 'NAVE_PUBLICATION_INACTIVE',
        retryAfterSeconds: 30,
      })
  }
}

const representationEtag = (...identity: readonly (string | number)[]) =>
  Effect.promise(async () => {
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(identity.join(':'))
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
    .handle('getBiblePericopes', ({ path, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      return readBiblePericopes(path.version).pipe(
        Effect.tap(response =>
          addResponseHeaders({
            'x-request-id': requestId,
            'x-resource-revision': response.resource.revision,
          })
        ),
        Effect.mapError(cause => toHttpProblem(cause, requestId))
      )
    })
)

const serveNaveResponse = <A extends { resource: { revision: string } }, E, R>(
  effect: Effect.Effect<A, E, R>,
  requestId: string,
  ifNoneMatch: string | undefined,
  cacheIdentity?: readonly (string | number)[]
) =>
  Effect.gen(function* () {
    yield* addResponseHeaders({ 'x-request-id': requestId })
    const response = yield* effect
    const headers: Record<string, string> = {
      'x-resource-revision': response.resource.revision,
    }
    if (cacheIdentity) {
      const etag = yield* representationEtag(...cacheIdentity, response.resource.revision)
      headers.etag = etag
      if (etagMatches(ifNoneMatch, etag)) {
        return HttpServerResponse.empty({ status: 304, headers })
      }
    }
    yield* addResponseHeaders(headers)
    return response
  })

const NaveApiLive = HttpApiBuilder.group(ResourceApi, 'naves', handlers =>
  handlers
    .handle('getNaveTopic', ({ path, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      return serveNaveResponse(
        readNaveTopic(path).pipe(Effect.mapError(cause => toHttpProblem(cause, requestId))),
        requestId,
        request.headers['if-none-match'],
        ['nave', path.language, 'topic', path.normalizedName]
      )
    })
    .handle('listNaveTopics', ({ path, urlParams, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      return serveNaveResponse(
        browseNaveTopics({ ...path, initial: urlParams.initial, search: urlParams.search }).pipe(
          Effect.mapError(cause => toHttpProblem(cause, requestId))
        ),
        requestId,
        request.headers['if-none-match'],
        urlParams.search ? undefined : ['nave', path.language, 'browse', urlParams.initial ?? '*']
      )
    })
    .handle('getNaveVerseTopics', ({ path, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      return serveNaveResponse(
        readNaveVerseTopics(path).pipe(Effect.mapError(cause => toHttpProblem(cause, requestId))),
        requestId,
        request.headers['if-none-match'],
        ['nave', path.language, 'verse-topics', path.verseKey]
      )
    })
    .handle('getRandomNaveTopic', ({ path, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      return serveNaveResponse(
        readRandomNaveTopic(path.language).pipe(
          Effect.mapError(cause => toHttpProblem(cause, requestId))
        ),
        requestId,
        request.headers['if-none-match']
      )
    })
)

export const ResourceApiLive = HttpApiBuilder.api(ResourceApi).pipe(
  Layer.provide(SystemApiLive),
  Layer.provide(BibleApiLive),
  Layer.provide(NaveApiLive)
)

const unavailableRepository: BibleChapterRepositoryService = {
  findActiveChapter: input =>
    Effect.fail(new ActiveBiblePublicationUnavailable({ versionId: input.versionId })),
  findActiveCoverage: versionId =>
    Effect.fail(new ActiveBiblePublicationUnavailable({ versionId })),
  findActivePericopes: versionId =>
    Effect.fail(new ActiveBiblePublicationUnavailable({ versionId })),
}

const unavailableNaveRepository: NaveRepositoryService = {
  findTopic: input =>
    Effect.fail(new ActiveNavePublicationUnavailable({ language: input.language })),
  listTopics: input =>
    Effect.fail(new ActiveNavePublicationUnavailable({ language: input.language })),
  findVerseTopics: input =>
    Effect.fail(new ActiveNavePublicationUnavailable({ language: input.language })),
  findRandomTopic: language => Effect.fail(new ActiveNavePublicationUnavailable({ language })),
}

export const provideResourceRepositories = (
  repository: BibleChapterRepositoryService,
  naveRepository: NaveRepositoryService
) =>
  ResourceApiLive.pipe(
    Layer.provide(
      Layer.merge(
        Layer.succeed(BibleChapterRepository, repository),
        Layer.succeed(NaveRepository, naveRepository)
      )
    )
  )

export const makeResourceWebHandler = (
  repository: BibleChapterRepositoryService = unavailableRepository,
  naveRepository: NaveRepositoryService = unavailableNaveRepository
) => {
  const web = HttpApiBuilder.toWebHandler(
    Layer.mergeAll(provideResourceRepositories(repository, naveRepository), HttpServer.layerContext)
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
