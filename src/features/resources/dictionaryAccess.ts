import loadDictionnaireByLetter from '~helpers/loadDictionnaireByLetter'
import loadDictionnaireBySearch from '~helpers/loadDictionnaireBySearch'
import loadDictionnaireItem from '~helpers/loadDictionnaireItem'
import loadDictionnaireItemByRowId from '~helpers/loadDictionnaireItemByRowId'
import loadDictionnaireWords from '~helpers/loadDictionnaireWords'
import loadDictionnaireItems from '~helpers/loadDictionnaireItems'
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
  encodeDictionaryPageCursor,
  DictionaryEntriesBatchResponseDto,
  DictionaryEntriesResponseDto,
  DictionaryEntryResponseDto,
  DictionaryVerseWordsResponseDto,
} from './dictionaryContract'

export type DictionarySummary = {
  id: number
  word: string
  normalizedWord: string
}

export type DictionaryEntry = {
  id?: number
  word: string
  definition: string
}

export type DictionaryWordReference = { word: string }
export type DictionaryPageOptions = { limit?: number; cursor?: string }
export type DictionaryPage = { entries: DictionarySummary[]; nextCursor?: string }

export type DictionaryAccess = {
  getAvailability?: (language: ResourceLanguage) => Promise<ResourceAvailability>
  listByLetter: (letter: string, language?: ResourceLanguage) => Promise<DictionarySummary[]>
  search: (searchValue: string, language?: ResourceLanguage) => Promise<DictionarySummary[]>
  listByLetterPage: (
    letter: string,
    options?: DictionaryPageOptions,
    language?: ResourceLanguage
  ) => Promise<DictionaryPage>
  searchPage: (
    searchValue: string,
    options?: DictionaryPageOptions,
    language?: ResourceLanguage
  ) => Promise<DictionaryPage>
  loadItem: (word: string, language?: ResourceLanguage) => Promise<DictionaryEntry | undefined>
  loadItems: (words: readonly string[], language?: ResourceLanguage) => Promise<DictionaryEntry[]>
  loadItemByRowId: (
    id: number | string,
    language?: ResourceLanguage
  ) => Promise<DictionaryWordReference | undefined>
  loadWordsForVerse: (verseId: string, language?: ResourceLanguage) => Promise<string[]>
}

