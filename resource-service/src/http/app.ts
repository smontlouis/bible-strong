import { HttpApiBuilder, HttpApp, HttpServer, HttpServerResponse } from '@effect/platform'
import { Effect, Layer } from 'effect'

import { addResourceCorsHeaders, makeResourcePreflightResponse } from './cors'

import {
  ActiveBiblePublicationUnavailable,
  BibleChapterNotFound,
  BibleVerseSelectionNotFound,
  BibleChapterRepository,
  BibleChapterRepositoryFailure,
  readBibleChapter,
  readBibleVerseTexts,
  readBiblePericopes,
  readBibleCoverage,
  UnsupportedBibleVersion,
  type BibleChapterRepositoryService,
} from '../domain/bibleChapter'
import {
  ActiveBibleSearchPublicationUnavailable,
  BibleSearchRepository,
  BibleSearchRepositoryFailure,
  readBibleSearch,
  type BibleSearchRepositoryService,
} from '../domain/bibleSearch'
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
import {
  ActiveDictionaryPublicationUnavailable,
  browseDictionaryEntries,
  DictionaryEntryNotFound,
  DictionaryRepository,
  DictionaryRepositoryFailure,
  readDictionaryEntry,
  readDictionaryEntryById,
  readDictionaryEntries,
  readDictionaryVerseWords,
  type DictionaryRepositoryService,
} from '../domain/dictionary'
import {
  ActiveStrongBiblePublicationUnavailable,
  readStrongBibleChapter,
  readStrongBibleCounts,
  readStrongBibleCoverage,
  readStrongBibleLemmaStats,
  readStrongBibleOccurrences,
  StrongBibleChapterNotFound,
  StrongBibleRepository,
  StrongBibleRepositoryFailure,
  UnsupportedStrongBibleVersion,
  type StrongBibleRepositoryService,
} from '../domain/strongBible'
import {
  ActiveInterlinearBiblePublicationUnavailable,
  InterlinearBibleChapterNotFound,
  InterlinearBibleRepository,
  InterlinearBibleRepositoryFailure,
  readInterlinearBibleChapter,
  readInterlinearBibleCoverage,
  UnsupportedInterlinearBible,
  type InterlinearBibleRepositoryService,
} from '../domain/interlinearBible'
import {
  ActiveStrongLexiconPublicationUnavailable,
  browseStrongLexicon,
  readRandomStrongLexiconEntry,
  readStrongLexiconChapterEntities,
  readStrongLexiconEntry,
  readStrongLexiconEntity,
  readStrongLexiconModuleState,
  readStrongLexiconMorphologies,
  StrongLexiconEntityNotFound,
  StrongLexiconEntryNotFound,
  StrongLexiconRepository,
  StrongLexiconRepositoryFailure,
  type StrongLexiconRepositoryService,
} from '../domain/strongLexicon'
import {
  ActiveSupplementaryPublicationUnavailable,
  readCommentaryChapter,
  readCommentaryVerse,
  readCrossReferences,
  SupplementaryContentNotFound,
  SupplementaryRepository,
  SupplementaryRepositoryFailure,
  type SupplementaryRepositoryService,
} from '../domain/supplementary'
import {
  ActiveTimelinePublicationUnavailable,
  TimelineEventNotFound,
  TimelineRepository,
  TimelineRepositoryFailure,
  readTimelineEvent,
  readTimelineEvents,
  type TimelineRepositoryService,
} from '../domain/timeline'
import { HealthResponse, ResourceApi } from './api'
import { parseBibleVerseKey } from '../../../src/features/resources/bibleChapterContract'
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
    | BibleVerseSelectionNotFound
    | BibleChapterRepositoryFailure
    | ActiveBibleSearchPublicationUnavailable
    | BibleSearchRepositoryFailure
    | UnsupportedNaveLanguage
    | ActiveNavePublicationUnavailable
    | NaveTopicNotFound
    | NaveRepositoryFailure
    | ActiveDictionaryPublicationUnavailable
    | DictionaryEntryNotFound
    | DictionaryRepositoryFailure
    | UnsupportedStrongBibleVersion
    | ActiveStrongBiblePublicationUnavailable
    | StrongBibleChapterNotFound
    | StrongBibleRepositoryFailure
    | UnsupportedInterlinearBible
    | ActiveInterlinearBiblePublicationUnavailable
    | InterlinearBibleChapterNotFound
    | InterlinearBibleRepositoryFailure
    | ActiveStrongLexiconPublicationUnavailable
    | StrongLexiconEntryNotFound
    | StrongLexiconEntityNotFound
    | StrongLexiconRepositoryFailure
    | ActiveSupplementaryPublicationUnavailable
    | SupplementaryContentNotFound
    | SupplementaryRepositoryFailure
    | ActiveTimelinePublicationUnavailable
    | TimelineEventNotFound
    | TimelineRepositoryFailure,
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
    case 'BibleVerseSelectionNotFound':
      return new ResourceNotFoundProblem({
        ...problemFields(
          requestId,
          'None of the requested verses exist in the active publication.'
        ),
        status: 404,
        code: 'BIBLE_VERSES_NOT_FOUND',
      })
    case 'ActiveBiblePublicationUnavailable':
      return new ResourceUnavailableProblem({
        ...problemFields(requestId, 'The Bible publication is temporarily unavailable.'),
        status: 503,
        code: 'BIBLE_PUBLICATION_INACTIVE',
        retryAfterSeconds: 30,
      })
    case 'BibleChapterRepositoryFailure':
    case 'BibleSearchRepositoryFailure':
    case 'NaveRepositoryFailure':
    case 'DictionaryRepositoryFailure':
    case 'StrongBibleRepositoryFailure':
    case 'InterlinearBibleRepositoryFailure':
    case 'StrongLexiconRepositoryFailure':
    case 'SupplementaryRepositoryFailure':
      return new ResourceInternalProblem({
        ...problemFields(requestId, 'The Resource service could not complete the request.'),
        status: 500,
        code: 'RESOURCE_INTERNAL_FAILURE',
      })
    case 'ActiveBibleSearchPublicationUnavailable':
      return new ResourceUnavailableProblem({
        ...problemFields(requestId, 'The Bible publication is temporarily unavailable.'),
        status: 503,
        code: 'BIBLE_PUBLICATION_INACTIVE',
        retryAfterSeconds: 30,
      })
    case 'TimelineRepositoryFailure':
      return new ResourceInternalProblem({
        ...problemFields(requestId, 'The Resource service could not complete the request.'),
        status: 500,
        code: 'RESOURCE_INTERNAL_FAILURE',
      })
    case 'TimelineEventNotFound':
      return new ResourceNotFoundProblem({
        ...problemFields(requestId, 'This timeline event does not exist.'),
        status: 404,
        code: 'TIMELINE_EVENT_NOT_FOUND',
      })
    case 'ActiveTimelinePublicationUnavailable':
      return new ResourceUnavailableProblem({
        ...problemFields(requestId, 'The timeline publication is temporarily unavailable.'),
        status: 503,
        code: 'TIMELINE_PUBLICATION_INACTIVE',
        retryAfterSeconds: 30,
      })
    case 'SupplementaryContentNotFound':
      return new ResourceNotFoundProblem({
        ...problemFields(requestId, 'This supplementary resource content does not exist.'),
        status: 404,
        code: 'SUPPLEMENTARY_CONTENT_NOT_FOUND',
      })
    case 'ActiveSupplementaryPublicationUnavailable':
      return new ResourceUnavailableProblem({
        ...problemFields(requestId, 'The supplementary publication is temporarily unavailable.'),
        status: 503,
        code: 'SUPPLEMENTARY_PUBLICATION_INACTIVE',
        retryAfterSeconds: 30,
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
    case 'DictionaryEntryNotFound':
      return new ResourceNotFoundProblem({
        ...problemFields(requestId, 'This dictionary entry does not exist.'),
        status: 404,
        code: 'DICTIONARY_ENTRY_NOT_FOUND',
      })
    case 'ActiveDictionaryPublicationUnavailable':
      return new ResourceUnavailableProblem({
        ...problemFields(requestId, 'The dictionary publication is temporarily unavailable.'),
        status: 503,
        code: 'DICTIONARY_PUBLICATION_INACTIVE',
        retryAfterSeconds: 30,
      })
    case 'UnsupportedStrongBibleVersion':
      return new ResourceNotFoundProblem({
        ...problemFields(requestId, 'This Strong Bible index is not available from this service.'),
        status: 404,
        code: 'STRONG_BIBLE_UNSUPPORTED',
      })
    case 'StrongBibleChapterNotFound':
      return new ResourceNotFoundProblem({
        ...problemFields(requestId, 'This Strong Bible chapter does not exist.'),
        status: 404,
        code: 'STRONG_BIBLE_CHAPTER_NOT_FOUND',
      })
    case 'ActiveStrongBiblePublicationUnavailable':
      return new ResourceUnavailableProblem({
        ...problemFields(requestId, 'The Strong Bible publication is temporarily unavailable.'),
        status: 503,
        code: 'STRONG_BIBLE_PUBLICATION_INACTIVE',
        retryAfterSeconds: 30,
      })
    case 'UnsupportedInterlinearBible':
      return new ResourceNotFoundProblem({
        ...problemFields(requestId, 'This interlinear index is not available from this service.'),
        status: 404,
        code: 'INTERLINEAR_UNSUPPORTED',
      })
    case 'InterlinearBibleChapterNotFound':
      return new ResourceNotFoundProblem({
        ...problemFields(requestId, 'This interlinear chapter does not exist.'),
        status: 404,
        code: 'INTERLINEAR_CHAPTER_NOT_FOUND',
      })
    case 'ActiveInterlinearBiblePublicationUnavailable':
      return new ResourceUnavailableProblem({
        ...problemFields(requestId, 'The interlinear publication is temporarily unavailable.'),
        status: 503,
        code: 'INTERLINEAR_PUBLICATION_INACTIVE',
        retryAfterSeconds: 30,
      })
    case 'StrongLexiconEntryNotFound':
      return new ResourceNotFoundProblem({
        ...problemFields(requestId, 'This Strong lexicon entry does not exist.'),
        status: 404,
        code: 'STRONG_LEXICON_ENTRY_NOT_FOUND',
      })
    case 'StrongLexiconEntityNotFound':
      return new ResourceNotFoundProblem({
        ...problemFields(requestId, 'This Strong lexicon entity does not exist.'),
        status: 404,
        code: 'STRONG_LEXICON_ENTITY_NOT_FOUND',
      })
    case 'ActiveStrongLexiconPublicationUnavailable':
      return new ResourceUnavailableProblem({
        ...problemFields(requestId, 'The Strong lexicon module is temporarily unavailable.'),
        status: 503,
        code: 'STRONG_LEXICON_PUBLICATION_INACTIVE',
        retryAfterSeconds: 30,
      })
    default:
      return new ResourceInternalProblem({
        ...problemFields(requestId, 'The Resource service could not complete the request.'),
        status: 500,
        code: 'RESOURCE_INTERNAL_FAILURE',
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
    .handle('searchBible', ({ path, urlParams, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      return serveRevisionedResponse(
        readBibleSearch({
          versionId: path.version,
          query: urlParams.q,
          book: urlParams.book,
          section: urlParams.section,
          sortOrder: urlParams.sortOrder,
          limit: urlParams.limit,
          offset: urlParams.offset,
        }).pipe(Effect.mapError(cause => toHttpProblem(cause, requestId))),
        requestId,
        request.headers['if-none-match'],
        [
          'bible-search',
          path.version,
          urlParams.q,
          urlParams.book ?? '*',
          urlParams.section ?? '*',
          urlParams.sortOrder ?? 'relevance',
          urlParams.limit ?? 100,
          urlParams.offset ?? 0,
        ]
      )
    })
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
    .handle('getBibleVerseTexts', ({ path, urlParams, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      const references = [...new Set(urlParams.references.split(','))]
      const locations = references.map(reference => parseBibleVerseKey(reference)!)

      return Effect.gen(function* () {
        yield* addResponseHeaders({ 'x-request-id': requestId })
        const response = yield* readBibleVerseTexts({
          versionId: path.version,
          locations,
        }).pipe(Effect.mapError(cause => toHttpProblem(cause, requestId)))
        const etag = yield* representationEtag(
          response.resource.versionId,
          response.resource.revision,
          references.join(',')
        )
        const headers = { etag, 'x-resource-revision': response.resource.revision }
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

const serveRevisionedResponse = <A extends { resource: { revision: string } }, E, R>(
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
      return serveRevisionedResponse(
        readNaveTopic(path).pipe(Effect.mapError(cause => toHttpProblem(cause, requestId))),
        requestId,
        request.headers['if-none-match'],
        ['nave', path.language, 'topic', path.normalizedName]
      )
    })
    .handle('listNaveTopics', ({ path, urlParams, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      return serveRevisionedResponse(
        browseNaveTopics({
          ...path,
          initial: urlParams.initial,
          search: urlParams.search,
          limit: urlParams.limit,
          cursor: urlParams.cursor,
        }).pipe(Effect.mapError(cause => toHttpProblem(cause, requestId))),
        requestId,
        request.headers['if-none-match'],
        urlParams.search
          ? undefined
          : ['nave', path.language, 'browse', urlParams.initial ?? '*', urlParams.cursor ?? 'first']
      )
    })
    .handle('getNaveVerseTopics', ({ path, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      return serveRevisionedResponse(
        readNaveVerseTopics(path).pipe(Effect.mapError(cause => toHttpProblem(cause, requestId))),
        requestId,
        request.headers['if-none-match'],
        ['nave', path.language, 'verse-topics', path.verseKey]
      )
    })
    .handle('getRandomNaveTopic', ({ path, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      return serveRevisionedResponse(
        readRandomNaveTopic(path.language).pipe(
          Effect.mapError(cause => toHttpProblem(cause, requestId))
        ),
        requestId,
        request.headers['if-none-match']
      )
    })
)

const DictionaryApiLive = HttpApiBuilder.group(ResourceApi, 'dictionaries', handlers =>
  handlers
    .handle('listDictionaryEntries', ({ path, urlParams, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      return serveRevisionedResponse(
        browseDictionaryEntries({
          language: path.language,
          initial: urlParams.initial,
          search: urlParams.search,
          limit: urlParams.limit,
          cursor: urlParams.cursor,
        }).pipe(Effect.mapError(cause => toHttpProblem(cause, requestId))),
        requestId,
        request.headers['if-none-match'],
        urlParams.search
          ? undefined
          : [
              'dictionary',
              path.language,
              'browse',
              urlParams.initial ?? '*',
              urlParams.cursor ?? 'first',
            ]
      )
    })
    .handle('getDictionaryEntriesBatch', ({ path, urlParams, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      const words = urlParams.words
        .split(',')
        .map(word => word.trim())
        .filter(Boolean)
        .slice(0, 100)
      return serveRevisionedResponse(
        readDictionaryEntries({ language: path.language, words }).pipe(
          Effect.mapError(cause => toHttpProblem(cause, requestId))
        ),
        requestId,
        request.headers['if-none-match']
      )
    })
    .handle('getDictionaryEntry', ({ path, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      return serveRevisionedResponse(
        readDictionaryEntry(path).pipe(Effect.mapError(cause => toHttpProblem(cause, requestId))),
        requestId,
        request.headers['if-none-match'],
        ['dictionary', path.language, 'entry', path.word]
      )
    })
    .handle('getDictionaryEntryById', ({ path, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      return serveRevisionedResponse(
        readDictionaryEntryById(path).pipe(
          Effect.mapError(cause => toHttpProblem(cause, requestId))
        ),
        requestId,
        request.headers['if-none-match'],
        ['dictionary', path.language, 'entry-id', path.id]
      )
    })
    .handle('getDictionaryVerseWords', ({ path, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      return serveRevisionedResponse(
        readDictionaryVerseWords(path).pipe(
          Effect.mapError(cause => toHttpProblem(cause, requestId))
        ),
        requestId,
        request.headers['if-none-match'],
        ['dictionary', path.language, 'verse', path.verseKey]
      )
    })
)

const StrongBibleApiLive = HttpApiBuilder.group(ResourceApi, 'strongBibles', handlers =>
  handlers
    .handle('getStrongBibleCoverage', ({ path, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      return serveRevisionedResponse(
        readStrongBibleCoverage(path.version).pipe(
          Effect.mapError(cause => toHttpProblem(cause, requestId))
        ),
        requestId,
        request.headers['if-none-match'],
        ['strong-bible', path.version, 'coverage']
      )
    })
    .handle('getStrongBibleChapter', ({ path, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      return serveRevisionedResponse(
        readStrongBibleChapter({
          versionId: path.version,
          book: path.book,
          chapter: path.chapter,
        }).pipe(Effect.mapError(cause => toHttpProblem(cause, requestId))),
        requestId,
        request.headers['if-none-match'],
        ['strong-bible', path.version, path.book, path.chapter]
      )
    })
    .handle('getStrongBibleCounts', ({ path, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      return serveRevisionedResponse(
        readStrongBibleCounts({
          versionId: path.version,
          book: path.book,
          reference: path.reference,
        }).pipe(Effect.mapError(cause => toHttpProblem(cause, requestId))),
        requestId,
        request.headers['if-none-match'],
        ['strong-bible', path.version, path.book, path.reference, 'counts']
      )
    })
    .handle('getStrongBibleOccurrences', ({ path, urlParams, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      return serveRevisionedResponse(
        readStrongBibleOccurrences({
          versionId: path.version,
          book: path.book,
          reference: path.reference,
          limit: urlParams.limit,
          cursor: urlParams.cursor,
          allBooks: urlParams.allBooks === 'true',
          lexemeId: urlParams.lexemeId,
        }).pipe(Effect.mapError(cause => toHttpProblem(cause, requestId))),
        requestId,
        request.headers['if-none-match']
      )
    })
    .handle('getStrongBibleLemmaStats', ({ path, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      return serveRevisionedResponse(
        readStrongBibleLemmaStats({
          versionId: path.version,
          book: path.book,
          reference: path.reference,
        }).pipe(Effect.mapError(cause => toHttpProblem(cause, requestId))),
        requestId,
        request.headers['if-none-match'],
        ['strong-bible', path.version, path.book, path.reference, 'lemmas']
      )
    })
)

const InterlinearBibleApiLive = HttpApiBuilder.group(ResourceApi, 'interlinearBibles', handlers =>
  handlers
    .handle('getInterlinearBibleCoverage', ({ path, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      return serveRevisionedResponse(
        readInterlinearBibleCoverage({
          versionId: path.version,
          language: path.language,
        }).pipe(Effect.mapError(cause => toHttpProblem(cause, requestId))),
        requestId,
        request.headers['if-none-match'],
        ['interlinear-bible', path.version, path.language, 'coverage']
      )
    })
    .handle('getInterlinearBibleChapter', ({ path, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      return serveRevisionedResponse(
        readInterlinearBibleChapter({
          versionId: path.version,
          language: path.language,
          book: path.book,
          chapter: path.chapter,
        }).pipe(Effect.mapError(cause => toHttpProblem(cause, requestId))),
        requestId,
        request.headers['if-none-match'],
        ['interlinear-bible', path.version, path.language, path.book, path.chapter]
      )
    })
)

const StrongLexiconApiLive = HttpApiBuilder.group(ResourceApi, 'strongLexicon', handlers =>
  handlers
    .handle('getStrongLexiconModule', ({ path, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      return readStrongLexiconModuleState(path.moduleId).pipe(
        Effect.tap(() => addResponseHeaders({ 'x-request-id': requestId })),
        Effect.mapError(cause => toHttpProblem(cause, requestId))
      )
    })
    .handle('getStrongLexiconEntry', ({ path, urlParams, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      return serveRevisionedResponse(
        readStrongLexiconEntry({
          reference: path.reference,
          language: urlParams.language,
          ...(urlParams.kind ? { kind: urlParams.kind } : {}),
        }).pipe(Effect.mapError(cause => toHttpProblem(cause, requestId))),
        requestId,
        request.headers['if-none-match'],
        ['strong-lexicon', path.reference, urlParams.language, urlParams.kind ?? 'strong']
      )
    })
    .handle('browseStrongLexicon', ({ urlParams, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      return serveRevisionedResponse(
        browseStrongLexicon({
          language: urlParams.language,
          lexicalLanguage: urlParams.lexicalLanguage,
          search: urlParams.search,
          prefix: urlParams.prefix,
          limit: urlParams.limit ?? 100,
          cursor: urlParams.cursor,
        }).pipe(Effect.mapError(cause => toHttpProblem(cause, requestId))),
        requestId,
        request.headers['if-none-match']
      )
    })
    .handle('getRandomStrongLexiconEntry', ({ urlParams, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      return serveRevisionedResponse(
        readRandomStrongLexiconEntry(urlParams).pipe(
          Effect.mapError(cause => toHttpProblem(cause, requestId))
        ),
        requestId,
        request.headers['if-none-match']
      )
    })
    .handle('getStrongLexiconMorphologies', ({ urlParams, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      return serveRevisionedResponse(
        readStrongLexiconMorphologies({
          language: urlParams.language,
          codes: urlParams.codes
            .split(',')
            .map(code => code.trim())
            .filter(Boolean),
        }).pipe(Effect.mapError(cause => toHttpProblem(cause, requestId))),
        requestId,
        request.headers['if-none-match']
      )
    })
    .handle('getStrongLexiconEntity', ({ path, urlParams, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      return serveRevisionedResponse(
        readStrongLexiconEntity({ uniqueName: path.uniqueName, language: urlParams.language }).pipe(
          Effect.mapError(cause => toHttpProblem(cause, requestId))
        ),
        requestId,
        request.headers['if-none-match'],
        ['strong-lexicon', 'entity', path.uniqueName, urlParams.language]
      )
    })
    .handle('getStrongLexiconChapterEntities', ({ path, urlParams, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      return serveRevisionedResponse(
        readStrongLexiconChapterEntities({
          bookCode: path.bookCode,
          chapter: path.chapter,
          language: urlParams.language,
          strongCodes: (urlParams.strongCodes ?? '').split(',').filter(Boolean),
        }).pipe(Effect.mapError(cause => toHttpProblem(cause, requestId))),
        requestId,
        request.headers['if-none-match']
      )
    })
)

const SupplementaryApiLive = HttpApiBuilder.group(ResourceApi, 'supplementary', handlers =>
  handlers
    .handle('getCommentaryVerse', ({ path, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      return serveRevisionedResponse(
        readCommentaryVerse(path).pipe(Effect.mapError(cause => toHttpProblem(cause, requestId))),
        requestId,
        request.headers['if-none-match'],
        ['commentary', path.collection, path.language, path.verseKey]
      )
    })
    .handle('getCommentaryChapter', ({ path, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      return serveRevisionedResponse(
        readCommentaryChapter(path).pipe(Effect.mapError(cause => toHttpProblem(cause, requestId))),
        requestId,
        request.headers['if-none-match'],
        ['commentary', path.collection, path.language, path.book, path.chapter]
      )
    })
    .handle('getCrossReferences', ({ path, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      return serveRevisionedResponse(
        readCrossReferences(path).pipe(Effect.mapError(cause => toHttpProblem(cause, requestId))),
        requestId,
        request.headers['if-none-match'],
        ['cross-references', path.language, path.verseKey]
      )
    })
)

const TimelineApiLive = HttpApiBuilder.group(ResourceApi, 'timelines', handlers =>
  handlers
    .handle('listTimelineEvents', ({ path, urlParams, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      return serveRevisionedResponse(
        readTimelineEvents(path.language, {
          search: urlParams.search,
          limit: urlParams.limit,
        }).pipe(Effect.mapError(cause => toHttpProblem(cause, requestId))),
        requestId,
        request.headers['if-none-match'],
        urlParams.search ? undefined : ['timeline', path.language, 'events']
      )
    })
    .handle('getTimelineEvent', ({ path, request }) => {
      const requestId = requestIdFrom(request.headers['x-request-id'])
      return serveRevisionedResponse(
        readTimelineEvent(path).pipe(Effect.mapError(cause => toHttpProblem(cause, requestId))),
        requestId,
        request.headers['if-none-match'],
        ['timeline', path.language, 'event', path.slug]
      )
    })
)

export const ResourceApiLive = HttpApiBuilder.api(ResourceApi).pipe(
  Layer.provide(SystemApiLive),
  Layer.provide(BibleApiLive),
  Layer.provide(NaveApiLive),
  Layer.provide(DictionaryApiLive),
  Layer.provide(StrongBibleApiLive),
  Layer.provide(InterlinearBibleApiLive),
  Layer.provide(StrongLexiconApiLive),
  Layer.provide(SupplementaryApiLive),
  Layer.provide(TimelineApiLive)
)

const unavailableRepository: BibleChapterRepositoryService = {
  findActiveVerseTexts: input =>
    Effect.fail(new ActiveBiblePublicationUnavailable({ versionId: input.versionId })),
  findActiveChapter: input =>
    Effect.fail(new ActiveBiblePublicationUnavailable({ versionId: input.versionId })),
  findActiveCoverage: versionId =>
    Effect.fail(new ActiveBiblePublicationUnavailable({ versionId })),
  findActivePericopes: versionId =>
    Effect.fail(new ActiveBiblePublicationUnavailable({ versionId })),
}

const unavailableBibleSearchRepository: BibleSearchRepositoryService = {
  search: input =>
    Effect.fail(new ActiveBibleSearchPublicationUnavailable({ versionId: input.versionId })),
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

const unavailableDictionaryRepository: DictionaryRepositoryService = {
  listEntries: input =>
    Effect.fail(new ActiveDictionaryPublicationUnavailable({ language: input.language })),
  findEntry: input =>
    Effect.fail(new ActiveDictionaryPublicationUnavailable({ language: input.language })),
  findEntryById: input =>
    Effect.fail(new ActiveDictionaryPublicationUnavailable({ language: input.language })),
  findEntries: input =>
    Effect.fail(new ActiveDictionaryPublicationUnavailable({ language: input.language })),
  findVerseWords: input =>
    Effect.fail(new ActiveDictionaryPublicationUnavailable({ language: input.language })),
}

const unavailableStrongBibleRepository: StrongBibleRepositoryService = {
  findActiveCoverage: versionId =>
    Effect.fail(new ActiveStrongBiblePublicationUnavailable({ versionId })),
  findActiveChapter: input =>
    Effect.fail(new ActiveStrongBiblePublicationUnavailable({ versionId: input.versionId })),
  findCountsByBook: input =>
    Effect.fail(new ActiveStrongBiblePublicationUnavailable({ versionId: input.versionId })),
  findOccurrences: input =>
    Effect.fail(new ActiveStrongBiblePublicationUnavailable({ versionId: input.versionId })),
  findLemmaStats: input =>
    Effect.fail(new ActiveStrongBiblePublicationUnavailable({ versionId: input.versionId })),
}

const unavailableInterlinearBibleRepository: InterlinearBibleRepositoryService = {
  findActiveCoverage: input => Effect.fail(new ActiveInterlinearBiblePublicationUnavailable(input)),
  findActiveChapter: input =>
    Effect.fail(
      new ActiveInterlinearBiblePublicationUnavailable({
        versionId: input.versionId,
        language: input.language,
      })
    ),
}

const unavailableStrongLexiconRepository: StrongLexiconRepositoryService = {
  getModuleState: moduleId => Effect.succeed({ moduleId, status: 'unavailable' }),
  findEntry: () => Effect.fail(new ActiveStrongLexiconPublicationUnavailable({ moduleId: 'core' })),
  listEntries: () =>
    Effect.fail(new ActiveStrongLexiconPublicationUnavailable({ moduleId: 'core' })),
  findRandom: () =>
    Effect.fail(new ActiveStrongLexiconPublicationUnavailable({ moduleId: 'core' })),
  findMorphologies: () =>
    Effect.fail(new ActiveStrongLexiconPublicationUnavailable({ moduleId: 'core' })),
  findEntity: () =>
    Effect.fail(new ActiveStrongLexiconPublicationUnavailable({ moduleId: 'entities' })),
  findChapterEntities: () =>
    Effect.fail(new ActiveStrongLexiconPublicationUnavailable({ moduleId: 'entities' })),
}

const unavailableSupplementaryRepository: SupplementaryRepositoryService = {
  findCommentaryVerse: () =>
    Effect.fail(
      new ActiveSupplementaryPublicationUnavailable({ resourceIdentity: 'commentary:MHY:fr' })
    ),
  findCommentaryChapter: () =>
    Effect.fail(
      new ActiveSupplementaryPublicationUnavailable({ resourceIdentity: 'commentary:MHY:fr' })
    ),
  findCrossReferences: () =>
    Effect.fail(
      new ActiveSupplementaryPublicationUnavailable({ resourceIdentity: 'cross-references:fr' })
    ),
}

const unavailableTimelineRepository: TimelineRepositoryService = {
  listEvents: language => Effect.fail(new ActiveTimelinePublicationUnavailable({ language })),
  findEvent: input =>
    Effect.fail(new ActiveTimelinePublicationUnavailable({ language: input.language })),
}

export const provideResourceRepositories = (
  repository: BibleChapterRepositoryService,
  naveRepository: NaveRepositoryService,
  dictionaryRepository: DictionaryRepositoryService = unavailableDictionaryRepository,
  strongBibleRepository: StrongBibleRepositoryService = unavailableStrongBibleRepository,
  interlinearBibleRepository: InterlinearBibleRepositoryService = unavailableInterlinearBibleRepository,
  strongLexiconRepository: StrongLexiconRepositoryService = unavailableStrongLexiconRepository,
  supplementaryRepository: SupplementaryRepositoryService = unavailableSupplementaryRepository,
  timelineRepository: TimelineRepositoryService = unavailableTimelineRepository,
  bibleSearchRepository: BibleSearchRepositoryService = unavailableBibleSearchRepository
) =>
  ResourceApiLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(BibleChapterRepository, repository),
        Layer.succeed(BibleSearchRepository, bibleSearchRepository),
        Layer.succeed(NaveRepository, naveRepository),
        Layer.succeed(DictionaryRepository, dictionaryRepository),
        Layer.succeed(StrongBibleRepository, strongBibleRepository),
        Layer.succeed(InterlinearBibleRepository, interlinearBibleRepository),
        Layer.succeed(StrongLexiconRepository, strongLexiconRepository),
        Layer.succeed(SupplementaryRepository, supplementaryRepository),
        Layer.succeed(TimelineRepository, timelineRepository)
      )
    )
  )

export const makeResourceWebHandler = (
  repository: BibleChapterRepositoryService = unavailableRepository,
  naveRepository: NaveRepositoryService = unavailableNaveRepository,
  overrides: ResourceRepositoryOverrides = {},
  options: ResourceWebHandlerOptions = {}
) => {
  const web = HttpApiBuilder.toWebHandler(
    Layer.mergeAll(
      provideResourceRepositories(
        repository,
        naveRepository,
        overrides.dictionary ?? unavailableDictionaryRepository,
        overrides.strongBible ?? unavailableStrongBibleRepository,
        overrides.interlinearBible ?? unavailableInterlinearBibleRepository,
        overrides.strongLexicon ?? unavailableStrongLexiconRepository,
        overrides.supplementary ?? unavailableSupplementaryRepository,
        overrides.timeline ?? unavailableTimelineRepository,
        overrides.bibleSearch ?? unavailableBibleSearchRepository
      ),
      HttpServer.layerContext
    )
  )
  return {
    ...web,
    handler: async (request: Request) => {
      const preflight = makeResourcePreflightResponse(request, options.corsAllowedOrigins ?? [])
      if (preflight) return preflight
      const requestId = requestIdFrom(request.headers.get('x-request-id') ?? undefined)
      const response = await web.handler(request)
      const headers = new Headers(response.headers)
      addResourceCorsHeaders(request, headers, options.corsAllowedOrigins ?? [])
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

export type ResourceRepositoryOverrides = {
  bibleSearch?: BibleSearchRepositoryService
  dictionary?: DictionaryRepositoryService
  strongBible?: StrongBibleRepositoryService
  interlinearBible?: InterlinearBibleRepositoryService
  strongLexicon?: StrongLexiconRepositoryService
  supplementary?: SupplementaryRepositoryService
  timeline?: TimelineRepositoryService
}

export type ResourceWebHandlerOptions = {
  corsAllowedOrigins?: readonly string[]
}
