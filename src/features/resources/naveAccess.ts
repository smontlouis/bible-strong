import loadNaveByLetter from '~helpers/loadNaveByLetter'
import loadNaveByRandom from '~helpers/loadNaveByRandom'
import loadNaveBySearch from '~helpers/loadNaveBySearch'
import loadNaveByVerset from '~helpers/loadNaveByVerset'
import loadNaveItem from '~helpers/loadNaveItem'
import {
  mapLocalResourceError,
  ResourceAccessError,
  unwrapLocalResourceResult,
} from './resourceAccessError'
import { getLocalResourceAvailability } from './resourceAvailability'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import type { ResourceAvailability } from './resourceModel'
import { Schema } from 'effect'
import {
  NaveTopicListResponseDto,
  NaveTopicResponseDto,
  NaveVerseTopicsResponseDto,
} from './naveContract'

export type NaveTopicSummary = {
  normalizedName: string
  name: string
  initial: string
}

export type NaveTopic = NaveTopicSummary & { description: string }

export type NaveTopicReference = {
  name: string
  normalizedName: string
}

export type NaveVerseTopics = [NaveTopicReference[] | undefined, NaveTopicReference[] | undefined]

export type NaveAccess = {
  getAvailability?: (language: ResourceLanguage) => Promise<ResourceAvailability>
  listByLetter: (letter: string, language?: ResourceLanguage) => Promise<NaveTopicSummary[]>
  search: (searchValue: string, language?: ResourceLanguage) => Promise<NaveTopicSummary[]>
  loadItem: (nameLower: string, language?: ResourceLanguage) => Promise<NaveTopic | undefined>
  loadByVerse: (verse: string, language?: ResourceLanguage) => Promise<NaveVerseTopics>
  loadRandom: (language?: ResourceLanguage) => Promise<NaveTopic | undefined>
}

export const localNaveAccess: NaveAccess = {
  getAvailability: async language => {
    const availability = await getLocalResourceAvailability({
      kind: 'database',
      databaseId: 'NAVE',
      language,
    })
    return availability.status === 'available'
      ? { status: 'available' }
      : availability.status === 'corrupt'
        ? {
            status: 'unavailable',
            reason: 'invalid-offline-copy',
            recoveries: ['acquire-offline-copy', 'manage-offline-copies'],
          }
        : {
            status: 'unavailable',
            reason: 'offline-copy-required',
            recoveries: ['acquire-offline-copy'],
          }
  },
  listByLetter: async (letter, language) =>
    unwrapLocalResourceResult(await loadNaveByLetter(letter, language)).map(mapLocalNaveTopic),
  search: async (searchValue, language) =>
    unwrapLocalResourceResult(await loadNaveBySearch(searchValue, language)).map(mapLocalNaveTopic),
  loadItem: async (nameLower, language) => {
    const item = unwrapLocalResourceResult(await loadNaveItem(nameLower, language))
    return item ? { ...mapLocalNaveTopic(item), description: item.description } : undefined
  },
  loadByVerse: async (verse, language) => {
    try {
      const [verseTopics, chapterTopics] = await loadNaveByVerset(verse, language)
      const mapTopics = (topics: { name: string; name_lower: string }[] | undefined) =>
        topics?.map(topic => ({ name: topic.name, normalizedName: topic.name_lower }))
      return [mapTopics(verseTopics), mapTopics(chapterTopics)]
    } catch (error) {
      throw mapLocalResourceError(error)
    }
  },
  loadRandom: async language => {
    const item = unwrapLocalResourceResult(await loadNaveByRandom(language))
    return item ? { ...mapLocalNaveTopic(item), description: item.description } : undefined
  },
}

const mapLocalNaveTopic = (item: { name_lower: string; name: string; letter: string }) => ({
  normalizedName: item.name_lower,
  name: item.name,
  initial: item.letter,
})

type HttpNaveAccessOptions = {
  baseUrl: string
  fetcher?: typeof fetch
  isOnline: () => Promise<boolean>
  timeoutMs?: number
}

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '')

const resourceErrorFromResponse = (status: number, code: unknown) => {
  if (status === 404 && code === 'NAVE_TOPIC_NOT_FOUND') {
    return new ResourceAccessError('NOT_FOUND')
  }
  if (status === 404 && code === 'NAVE_UNSUPPORTED') {
    return new ResourceAccessError('RESOURCE_UNSUPPORTED', ['acquire-offline-copy'])
  }
  return new ResourceAccessError('TEMPORARY_UNAVAILABLE')
}

