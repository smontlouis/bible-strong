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
import { getLocalResourceAvailability, offlineResourceRegistry } from './resourceAvailability'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { getDictionaryDbPath, getDictionaryDirectoryDbPath } from '~helpers/databases'
import { openSQLiteDatabase } from '~helpers/sqlite'
import type { ResourceAvailability } from './resourceModel'
import { Schema } from 'effect'
import {
  decodeDictionaryPageCursor,
  decodeDictionaryDirectoryPageCursor,
  encodeDictionaryPageCursor,
  encodeDictionaryDirectoryPageCursor,
  DictionaryCatalogResponseDto,
  DictionaryDirectoryResponseDto,
  DictionaryEntriesBatchResponseDto,
  DictionaryEntriesResponseDto,
  DictionaryEntryResponseDto,
  DictionaryPassageAnchorsResponseDto,
  DictionaryPassageDiscoveryResponseDto,
  DictionaryVerseWordsResponseDto,
} from './dictionaryContract'
import { resolveHybridResourceSource } from './hybridResourcePolicy'

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
export type DictionaryWorkId = string
export type DictionaryWork = Schema.Schema.Type<
  typeof DictionaryCatalogResponseDto
>['dictionaries'][number]
export type DictionaryPageOptions = { limit?: number; cursor?: string; signal?: AbortSignal }
export type DictionaryPage = { entries: DictionarySummary[]; nextCursor?: string }
export type DictionaryDirectoryItem = Schema.Schema.Type<
  typeof DictionaryDirectoryResponseDto
>['items'][number]
export type DictionaryDirectorySource = DictionaryDirectoryItem['sources'][number]
export type DictionaryDirectoryPage = {
  entries: DictionaryDirectoryItem[]
  nextCursor?: string
}
export type DictionaryPassageAnchor = DictionarySummary & {
  evidenceKind: 'source-citation' | 'verse-name' | 'verse-phrase'
}
export type DictionaryPassageDiscoveryEntry = Schema.Schema.Type<
  typeof DictionaryPassageDiscoveryResponseDto
>['entries'][number]

export const KNOWN_DICTIONARY_WORKS: readonly DictionaryWork[] = (
  [
    [
      'westphal',
      'WESTPHAL',
      'fr',
      'Dictionnaire encyclopédique de la Bible',
      'Westphal',
      'Encyclopédie biblique française dirigée par Alexandre Westphal.',
      ['Alexandre Westphal et collaborateurs'],
    ],
    [
      'lelievre',
      'LELIEVRE',
      'fr',
      'Lexique de la Bible',
      'Lelièvre',
      'Lexique concis des notions, institutions et coutumes bibliques.',
      ['Charles Lelièvre'],
    ],
    [
      'bost',
      'BOST',
      'fr',
      'Dictionnaire de la Bible',
      'Bost',
      'Dictionnaire biblique français couvrant personnes, lieux, coutumes et notions bibliques.',
      ['Jean-Augustin Bost'],
    ],
    [
      'calmet',
      'CALMET',
      'fr',
      'Dictionnaire historique et critique de la Bible',
      'Calmet',
      'Dictionnaire historique, géographique, philologique et critique de la Bible.',
      ['Augustin Calmet'],
    ],
    [
      'easton-webster',
      'EASTON_WEBSTER',
      'en',
      'Easton’s Bible Dictionary & Webster’s 1828 Dictionary',
      'Easton + Webster',
      'Easton’s biblical entries supplemented by historical English definitions from Webster’s 1828 Dictionary.',
      ['Matthew George Easton', 'Noah Webster'],
    ],
    [
      'smith',
      'SMITH',
      'en',
      'Smith’s Bible Dictionary',
      'Smith',
      'Historical Bible dictionary covering people, places, institutions and customs.',
      ['William Smith', 'F. N. Peloubet', 'M. A. Peloubet'],
    ],
    [
      'isbe',
      'ISBE',
      'en',
      'International Standard Bible Encyclopedia',
      'ISBE 1915',
      'Extensive historical Bible encyclopedia covering people, places, texts, languages, history and theology.',
      ['James Orr and contributors'],
    ],
    [
      'unfoldingword-translation-words',
      'UNFOLDINGWORD_TW',
      'en',
      'Translation Words',
      'Translation Words',
      'A modern Bible translation lexicon with concise definitions, translation suggestions, related concepts and biblical examples.',
      ['Door43 World Missions Community', 'unfoldingWord contributors'],
    ],
  ] satisfies readonly [string, string, ResourceLanguage, string, string, string, string[]][]
).map(([work, resourceId, language, title, abbreviation, description, authors]) => ({
  resource: {
    kind: 'dictionary' as const,
    work,
    language: language as ResourceLanguage,
    revision: 'catalog',
  },
  resourceId,
  title,
  abbreviation,
  authors,
  description,
  edition: '',
  source: '',
  attribution: '',
  onlineAccess: true,
  offlineDownload: true,
}))