export const localDictionaryAccess: DictionaryAccess = {
  getAvailability: async language => {
    const availability = await getLocalResourceAvailability({
      kind: 'database',
      databaseId: 'DICTIONNAIRE',
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
  listByLetter: async letter =>
    (await localDictionaryAccess.listByLetterPage(letter, { limit: 50 })).entries,
  search: async searchValue =>
    (await localDictionaryAccess.searchPage(searchValue, { limit: 50 })).entries,
  listByLetterPage: async (letter, options = {}) => {
    const limit = options.limit ?? 50
    const rows = unwrapLocalResourceResult(
      await loadDictionnaireByLetter(letter, { ...options, limit })
    )
    const pageRows = rows.slice(0, limit)
    return {
      entries: pageRows.map(item => ({
        id: item.rowid,
        word: item.word,
        normalizedWord: item.sanitized_word,
      })),
      ...(rows.length > limit && pageRows.length
        ? {
            nextCursor: encodeDictionaryPageCursor([
              pageRows.at(-1)!.sanitized_word,
              pageRows.at(-1)!.rowid,
            ]),
          }
        : {}),
    }
  },
  searchPage: async (searchValue, options = {}) => {
    const limit = options.limit ?? 50
    const rows = unwrapLocalResourceResult(
      await loadDictionnaireBySearch(searchValue, { ...options, limit })
    )
    const pageRows = rows.slice(0, limit)
    return {
      entries: pageRows.map(item => ({
        id: item.rowid,
        word: item.word,
        normalizedWord: item.sanitized_word,
      })),
      ...(rows.length > limit && pageRows.length
        ? {
            nextCursor: encodeDictionaryPageCursor([
              pageRows.at(-1)!.sanitized_word,
              pageRows.at(-1)!.rowid,
            ]),
          }
        : {}),
    }
  },
  loadItem: async word => {
    try {
      return await loadDictionnaireItem(word)
    } catch (error) {
      throw mapLocalResourceError(error)
    }
  },
  loadItems: async words =>
    (await loadDictionnaireItems(words)).map(({ word, definition }) => ({ word, definition })),
  loadItemByRowId: async id => unwrapLocalResourceResult(await loadDictionnaireItemByRowId(id)),
  loadWordsForVerse: async verseId => {
    try {
      return await loadDictionnaireWords(verseId)
    } catch (error) {
      throw mapLocalResourceError(error)
    }
  },
}

type HttpDictionaryAccessOptions = {
  baseUrl: string
  fetcher?: typeof fetch
  isOnline: () => Promise<boolean>
  timeoutMs?: number
}

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '')

const resourceErrorFromResponse = (status: number, code: unknown) => {
  if (status === 404 && code === 'DICTIONARY_ENTRY_NOT_FOUND') {
    return new ResourceAccessError('NOT_FOUND')
  }
  if (status === 404 && code === 'DICTIONARY_UNSUPPORTED') {
    return new ResourceAccessError('RESOURCE_UNSUPPORTED', ['acquire-offline-copy'])
  }
  if (status === 503 && code === 'DICTIONARY_PUBLICATION_INACTIVE') {
    return new ResourceAccessError('TEMPORARY_UNAVAILABLE')
  }
  return new ResourceAccessError('TEMPORARY_UNAVAILABLE')
}

export const createHttpDictionaryAccess = ({
  baseUrl,
  fetcher = fetch,
  isOnline,
  timeoutMs = 10_000,
}: HttpDictionaryAccessOptions): DictionaryAccess => {
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
  const assertLanguage = (actual: ResourceLanguage, expected: ResourceLanguage) => {
    if (actual !== expected) throw new ResourceAccessError('INTEGRITY_FAILURE')
  }
  const languageOrFrench = (language: ResourceLanguage | undefined) => language ?? 'fr'

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
      return (await createPageRequest({ initial: letter, language })).entries
    },
    search: async (searchValue, language) => {
      return (await createPageRequest({ search: searchValue, language })).entries
    },
    listByLetterPage: (letter, options, language) =>
      createPageRequest({ initial: letter, language, ...options }),
    searchPage: (search, options, language) => createPageRequest({ search, language, ...options }),
    loadItem: async (word, language) => {
      const lang = languageOrFrench(language)
      try {
        const payload = await request(
          `/v1/dictionaries/${encodeURIComponent(lang)}/entries/${encodeURIComponent(word)}`
        )
        const decoded = decode(DictionaryEntryResponseDto, payload)
        assertLanguage(decoded.resource.language, lang)
        if (decoded.entry.word.length === 0) throw new ResourceAccessError('INTEGRITY_FAILURE')
        return decoded.entry
      } catch (error) {
        if (error instanceof ResourceAccessError && error.code === 'NOT_FOUND') return undefined
        throw error
      }
    },
    loadItems: async (words, language) => {
      if (words.length === 0) return []
      const lang = languageOrFrench(language)
      const normalized = [...new Set(words.map(word => word.trim().toLocaleLowerCase()))]
      const params = new URLSearchParams({ words: normalized.join(',') })
      const decoded = decode(
        DictionaryEntriesBatchResponseDto,
        await request(`/v1/dictionaries/${encodeURIComponent(lang)}/entries/batch?${params}`)
      )
      assertLanguage(decoded.resource.language, lang)
      return [...decoded.entries]
    },
    loadItemByRowId: async (id, language) => {
      const lang = languageOrFrench(language)
      try {
        const payload = await request(
          `/v1/dictionaries/${encodeURIComponent(lang)}/entries/by-id/${encodeURIComponent(String(id))}`
        )
        const decoded = decode(DictionaryEntryResponseDto, payload)
        assertLanguage(decoded.resource.language, lang)
        return { word: decoded.entry.word }
      } catch (error) {
        if (error instanceof ResourceAccessError && error.code === 'NOT_FOUND') return undefined
        throw error
      }
    },
    loadWordsForVerse: async (verseId, language) => {
      const lang = languageOrFrench(language)
      const payload = await request(
        `/v1/dictionaries/${encodeURIComponent(lang)}/verses/${encodeURIComponent(verseId)}/words`
      )
      const decoded = decode(DictionaryVerseWordsResponseDto, payload)
      assertLanguage(decoded.resource.language, lang)
      if (decoded.verseKey !== verseId) throw new ResourceAccessError('INTEGRITY_FAILURE')
      return [...decoded.words]
    },
  }

  async function createPageRequest({
    initial,
    search,
    language,
    limit = 50,
    cursor,
  }: {
    initial?: string
    search?: string
    language?: ResourceLanguage
    limit?: number
    cursor?: string
  }): Promise<DictionaryPage> {
    const lang = languageOrFrench(language)
    const params = new URLSearchParams({
      ...(initial ? { initial } : {}),
      ...(search ? { search } : {}),
      limit: String(limit),
      ...(cursor ? { cursor } : {}),
    })
    const decoded = decode(
      DictionaryEntriesResponseDto,
      await request(`/v1/dictionaries/${encodeURIComponent(lang)}/entries?${params}`)
    )
    assertLanguage(decoded.resource.language, lang)
    return {
      entries: [...decoded.entries],
      ...(decoded.nextCursor ? { nextCursor: decoded.nextCursor } : {}),
    }
  }
}