export const createHttpNaveAccess = ({
  baseUrl,
  fetcher = fetch,
  isOnline,
  timeoutMs = 10_000,
}: HttpNaveAccessOptions): NaveAccess => {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
  const request = async (path: string): Promise<unknown> => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetcher(`${normalizedBaseUrl}${path}`, {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      })
      const payload: unknown = await response.json().catch(() => undefined)
      if (!response.ok) {
        const code =
          payload && typeof payload === 'object' && 'code' in payload ? payload.code : undefined
        throw resourceErrorFromResponse(response.status, code)
      }
      return payload
    } catch (error) {
      if (error instanceof ResourceAccessError) throw error
      throw new ResourceAccessError(
        (await isOnline()) ? 'TEMPORARY_UNAVAILABLE' : 'NETWORK_OFFLINE'
      )
    } finally {
      clearTimeout(timeout)
    }
  }

  const decode = <A>(schema: Schema.Schema<A>, payload: unknown): A => {
    try {
      return Schema.decodeUnknownSync(schema)(payload)
    } catch {
      throw new ResourceAccessError('INTEGRITY_FAILURE')
    }
  }
  const languageOrFrench = (language: ResourceLanguage | undefined) => language ?? 'fr'
  const assertResponseLanguage = (actual: ResourceLanguage, expected: ResourceLanguage) => {
    if (actual !== expected) throw new ResourceAccessError('INTEGRITY_FAILURE')
  }

  return {
    getAvailability: async language =>
      language === 'fr' || language === 'en'
        ? { status: 'available' }
        : {
            status: 'unavailable',
            reason: 'offline-copy-required',
            recoveries: ['acquire-offline-copy'],
          },
    listByLetter: async (letter, language) => {
      const lang = languageOrFrench(language)
      const payload = await request(
        `/v1/naves/${encodeURIComponent(lang)}/topics?initial=${encodeURIComponent(letter)}`
      )
      const decoded = decode(NaveTopicListResponseDto, payload)
      assertResponseLanguage(decoded.resource.language, lang)
      if (decoded.topics.some(topic => topic.initial !== letter)) {
        throw new ResourceAccessError('INTEGRITY_FAILURE')
      }
      return [...decoded.topics]
    },
    search: async (searchValue, language) => {
      const lang = languageOrFrench(language)
      const payload = await request(
        `/v1/naves/${encodeURIComponent(lang)}/topics?search=${encodeURIComponent(searchValue)}`
      )
      const decoded = decode(NaveTopicListResponseDto, payload)
      assertResponseLanguage(decoded.resource.language, lang)
      return [...decoded.topics]
    },
    loadItem: async (nameLower, language) => {
      const lang = languageOrFrench(language)
      try {
        const payload = await request(
          `/v1/naves/${encodeURIComponent(lang)}/topics/${encodeURIComponent(nameLower)}`
        )
        const decoded = decode(NaveTopicResponseDto, payload)
        assertResponseLanguage(decoded.resource.language, lang)
        if (decoded.topic.normalizedName !== nameLower) {
          throw new ResourceAccessError('INTEGRITY_FAILURE')
        }
        return decoded.topic
      } catch (error) {
        if (error instanceof ResourceAccessError && error.code === 'NOT_FOUND') return undefined
        throw error
      }
    },
    loadByVerse: async (verse, language) => {
      const lang = languageOrFrench(language)
      const payload = await request(
        `/v1/naves/${encodeURIComponent(lang)}/verses/${encodeURIComponent(verse)}/topics`
      )
      const decoded = decode(NaveVerseTopicsResponseDto, payload)
      assertResponseLanguage(decoded.resource.language, lang)
      if (decoded.verseKey !== verse) throw new ResourceAccessError('INTEGRITY_FAILURE')
      return [[...decoded.verseTopics], [...decoded.chapterTopics]]
    },
    loadRandom: async language => {
      const lang = languageOrFrench(language)
      const payload = await request(`/v1/naves/${encodeURIComponent(lang)}/random`)
      const decoded = decode(NaveTopicResponseDto, payload)
      assertResponseLanguage(decoded.resource.language, lang)
      return decoded.topic
    },
  }
}