export type DictionaryAccess = {
  listWorks?: (language?: ResourceLanguage) => Promise<DictionaryWork[]>
  getAvailability?: (
    language: ResourceLanguage,
    work?: DictionaryWorkId
  ) => Promise<ResourceAvailability>
  getDirectoryAvailability?: () => Promise<ResourceAvailability>
  listByLetter: (
    letter: string,
    language?: ResourceLanguage,
    work?: DictionaryWorkId
  ) => Promise<DictionarySummary[]>
  search: (
    searchValue: string,
    language?: ResourceLanguage,
    work?: DictionaryWorkId
  ) => Promise<DictionarySummary[]>
  listByLetterPage: (
    letter: string,
    options?: DictionaryPageOptions,
    language?: ResourceLanguage,
    work?: DictionaryWorkId
  ) => Promise<DictionaryPage>
  searchPage: (
    searchValue: string,
    options?: DictionaryPageOptions,
    language?: ResourceLanguage,
    work?: DictionaryWorkId
  ) => Promise<DictionaryPage>
  browseDirectoryPage: (
    initial: string,
    options?: DictionaryPageOptions,
    language?: ResourceLanguage
  ) => Promise<DictionaryDirectoryPage>
  searchDirectoryPage: (
    searchValue: string,
    options?: DictionaryPageOptions,
    language?: ResourceLanguage
  ) => Promise<DictionaryDirectoryPage>
  loadItem: (
    word: string,
    language?: ResourceLanguage,
    work?: DictionaryWorkId
  ) => Promise<DictionaryEntry | undefined>
  loadEntryById: (
    id: number,
    language?: ResourceLanguage,
    work?: DictionaryWorkId
  ) => Promise<DictionaryEntry | undefined>
  loadItems: (
    words: readonly string[],
    language?: ResourceLanguage,
    work?: DictionaryWorkId
  ) => Promise<DictionaryEntry[]>
  loadItemByRowId: (
    id: number | string,
    language?: ResourceLanguage,
    work?: DictionaryWorkId
  ) => Promise<DictionaryWordReference | undefined>
  loadWordsForVerse: (
    verseId: string,
    language?: ResourceLanguage,
    work?: DictionaryWorkId
  ) => Promise<string[]>
  loadPassageAnchors: (
    verseId: string,
    language?: ResourceLanguage,
    work?: DictionaryWorkId
  ) => Promise<DictionaryPassageAnchor[]>
  discoverPassageEntries: (
    verseId: string,
    language?: ResourceLanguage
  ) => Promise<DictionaryPassageDiscoveryEntry[]>
}

export const getDefaultDictionaryWork = (language: ResourceLanguage): DictionaryWorkId =>
  language === 'en' ? 'easton-webster' : 'westphal'

const getDictionaryResource = (work: DictionaryWorkId, language: ResourceLanguage) =>
  [...offlineResourceRegistry.getSnapshot().resources.values()].find(
    entry =>
      entry.resource.kind === 'dictionary' &&
      entry.resource.work === work &&
      entry.resource.language === language
  )?.resource

const withInstalledDictionary = async <T>(
  work: DictionaryWorkId,
  language: ResourceLanguage,
  query: (database: Awaited<ReturnType<typeof openSQLiteDatabase>>) => Promise<T>
): Promise<T> => {
  const resource = getDictionaryResource(work, language)
  const availability = resource
    ? await offlineResourceRegistry.getAvailability(resource)
    : undefined
  if (availability?.status !== 'available') {
    throw new ResourceAccessError('OFFLINE_COPY_REQUIRED', ['acquire-offline-copy'])
  }
  const databasePath = getDictionaryDbPath(work, language)
  const fileName = databasePath.split('/').pop()!
  const directory = databasePath.slice(0, -(fileName.length + 1))
  const database = await openSQLiteDatabase(fileName, { useNewConnection: true }, directory)
  try {
    return await query(database)
  } finally {
    await database.closeAsync()
  }
}

const dictionaryDirectoryIdentity = { kind: 'dictionary-directory' as const }

const withInstalledDictionaryDirectory = async <T>(
  query: (database: Awaited<ReturnType<typeof openSQLiteDatabase>>) => Promise<T>
): Promise<T> => {
  const availability = await offlineResourceRegistry.getAvailability(dictionaryDirectoryIdentity)
  if (availability.status !== 'available') {
    throw new ResourceAccessError('OFFLINE_COPY_REQUIRED', ['acquire-offline-copy'])
  }
  const databasePath = getDictionaryDirectoryDbPath()
  const fileName = databasePath.split('/').pop()!
  const directory = databasePath.slice(0, -(fileName.length + 1))
  const database = await openSQLiteDatabase(fileName, { useNewConnection: true }, directory)
  try {
    return await query(database)
  } finally {
    await database.closeAsync()
  }
}

const getInstalledDictionaryEntries = () =>
  [...offlineResourceRegistry.getSnapshot().resources.values()].filter(
    entry => entry.resource.kind === 'dictionary' && entry.availability.status === 'available'
  )

const isLegacyDictionaryWork = (language: ResourceLanguage, work?: DictionaryWorkId) => {
  const resolvedWork = work ?? getDefaultDictionaryWork(language)
  return (
    resolvedWork === getDefaultDictionaryWork(language) &&
    getDictionaryResource(resolvedWork, language) === undefined
  )
}