export const unavailableHttpDictionaryAccess: DictionaryAccess = {
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
  listByLetterPage: async () => {
    throw new ResourceAccessError('RESOURCE_UNSUPPORTED', ['acquire-offline-copy'])
  },
  searchPage: async () => {
    throw new ResourceAccessError('RESOURCE_UNSUPPORTED', ['acquire-offline-copy'])
  },
  loadItem: async () => {
    throw new ResourceAccessError('RESOURCE_UNSUPPORTED', ['acquire-offline-copy'])
  },
  loadItems: async () => {
    throw new ResourceAccessError('RESOURCE_UNSUPPORTED', ['acquire-offline-copy'])
  },
  loadItemByRowId: async () => {
    throw new ResourceAccessError('RESOURCE_UNSUPPORTED', ['acquire-offline-copy'])
  },
  loadWordsForVerse: async () => {
    throw new ResourceAccessError('RESOURCE_UNSUPPORTED', ['acquire-offline-copy'])
  },
}

export const createHybridDictionaryAccess = ({
  offline,
  online,
  remotelyReadableLanguages,
  isOnline,
}: {
  offline: DictionaryAccess
  online: DictionaryAccess
  remotelyReadableLanguages: ReadonlySet<ResourceLanguage>
  isOnline: () => Promise<boolean>
}): DictionaryAccess => {
  const availability = async (language: ResourceLanguage) => ({
    local:
      (await offline.getAvailability?.(language)) ??
      ({
        status: 'unavailable',
        reason: 'offline-copy-required',
        recoveries: ['acquire-offline-copy'],
      } as const),
    remotelyReadable: remotelyReadableLanguages.has(language),
  })
  const localFailure = (state: Awaited<ReturnType<typeof availability>>) => {
    if (state.local.status !== 'available' && state.local.reason === 'invalid-offline-copy') {
      return new ResourceAccessError('INVALID_OFFLINE_COPY', [
        'acquire-offline-copy',
        'manage-offline-copies',
      ])
    }
    return new ResourceAccessError('OFFLINE_COPY_REQUIRED', ['acquire-offline-copy'])
  }
  const runSearch = async <T>(
    language: ResourceLanguage,
    localOperation: () => Promise<T>,
    remoteOperation: () => Promise<T>
  ) => {
    const state = await availability(language)
    if (state.remotelyReadable && (await isOnline())) {
      try {
        return await remoteOperation()
      } catch (error) {
        if (
          state.local.status === 'available' &&
          error instanceof ResourceAccessError &&
          (error.code === 'NETWORK_OFFLINE' || error.code === 'TEMPORARY_UNAVAILABLE')
        ) {
          return localOperation()
        }
        throw error
      }
    }
    if (state.local.status === 'available') return localOperation()
    if (!state.remotelyReadable) throw localFailure(state)
    throw new ResourceAccessError('NETWORK_OFFLINE')
  }
  const runRead = async <T>(
    language: ResourceLanguage,
    localOperation: () => Promise<T>,
    remoteOperation: () => Promise<T>
  ) => {
    const state = await availability(language)
    if (state.local.status === 'available') {
      try {
        const local = await localOperation()
        if (local !== undefined) return local
      } catch (error) {
        if (!(error instanceof ResourceAccessError) || error.code !== 'NOT_FOUND') throw error
      }
    }
    if (!state.remotelyReadable) throw localFailure(state)
    return remoteOperation()
  }
  return {
    getAvailability: async language => {
      const state = await availability(language)
      return state.local.status === 'available' || state.remotelyReadable
        ? { status: 'available' }
        : state.local
    },
    listByLetter: (letter, language = 'fr') =>
      runSearch(
        language,
        () => offline.listByLetter(letter, language),
        () => online.listByLetter(letter, language)
      ),
    search: (value, language = 'fr') =>
      runSearch(
        language,
        () => offline.search(value, language),
        () => online.search(value, language)
      ),
    listByLetterPage: (letter, options, language = 'fr') =>
      runSearch(
        language,
        () => offline.listByLetterPage(letter, options, language),
        () => online.listByLetterPage(letter, options, language)
      ),
    searchPage: (value, options, language = 'fr') =>
      runSearch(
        language,
        () => offline.searchPage(value, options, language),
        () => online.searchPage(value, options, language)
      ),
    loadItem: (word, language = 'fr') =>
      runRead(
        language,
        () => offline.loadItem(word, language),
        () => online.loadItem(word, language)
      ),
    loadItems: (words, language = 'fr') =>
      runRead(
        language,
        () => offline.loadItems(words, language),
        () => online.loadItems(words, language)
      ),
    loadItemByRowId: (id, language = 'fr') =>
      runRead(
        language,
        () => offline.loadItemByRowId(id, language),
        () => online.loadItemByRowId(id, language)
      ),
    loadWordsForVerse: (verse, language = 'fr') =>
      runRead(
        language,
        () => offline.loadWordsForVerse(verse, language),
        () => online.loadWordsForVerse(verse, language)
      ),
  }
}
