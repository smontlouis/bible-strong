import { Schema } from 'effect'
import {
  CommentaryReadingIndexRequest,
  CommentaryReadingIndexResponse,
  CommentaryReadingResourceIndex,
  CommentaryReadingSectionRequest,
  CommentaryReadingSectionResponse,
} from '@bible-strong/resource-domain/contracts/commentaryReadingContract'
import { ResourceAccessError } from './resourceAccessError'
import { runWithRequestDeadline } from '~helpers/resourceAppCheckRequest'

export type ReadingIndex = Schema.Schema.Type<typeof CommentaryReadingResourceIndex>
export type ReadingSectionRequest = Schema.Schema.Type<typeof CommentaryReadingSectionRequest>
export type ReadingSection = Schema.Schema.Type<typeof CommentaryReadingSectionResponse>
export type ReadingIndexRequest = Schema.Schema.Type<typeof CommentaryReadingIndexRequest>
export type ReadingIndexResult = {
  indexes: ReadingIndex[]
  unavailable: { resourceId: string; language: 'fr' | 'en'; cause: string }[]
  cached: boolean
}
export type CommentaryReadingLocal = {
  index: (
    resourceId: string,
    language: 'fr' | 'en',
    book: number,
    chapter: number
  ) => Promise<ReadingIndex | undefined>
  section: (request: ReadingSectionRequest) => Promise<ReadingSection | undefined>
}
export type CommentaryReadingCache = {
  read: (key: string) => Promise<unknown>
  write: (key: string, value: unknown) => Promise<void>
}
export type CommentaryReadingAccess = {
  loadIndex: (request: ReadingIndexRequest) => Promise<ReadingIndexResult>
  loadSection: (request: ReadingSectionRequest) => Promise<ReadingSection>
}

export function createCommentaryReadingAccess({
  baseUrl,
  fetcher = fetch,
  isOnline,
  local,
  cache,
}: {
  baseUrl?: string
  fetcher?: typeof fetch
  isOnline: () => Promise<boolean>
  local?: CommentaryReadingLocal
  cache: CommentaryReadingCache
}): CommentaryReadingAccess {
  const key = (r: { resourceId: string; language: string }, book: number, chapter: number) =>
    `${r.resourceId}:${r.language}:${book}:${chapter}`
  const post = async (path: string, body: unknown) => {
    if (!baseUrl || !(await isOnline())) throw new ResourceAccessError('NETWORK_OFFLINE')
    return runWithRequestDeadline(
      async signal => {
        const response = await fetcher(`${baseUrl.replace(/\/$/, '')}/v1/commentaries/${path}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(body),
          signal,
        })
        if (!response.ok)
          throw new ResourceAccessError(
            response.status === 404 ? 'NOT_FOUND' : 'TEMPORARY_UNAVAILABLE'
          )
        return response.json()
      },
      undefined,
      10_000
    )
  }
  return {
    async loadIndex(input) {
      const request = Schema.decodeUnknownSync(CommentaryReadingIndexRequest)(input)
      const indexes: ReadingIndex[] = []
      const missing: (typeof request.resources)[number][] = []
      const unavailable: ReadingIndexResult['unavailable'] = []
      let cached = false
      for (const resource of request.resources) {
        const installed = await local
          ?.index(resource.resourceId, resource.language, request.book, request.chapter)
          .catch(() => undefined)
        if (installed) indexes.push(installed)
        else missing.push(resource)
      }
      if (missing.length) {
        try {
          const response = Schema.decodeUnknownSync(CommentaryReadingIndexResponse)(
            await post('reading-index', { ...request, resources: missing })
          )
          if (response.book !== request.book || response.chapter !== request.chapter)
            throw new ResourceAccessError('INTEGRITY_FAILURE')
          const seen = new Set<string>()
          for (const index of response.indexes) {
            const resource = index.resource
            const identity = `${resource.resourceId}:${resource.language}`
            if (
              resource.kind !== 'commentary' ||
              !missing.some(
                r => r.resourceId === resource.resourceId && r.language === resource.language
              ) ||
              seen.has(identity)
            )
              throw new ResourceAccessError('INTEGRITY_FAILURE')
            seen.add(identity)
          }
          indexes.push(...response.indexes)
          unavailable.push(...response.unavailable)
          for (const index of response.indexes) {
            const base = key(index.resource, request.book, request.chapter)
            await cache.write(`${base}:${index.resource.revision}`, index)
            await cache.write(`${base}:latest`, index.resource.revision)
          }
          for (const resource of missing) {
            if (
              !seen.has(`${resource.resourceId}:${resource.language}`) &&
              !unavailable.some(
                r => r.resourceId === resource.resourceId && r.language === resource.language
              )
            )
              unavailable.push({ ...resource, cause: 'temporary-unavailable' })
          }
        } catch (error) {
          if (error instanceof ResourceAccessError && error.code === 'INTEGRITY_FAILURE')
            throw error
          for (const resource of missing) {
            const base = key(resource, request.book, request.chapter)
            const revision = await cache.read(`${base}:latest`)
            const raw =
              typeof revision === 'string' ? await cache.read(`${base}:${revision}`) : undefined
            const parsed = Schema.decodeUnknownOption(CommentaryReadingResourceIndex)(raw)
            if (
              parsed._tag === 'Some' &&
              parsed.value.resource.revision === revision &&
              parsed.value.resource.resourceId === resource.resourceId &&
              parsed.value.resource.language === resource.language
            ) {
              indexes.push(parsed.value)
              cached = true
            } else
              unavailable.push({
                ...resource,
                cause: (await isOnline()) ? 'temporary-unavailable' : 'offline-copy-required',
              })
          }
        }
      }
      const selectionOrder = (index: ReadingIndex) =>
        request.resources.findIndex(
          resource =>
            resource.resourceId === index.resource.resourceId &&
            resource.language === index.resource.language
        )
      indexes.sort((left, right) => selectionOrder(left) - selectionOrder(right))
      return { indexes, unavailable, cached }
    },
    async loadSection(input) {
      const request = Schema.decodeUnknownSync(CommentaryReadingSectionRequest)(input)
      const installed = await local?.section(request)
      if (installed) return installed
      const response = Schema.decodeUnknownSync(CommentaryReadingSectionResponse)(
        await post('reading-section', request)
      )
      if (
        response.resource.kind !== 'commentary' ||
        response.resource.resourceId !== request.resourceId ||
        response.resource.language !== request.language ||
        response.resource.revision !== request.revision ||
        response.book !== request.book ||
        response.chapter !== request.chapter ||
        response.section.id !== request.sectionId
      )
        throw new ResourceAccessError('INTEGRITY_FAILURE')
      return response
    },
  }
}