export const localDictionaryAccess: DictionaryAccess = {
  listWorks: async language =>
    KNOWN_DICTIONARY_WORKS.filter(work => !language || work.resource.language === language),
  getAvailability: async (language, work) => {
    if (!isLegacyDictionaryWork(language, work)) {
      const resource = getDictionaryResource(work!, language)
      const availability = resource
        ? await offlineResourceRegistry.getAvailability(resource)
        : undefined
      return availability?.status === 'available'
        ? { status: 'available' }
        : {
            status: 'unavailable',
            reason: 'offline-copy-required',
            recoveries: ['acquire-offline-copy'],
          }
    }
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
  getDirectoryAvailability: async () => {
    const availability = await offlineResourceRegistry.getAvailability(dictionaryDirectoryIdentity)
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
  listByLetter: async (letter, language = 'fr', work) =>
    (await localDictionaryAccess.listByLetterPage(letter, { limit: 50 }, language, work)).entries,
  search: async (searchValue, language = 'fr', work) =>
    (await localDictionaryAccess.searchPage(searchValue, { limit: 50 }, language, work)).entries,
  listByLetterPage: async (letter, options = {}, language = 'fr', work) => {
    const limit = options.limit ?? 50
    if (!isLegacyDictionaryWork(language, work)) {
      const cursor = options.cursor ? decodeDictionaryPageCursor(options.cursor) : undefined
      const rows = await withInstalledDictionary(work!, language, database =>
        database.getAllAsync<{ id: number; word: string; sanitized_word: string }>(
          `SELECT id, word, sanitized_word FROM dictionnaire
           WHERE sanitized_word >= ? AND sanitized_word < ?
             AND (? IS NULL OR sanitized_word > ? OR (sanitized_word = ? AND id > ?))
           ORDER BY sanitized_word, id LIMIT ?`,
          letter,
          `${letter}\uffff`,
          cursor?.[0] ?? null,
          cursor?.[0] ?? '',
          cursor?.[0] ?? '',
          cursor?.[1] ?? 0,
          limit + 1
        )
      )
      const pageRows = rows.slice(0, limit)
      return {
        entries: pageRows.map(row => ({
          id: row.id,
          word: row.word,
          normalizedWord: row.sanitized_word,
        })),
        ...(rows.length > limit && pageRows.length
          ? {
              nextCursor: encodeDictionaryPageCursor([
                pageRows.at(-1)!.sanitized_word,
                pageRows.at(-1)!.id,
              ]),
            }
          : {}),
      }
    }
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
  searchPage: async (searchValue, options = {}, language = 'fr', work) => {
    const limit = options.limit ?? 50
    if (!isLegacyDictionaryWork(language, work)) {
      const cursor = options.cursor ? decodeDictionaryPageCursor(options.cursor) : undefined
      const rows = await withInstalledDictionary(work!, language, database =>
        database.getAllAsync<{ id: number; word: string; sanitized_word: string }>(
          `SELECT id, word, sanitized_word FROM dictionnaire
           WHERE (word LIKE ? OR sanitized_word LIKE ?)
             AND (? IS NULL OR sanitized_word > ? OR (sanitized_word = ? AND id > ?))
           ORDER BY sanitized_word, id LIMIT ?`,
          `%${searchValue}%`,
          `%${searchValue.toLocaleLowerCase()}%`,
          cursor?.[0] ?? null,
          cursor?.[0] ?? '',
          cursor?.[0] ?? '',
          cursor?.[1] ?? 0,
          limit + 1
        )
      )
      const pageRows = rows.slice(0, limit)
      return {
        entries: pageRows.map(row => ({
          id: row.id,
          word: row.word,
          normalizedWord: row.sanitized_word,
        })),
        ...(rows.length > limit && pageRows.length
          ? {
              nextCursor: encodeDictionaryPageCursor([
                pageRows.at(-1)!.sanitized_word,
                pageRows.at(-1)!.id,
              ]),
            }
          : {}),
      }
    }
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
  browseDirectoryPage: (initial, options = {}, language = 'fr') =>
    loadLocalDirectoryPage({ initial, options, language }),
  searchDirectoryPage: (search, options = {}, language = 'fr') =>
    loadLocalDirectoryPage({ search, options, language }),
  loadItem: async (word, language = 'fr', work) => {
    if (!isLegacyDictionaryWork(language, work)) {
      return withInstalledDictionary(work!, language, database =>
        database.getFirstAsync<DictionaryEntry>(
          `SELECT id, word, definition FROM dictionnaire
           WHERE word = ? COLLATE NOCASE OR sanitized_word = ?
           ORDER BY id LIMIT 1`,
          word,
          word.trim().toLocaleLowerCase()
        )
      ).then(entry => entry ?? undefined)
    }
    try {
      return await loadDictionnaireItem(word)
    } catch (error) {
      throw mapLocalResourceError(error)
    }
  },
  loadEntryById: async (id, language = 'fr', work) => {
    if (!isLegacyDictionaryWork(language, work)) {
      return withInstalledDictionary(work!, language, database =>
        database.getFirstAsync<DictionaryEntry>(
          'SELECT id, word, definition FROM dictionnaire WHERE id = ?',
          id
        )
      ).then(entry => entry ?? undefined)
    }
    const reference = unwrapLocalResourceResult(await loadDictionnaireItemByRowId(id))
    return reference ? localDictionaryAccess.loadItem(reference.word, language, work) : undefined
  },
  loadItems: async (words, language = 'fr', work) => {
    if (!isLegacyDictionaryWork(language, work)) {
      const normalized = [...new Set(words.map(word => word.trim().toLocaleLowerCase()))]
      if (normalized.length === 0) return []
      const placeholders = normalized.map(() => '?').join(',')
      return withInstalledDictionary(work!, language, database =>
        database.getAllAsync<DictionaryEntry>(
          `SELECT id, word, definition FROM dictionnaire
           WHERE sanitized_word IN (${placeholders}) ORDER BY id`,
          ...normalized
        )
      )
    }
    return (await loadDictionnaireItems(words)).map(({ word, definition }) => ({
      word,
      definition,
    }))
  },
  loadItemByRowId: async (id, language = 'fr', work) => {
    if (!isLegacyDictionaryWork(language, work)) {
      return withInstalledDictionary(work!, language, database =>
        database.getFirstAsync<DictionaryWordReference>(
          'SELECT word FROM dictionnaire WHERE id = ?',
          Number(id)
        )
      ).then(entry => entry ?? undefined)
    }
    return unwrapLocalResourceResult(await loadDictionnaireItemByRowId(id))
  },
  loadWordsForVerse: async (verseId, language = 'fr', work) => {
    if (!isLegacyDictionaryWork(language, work)) {
      const row = await withInstalledDictionary(work!, language, database =>
        database.getFirstAsync<{ ref: string }>('SELECT ref FROM verses WHERE id = ?', verseId)
      )
      if (!row) return []
      const words: unknown = JSON.parse(row.ref)
      if (!Array.isArray(words) || words.some(word => typeof word !== 'string')) {
        throw new ResourceAccessError('INTEGRITY_FAILURE')
      }
      return words
    }
    try {
      return await loadDictionnaireWords(verseId)
    } catch (error) {
      throw mapLocalResourceError(error)
    }
  },
  loadPassageAnchors: async (verseId, language = 'fr', work) => {
    if (isLegacyDictionaryWork(language, work)) return []
    return withInstalledDictionary(work!, language, database =>
      database.getAllAsync<{
        id: number
        word: string
        sanitized_word: string
        evidence_kind: 'source-citation' | 'verse-name' | 'verse-phrase'
      }>(
        `SELECT entry.id, entry.word, entry.sanitized_word, anchor.evidence_kind
         FROM dictionary_passage_anchors anchor
         JOIN dictionnaire entry ON entry.id = anchor.entry_id
         WHERE anchor.verse_key = ?
         ORDER BY anchor.ordinal, entry.id`,
        verseId
      )
    ).then(rows =>
      rows.map(row => ({
        id: row.id,
        word: row.word,
        normalizedWord: row.sanitized_word,
        evidenceKind: row.evidence_kind,
      }))
    )
  },
  discoverPassageEntries: async (verseId, language = 'fr') => {
    const installed = getInstalledDictionaryEntries().filter(
      entry => entry.resource.kind === 'dictionary' && entry.resource.language === language
    )
    if (installed.length === 0) return []
    const installedByWork = new Map(
      installed.flatMap(entry =>
        entry.resource.kind === 'dictionary' ? [[entry.resource.work, entry] as const] : []
      )
    )
    const works = [...installedByWork.keys()]
    const placeholders = works.map(() => '?').join(',')
    const rows = await withInstalledDictionaryDirectory(database =>
      database.getAllAsync<{
        work: string
        resource_id: string
        language: ResourceLanguage
        title: string
        abbreviation: string
        entry_id: number
        word: string
        normalized_word: string
        evidence_kind: 'source-citation' | 'verse-name' | 'verse-phrase'
        correspondence_id: string | null
      }>(
        `SELECT work.work, work.resource_id, work.language, work.title, work.abbreviation,
                entry.entry_id, entry.word, entry.normalized_word, evidence.evidence_kind,
                correspondence.correspondence_id
         FROM dictionary_passage_anchors anchor
         JOIN dictionary_works work ON work.work_key = anchor.work_key
         JOIN dictionary_entries entry
           ON entry.work_key = anchor.work_key AND entry.entry_id = anchor.entry_id
         JOIN dictionary_anchor_evidence evidence ON evidence.evidence_key = anchor.evidence_key
         LEFT JOIN dictionary_correspondence_members member
           ON member.work_key = entry.work_key AND member.entry_id = entry.entry_id
         LEFT JOIN dictionary_correspondences correspondence
           ON correspondence.correspondence_key = member.correspondence_key
         WHERE anchor.verse_key = ? AND work.language = ? AND work.work IN (${placeholders})
         ORDER BY work.work_key, anchor.ordinal, entry.entry_id`,
        verseId,
        language,
        ...works
      )
    )
    return rows.map(row => {
      const registryEntry = installedByWork.get(row.work)!
      return {
        resource: {
          kind: 'dictionary' as const,
          work: row.work,
          language: row.language,
          revision: registryEntry.installedRevision ?? registryEntry.catalogRevision ?? 'offline',
        },
        resourceId: row.resource_id,
        title: row.title,
        abbreviation: row.abbreviation,
        id: row.entry_id,
        word: row.word,
        normalizedWord: row.normalized_word,
        evidenceKind: row.evidence_kind,
        ...(row.correspondence_id ? { correspondenceId: row.correspondence_id } : {}),
      }
    })
  },
}

const loadLocalDirectoryPage = async ({
  initial,
  search,
  options,
  language,
}: {
  initial?: string
  search?: string
  options: DictionaryPageOptions
  language: ResourceLanguage
}): Promise<DictionaryDirectoryPage> => {
  const installed = getInstalledDictionaryEntries()
  if (installed.length === 0) return { entries: [] }
  const installedByWork = new Map(
    installed.flatMap(entry =>
      entry.resource.kind === 'dictionary' ? [[entry.resource.work, entry] as const] : []
    )
  )
  const works = [...installedByWork.keys()]
  const workPlaceholders = works.map(() => '?').join(',')
  const limit = options.limit ?? 50
  const cursor = options.cursor ? decodeDictionaryDirectoryPageCursor(options.cursor) : undefined
  const normalizedInitial = initial?.trim().toLocaleLowerCase()
  const normalizedSearch = search?.trim().toLocaleLowerCase()
  const rows = await withInstalledDictionaryDirectory(database =>
    database.getAllAsync<{
      group_key: string
      label: string
      normalized_label: string
      correspondence_id: string | null
      work: string
      resource_id: string
      language: ResourceLanguage
      title: string
      abbreviation: string
      entry_id: number
      word: string
      normalized_word: string
    }>(
      `WITH installed_entries AS (
         SELECT CASE
                  WHEN correspondence.correspondence_id IS NOT NULL
                    THEN 'c:' || correspondence.correspondence_id
                  ELSE 'e:' || entry.work_key || ':' || entry.entry_id
                END AS group_key,
                correspondence.correspondence_id,
                work.work, work.resource_id, work.language, work.title, work.abbreviation,
                entry.entry_id, entry.word, entry.normalized_word
         FROM dictionary_entries entry
         JOIN dictionary_works work ON work.work_key = entry.work_key
         LEFT JOIN dictionary_correspondence_members member
           ON member.work_key = entry.work_key AND member.entry_id = entry.entry_id
         LEFT JOIN dictionary_correspondences correspondence
           ON correspondence.correspondence_key = member.correspondence_key
         WHERE work.work IN (${workPlaceholders})
       ), directory_keys AS (
         SELECT candidate.group_key, MAX(candidate.correspondence_id) AS correspondence_id,
                (SELECT localized.word FROM installed_entries localized
                 WHERE localized.group_key = candidate.group_key AND localized.language = ?
                 ORDER BY localized.normalized_word, localized.work, localized.entry_id LIMIT 1) AS label,
                (SELECT localized.normalized_word FROM installed_entries localized
                 WHERE localized.group_key = candidate.group_key AND localized.language = ?
                 ORDER BY localized.normalized_word, localized.work, localized.entry_id LIMIT 1) AS normalized_label
         FROM installed_entries candidate
         GROUP BY candidate.group_key
         HAVING SUM(CASE WHEN candidate.language = ? THEN 1 ELSE 0 END) > 0
       ), page_keys AS (
         SELECT group_key, correspondence_id, label, normalized_label
         FROM directory_keys
         WHERE (? IS NULL OR normalized_label LIKE ?)
           AND (? IS NULL OR lower(label) LIKE ? OR normalized_label LIKE ?)
           AND (? IS NULL OR normalized_label > ? OR (normalized_label = ? AND group_key > ?))
         ORDER BY normalized_label, group_key
         LIMIT ?
       )
       SELECT key.group_key, key.label, key.normalized_label, key.correspondence_id,
              entry.work, entry.resource_id, entry.language, entry.title, entry.abbreviation,
              entry.entry_id, entry.word, entry.normalized_word
       FROM page_keys key
       JOIN installed_entries entry ON entry.group_key = key.group_key
       ORDER BY key.normalized_label, key.group_key, entry.language, entry.work, entry.entry_id`,
      ...works,
      language,
      language,
      language,
      normalizedInitial ?? null,
      normalizedInitial ? `${normalizedInitial}%` : null,
      normalizedSearch ?? null,
      normalizedSearch ? `%${normalizedSearch}%` : null,
      normalizedSearch ? `%${normalizedSearch}%` : null,
      cursor?.[0] ?? null,
      cursor?.[0] ?? null,
      cursor?.[0] ?? null,
      cursor?.[1] ?? null,
      limit + 1
    )
  )
  const grouped = new Map<string, DictionaryDirectoryItem>()
  for (const row of rows) {
    const registryEntry = installedByWork.get(row.work)
    if (!registryEntry) continue
    const source = {
      resource: {
        kind: 'dictionary' as const,
        work: row.work,
        language: row.language,
        revision: registryEntry.installedRevision ?? registryEntry.catalogRevision ?? 'offline',
      },
      resourceId: row.resource_id,
      title: row.title,
      abbreviation: row.abbreviation,
      id: row.entry_id,
      word: row.word,
      normalizedWord: row.normalized_word,
    }
    const existing = grouped.get(row.group_key)
    if (existing)
      grouped.set(row.group_key, { ...existing, sources: [...existing.sources, source] })
    else {
      grouped.set(row.group_key, {
        key: row.group_key,
        label: row.label,
        normalizedLabel: row.normalized_label,
        ...(row.correspondence_id ? { correspondenceId: row.correspondence_id } : {}),
        sources: [source],
      })
    }
  }
  const groups = [...grouped.values()]
  const page = groups.slice(0, limit)
  const last = page.at(-1)
  return {
    entries: page,
    ...(groups.length > limit && last
      ? { nextCursor: encodeDictionaryDirectoryPageCursor([last.normalizedLabel, last.key]) }
      : {}),
  }
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
  const request = async (path: string, signal?: AbortSignal): Promise<unknown> => {
    const controller = new AbortController()
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) controller.abort()
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
      if (signal?.aborted) throw error
      if (error instanceof ResourceAccessError) throw error
      throw new ResourceAccessError(
        (await isOnline()) ? 'TEMPORARY_UNAVAILABLE' : 'NETWORK_OFFLINE'
      )
    } finally {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
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
  const workOrDefault = (work: DictionaryWorkId | undefined, language: ResourceLanguage) =>
    work ?? getDefaultDictionaryWork(language)
  const assertResource = (
    actual: { language: ResourceLanguage; work: string },
    language: ResourceLanguage,
    work: string
  ) => {
    assertLanguage(actual.language, language)
    if (actual.work !== work) throw new ResourceAccessError('INTEGRITY_FAILURE')
  }

  return {
    listWorks: async language => {
      const params = language ? `?${new URLSearchParams({ language })}` : ''
      const decoded = decode(
        DictionaryCatalogResponseDto,
        await request(`/v1/dictionaries${params}`)
      )
      return [...decoded.dictionaries]
    },
    getAvailability: async language =>
      language === 'fr' || language === 'en'
        ? { status: 'available' }
        : {
            status: 'unavailable',
            reason: 'offline-copy-required',
            recoveries: ['acquire-offline-copy'],
          },
    getDirectoryAvailability: async () => ({ status: 'available' }),
    listByLetter: async (letter, language, work) => {
      return (await createPageRequest({ initial: letter, language, work })).entries
    },
    search: async (searchValue, language, work) => {
      return (await createPageRequest({ search: searchValue, language, work })).entries
    },
    listByLetterPage: (letter, options, language, work) =>
      createPageRequest({ initial: letter, language, work, ...options }),
    searchPage: (search, options, language, work) =>
      createPageRequest({ search, language, work, ...options }),
    browseDirectoryPage: (initial, options, language) =>
      createDirectoryPageRequest({ initial, language, ...options }),
    searchDirectoryPage: (search, options, language) =>
      createDirectoryPageRequest({ search, language, ...options }),
    loadItem: async (word, language, selectedWork) => {
      const lang = languageOrFrench(language)
      const work = workOrDefault(selectedWork, lang)
      try {
        const payload = await request(
          `/v1/dictionaries/${encodeURIComponent(work)}/${encodeURIComponent(lang)}/entries/${encodeURIComponent(word)}`
        )
        const decoded = decode(DictionaryEntryResponseDto, payload)
        assertResource(decoded.resource, lang, work)
        if (decoded.entry.word.length === 0) throw new ResourceAccessError('INTEGRITY_FAILURE')
        return decoded.entry
      } catch (error) {
        if (error instanceof ResourceAccessError && error.code === 'NOT_FOUND') return undefined
        throw error
      }
    },
    loadEntryById: async (id, language, selectedWork) => {
      const lang = languageOrFrench(language)
      const work = workOrDefault(selectedWork, lang)
      try {
        const decoded = decode(
          DictionaryEntryResponseDto,
          await request(
            `/v1/dictionaries/${encodeURIComponent(work)}/${encodeURIComponent(lang)}/entries/by-id/${encodeURIComponent(String(id))}`
          )
        )
        assertResource(decoded.resource, lang, work)
        return decoded.entry
      } catch (error) {
        if (error instanceof ResourceAccessError && error.code === 'NOT_FOUND') return undefined
        throw error
      }
    },
    loadItems: async (words, language, selectedWork) => {
      if (words.length === 0) return []
      const lang = languageOrFrench(language)
      const work = workOrDefault(selectedWork, lang)
      const normalized = [...new Set(words.map(word => word.trim().toLocaleLowerCase()))]
      const params = new URLSearchParams({ words: normalized.join(',') })
      const decoded = decode(
        DictionaryEntriesBatchResponseDto,
        await request(
          `/v1/dictionaries/${encodeURIComponent(work)}/${encodeURIComponent(lang)}/entries/batch?${params}`
        )
      )
      assertResource(decoded.resource, lang, work)
      return [...decoded.entries]
    },
    loadItemByRowId: async (id, language, selectedWork) => {
      const lang = languageOrFrench(language)
      const work = workOrDefault(selectedWork, lang)
      try {
        const payload = await request(
          `/v1/dictionaries/${encodeURIComponent(work)}/${encodeURIComponent(lang)}/entries/by-id/${encodeURIComponent(String(id))}`
        )
        const decoded = decode(DictionaryEntryResponseDto, payload)
        assertResource(decoded.resource, lang, work)
        return { word: decoded.entry.word }
      } catch (error) {
        if (error instanceof ResourceAccessError && error.code === 'NOT_FOUND') return undefined
        throw error
      }
    },
    loadWordsForVerse: async (verseId, language, selectedWork) => {
      const lang = languageOrFrench(language)
      const work = workOrDefault(selectedWork, lang)
      const payload = await request(
        `/v1/dictionaries/${encodeURIComponent(work)}/${encodeURIComponent(lang)}/verses/${encodeURIComponent(verseId)}/words`
      )
      const decoded = decode(DictionaryVerseWordsResponseDto, payload)
      assertResource(decoded.resource, lang, work)
      if (decoded.verseKey !== verseId) throw new ResourceAccessError('INTEGRITY_FAILURE')
      return [...decoded.words]
    },
    loadPassageAnchors: async (verseId, language, selectedWork) => {
      const lang = languageOrFrench(language)
      const work = workOrDefault(selectedWork, lang)
      const payload = await request(
        `/v1/dictionaries/${encodeURIComponent(work)}/${encodeURIComponent(lang)}/verses/${encodeURIComponent(verseId)}/entries`
      )
      const decoded = decode(DictionaryPassageAnchorsResponseDto, payload)
      assertResource(decoded.resource, lang, work)
      if (decoded.verseKey !== verseId) throw new ResourceAccessError('INTEGRITY_FAILURE')
      return [...decoded.entries]
    },
    discoverPassageEntries: async (verseId, language) => {
      const params = language ? `?${new URLSearchParams({ language })}` : ''
      const decoded = decode(
        DictionaryPassageDiscoveryResponseDto,
        await request(`/v1/dictionaries/verses/${encodeURIComponent(verseId)}/entries${params}`)
      )
      if (decoded.verseKey !== verseId) throw new ResourceAccessError('INTEGRITY_FAILURE')
      return [...decoded.entries]
    },
  }

  async function createPageRequest({
    initial,
    search,
    language,
    work,
    limit = 50,
    cursor,
    signal,
  }: {
    initial?: string
    search?: string
    language?: ResourceLanguage
    work?: DictionaryWorkId
    limit?: number
    cursor?: string
    signal?: AbortSignal
  }): Promise<DictionaryPage> {
    const lang = languageOrFrench(language)
    const selectedWork = workOrDefault(work, lang)
    const params = new URLSearchParams({
      ...(initial ? { initial } : {}),
      ...(search ? { search } : {}),
      limit: String(limit),
      ...(cursor ? { cursor } : {}),
    })
    const decoded = decode(
      DictionaryEntriesResponseDto,
      await request(
        `/v1/dictionaries/${encodeURIComponent(selectedWork)}/${encodeURIComponent(lang)}/entries?${params}`,
        signal
      )
    )
    assertResource(decoded.resource, lang, selectedWork)
    return {
      entries: [...decoded.entries],
      ...(decoded.nextCursor ? { nextCursor: decoded.nextCursor } : {}),
    }
  }

  async function createDirectoryPageRequest({
    initial,
    search,
    language = 'fr',
    limit = 50,
    cursor,
    signal,
  }: {
    initial?: string
    search?: string
    language?: ResourceLanguage
    limit?: number
    cursor?: string
    signal?: AbortSignal
  }): Promise<DictionaryDirectoryPage> {
    const params = new URLSearchParams({
      language,
      ...(initial ? { initial } : {}),
      ...(search ? { search } : {}),
      limit: String(limit),
      ...(cursor ? { cursor } : {}),
    })
    const decoded = decode(
      DictionaryDirectoryResponseDto,
      await request(`/v1/dictionaries/directory?${params}`, signal)
    )
    assertLanguage(decoded.language, language)
    return {
      entries: [...decoded.items],
      ...(decoded.nextCursor ? { nextCursor: decoded.nextCursor } : {}),
    }
  }
}

export const unavailableHttpDictionaryAccess: DictionaryAccess = {
  listWorks: async () => [],
  getAvailability: async () => ({
    status: 'unavailable',
    reason: 'offline-copy-required',
    recoveries: ['acquire-offline-copy'],
  }),
  getDirectoryAvailability: async () => ({
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
  browseDirectoryPage: async () => {
    throw new ResourceAccessError('RESOURCE_UNSUPPORTED')
  },
  searchDirectoryPage: async () => {
    throw new ResourceAccessError('RESOURCE_UNSUPPORTED')
  },
  loadItem: async () => {
    throw new ResourceAccessError('RESOURCE_UNSUPPORTED', ['acquire-offline-copy'])
  },
  loadEntryById: async () => {
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
  loadPassageAnchors: async () => {
    throw new ResourceAccessError('RESOURCE_UNSUPPORTED', ['acquire-offline-copy'])
  },
  discoverPassageEntries: async () => {
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
  const availability = async (language: ResourceLanguage, work?: DictionaryWorkId) => ({
    local:
      (await offline.getAvailability?.(language, work)) ??
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
  const directoryAvailability = async () =>
    (await offline.getDirectoryAvailability?.()) ??
    ({
      status: 'unavailable',
      reason: 'offline-copy-required',
      recoveries: ['acquire-offline-copy'],
    } as const)
  const runDirectorySearch = async <T>(
    localOperation: () => Promise<T>,
    remoteOperation: () => Promise<T>
  ): Promise<T> => {
    const local = await directoryAvailability()
    if (await isOnline()) {
      try {
        return await remoteOperation()
      } catch (error) {
        if (
          local.status === 'available' &&
          error instanceof ResourceAccessError &&
          (error.code === 'NETWORK_OFFLINE' || error.code === 'TEMPORARY_UNAVAILABLE')
        ) {
          return localOperation()
        }
        throw error
      }
    }
    if (local.status === 'available') return localOperation()
    if (local.reason === 'invalid-offline-copy') {
      throw new ResourceAccessError('INVALID_OFFLINE_COPY', [
        'acquire-offline-copy',
        'manage-offline-copies',
      ])
    }
    throw new ResourceAccessError('NETWORK_OFFLINE')
  }
  const runSearch = async <T>(
    language: ResourceLanguage,
    work: DictionaryWorkId | undefined,
    localOperation: () => Promise<T>,
    remoteOperation: () => Promise<T>
  ) => {
    const state = await availability(language, work)
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
    work: DictionaryWorkId | undefined,
    localOperation: () => Promise<T>,
    remoteOperation: () => Promise<T>
  ) => {
    const state = await availability(language, work)
    if (state.local.status === 'available') {
      try {
        return await localOperation()
      } catch (error) {
        if (
          !(error instanceof ResourceAccessError) ||
          (error.code !== 'NOT_FOUND' && error.code !== 'RESOURCE_UNSUPPORTED')
        )
          throw error
      }
    }
    const source = await resolveHybridResourceSource({
      localAvailable: false,
      remotelyReadable: state.remotelyReadable,
      isOnline,
    })
    if (source === 'remote') return remoteOperation()
    if (source === 'offline') throw new ResourceAccessError('NETWORK_OFFLINE')
    throw localFailure(state)
  }
  return {
    listWorks: async language => {
      if (await isOnline()) {
        try {
          return (await online.listWorks?.(language)) ?? []
        } catch (error) {
          if (
            !(error instanceof ResourceAccessError) ||
            (error.code !== 'NETWORK_OFFLINE' && error.code !== 'TEMPORARY_UNAVAILABLE')
          ) {
            throw error
          }
        }
      }
      return (await offline.listWorks?.(language)) ?? []
    },
    getAvailability: async (language, work) => {
      const state = await availability(language, work)
      if (state.local.status === 'available') return { status: 'available' }
      if (state.local.reason === 'invalid-offline-copy') return state.local
      if (!state.remotelyReadable) return state.local
      return (await isOnline())
        ? { status: 'available' }
        : {
            status: 'unavailable',
            reason: 'network-offline',
            recoveries: ['retry'],
          }
    },
    getDirectoryAvailability: directoryAvailability,
    listByLetter: (letter, language = 'fr', work) =>
      runSearch(
        language,
        work,
        () => offline.listByLetter(letter, language, work),
        () => online.listByLetter(letter, language, work)
      ),
    search: (value, language = 'fr', work) =>
      runSearch(
        language,
        work,
        () => offline.search(value, language, work),
        () => online.search(value, language, work)
      ),
    listByLetterPage: (letter, options, language = 'fr', work) =>
      runSearch(
        language,
        work,
        () => offline.listByLetterPage(letter, options, language, work),
        () => online.listByLetterPage(letter, options, language, work)
      ),
    searchPage: (value, options, language = 'fr', work) =>
      runSearch(
        language,
        work,
        () => offline.searchPage(value, options, language, work),
        () => online.searchPage(value, options, language, work)
      ),
    browseDirectoryPage: (initial, options, language = 'fr') =>
      runDirectorySearch(
        () => offline.browseDirectoryPage(initial, options, language),
        () => online.browseDirectoryPage(initial, options, language)
      ),
    searchDirectoryPage: (value, options, language = 'fr') =>
      runDirectorySearch(
        () => offline.searchDirectoryPage(value, options, language),
        () => online.searchDirectoryPage(value, options, language)
      ),
    loadItem: (word, language = 'fr', work) =>
      runRead(
        language,
        work,
        () => offline.loadItem(word, language, work),
        () => online.loadItem(word, language, work)
      ),
    loadEntryById: (id, language = 'fr', work) =>
      runRead(
        language,
        work,
        () => offline.loadEntryById(id, language, work),
        () => online.loadEntryById(id, language, work)
      ),
    loadItems: (words, language = 'fr', work) =>
      runRead(
        language,
        work,
        () => offline.loadItems(words, language, work),
        () => online.loadItems(words, language, work)
      ),
    loadItemByRowId: (id, language = 'fr', work) =>
      runRead(
        language,
        work,
        () => offline.loadItemByRowId(id, language, work),
        () => online.loadItemByRowId(id, language, work)
      ),
    loadWordsForVerse: (verse, language = 'fr', work) =>
      runRead(
        language,
        work,
        () => offline.loadWordsForVerse(verse, language, work),
        () => online.loadWordsForVerse(verse, language, work)
      ),
    loadPassageAnchors: (verse, language = 'fr', work) =>
      runRead(
        language,
        work,
        () => offline.loadPassageAnchors(verse, language, work),
        () => online.loadPassageAnchors(verse, language, work)
      ),
    discoverPassageEntries: async (verse, language = 'fr') => {
      if (remotelyReadableLanguages.has(language) && (await isOnline())) {
        try {
          return await online.discoverPassageEntries(verse, language)
        } catch (error) {
          if (
            !(error instanceof ResourceAccessError) ||
            (error.code !== 'NETWORK_OFFLINE' && error.code !== 'TEMPORARY_UNAVAILABLE')
          ) {
            throw error
          }
        }
      }
      return offline.discoverPassageEntries(verse, language)
    },
  }
}