export const unavailableHttpNaveAccess: NaveAccess = {
  getAvailability: async () => ({
    status: 'unavailable',
    reason: 'offline-copy-required',
    recoveries: ['acquire-offline-copy'],
  }),
  listByLetter: async () => {
    throw new ResourceAccessError('RESOURCE_UNSUPPORTED', ['acquire-offline-copy'])
  },
  search: async () => {
    throw new ResourceAccessError('RESOURCE_UNSUPPORTED', ['acquire-offline-copy'])
  },
  loadItem: async () => {
    throw new ResourceAccessError('RESOURCE_UNSUPPORTED', ['acquire-offline-copy'])
  },
  loadByVerse: async () => {
    throw new ResourceAccessError('RESOURCE_UNSUPPORTED', ['acquire-offline-copy'])
  },
  loadRandom: async () => {
    throw new ResourceAccessError('RESOURCE_UNSUPPORTED', ['acquire-offline-copy'])
  },
}

export const createHybridNaveAccess = ({
  offline,
  online,
  remotelyReadableLanguages,
  isOnline,
}: {
  offline: NaveAccess
  online: NaveAccess
  remotelyReadableLanguages: ReadonlySet<ResourceLanguage>
  isOnline: () => Promise<boolean>
}): NaveAccess => {
  const availability = async (language: ResourceLanguage) => {
    const local =
      (await offline.getAvailability?.(language)) ??
      ({
        status: 'unavailable',
        reason: 'offline-copy-required',
        recoveries: ['acquire-offline-copy'],
      } as const)
    return { local, remotelyReadable: remotelyReadableLanguages.has(language) }
  }

  const run = async <T>(
    language: ResourceLanguage,
    localOperation: () => Promise<T>,
    remoteOperation: () => Promise<T>
  ): Promise<T> => {
    const state = await availability(language)
    if (state.local.status === 'available') return localOperation()
    if (!state.remotelyReadable) {
      throw new ResourceAccessError('OFFLINE_COPY_REQUIRED', ['acquire-offline-copy'])
    }
    try {
      return await remoteOperation()
    } catch (error) {
      if (state.local.status === 'unavailable' && state.local.reason === 'invalid-offline-copy') {
        throw new ResourceAccessError('INVALID_OFFLINE_COPY', [
          'acquire-offline-copy',
          'manage-offline-copies',
        ])
      }
      throw error
    }
  }
  const languageOrFrench = (language: ResourceLanguage | undefined) => language ?? 'fr'

  const runSearch = async (searchValue: string, language: ResourceLanguage) => {
    const state = await availability(language)
    if (!state.remotelyReadable || !(await isOnline())) {
      if (state.local.status === 'available') return offline.search(searchValue, language)
      if (state.local.reason === 'invalid-offline-copy') {
        throw new ResourceAccessError('INVALID_OFFLINE_COPY', [
          'acquire-offline-copy',
          'manage-offline-copies',
        ])
      }
      if (!state.remotelyReadable) {
        throw new ResourceAccessError('OFFLINE_COPY_REQUIRED', ['acquire-offline-copy'])
      }
      throw new ResourceAccessError('NETWORK_OFFLINE')
    }
    try {
      return await online.search(searchValue, language)
    } catch (error) {
      if (
        state.local.status === 'available' &&
        error instanceof ResourceAccessError &&
        (error.code === 'TEMPORARY_UNAVAILABLE' || error.code === 'NETWORK_OFFLINE')
      ) {
        return offline.search(searchValue, language)
      }
      if (state.local.status === 'unavailable' && state.local.reason === 'invalid-offline-copy') {
        throw new ResourceAccessError('INVALID_OFFLINE_COPY', [
          'acquire-offline-copy',
          'manage-offline-copies',
        ])
      }
      throw error
    }
  }

  return {
    getAvailability: async language => {
      const state = await availability(language)
      return state.local.status === 'available' || state.remotelyReadable
        ? { status: 'available' }
        : state.local
    },
    listByLetter: (letter, language) => {
      const lang = languageOrFrench(language)
      return run(
        lang,
        () => offline.listByLetter(letter, lang),
        () => online.listByLetter(letter, lang)
      )
    },
    search: (searchValue, language) => {
      const lang = languageOrFrench(language)
      return runSearch(searchValue, lang)
    },
    loadItem: (nameLower, language) => {
      const lang = languageOrFrench(language)
      return run(
        lang,
        () => offline.loadItem(nameLower, lang),
        () => online.loadItem(nameLower, lang)
      )
    },
    loadByVerse: (verse, language) => {
      const lang = languageOrFrench(language)
      return run(
        lang,
        () => offline.loadByVerse(verse, lang),
        () => online.loadByVerse(verse, lang)
      )
    },
    loadRandom: language => {
      const lang = languageOrFrench(language)
      return run(
        lang,
        () => offline.loadRandom(lang),
        () => online.loadRandom(lang)
      )
    },
  }
}
