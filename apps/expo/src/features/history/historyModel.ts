import type { ResourceLanguage } from '~helpers/databaseTypes'
import { getHistoryStrongReference } from '~helpers/historyStrongReference'

export const HISTORY_SCHEMA_VERSION = 2 as const
export const MAX_HISTORY_ITEMS = 50

type BaseHistoryItem = {
  id: string
  schemaVersion: typeof HISTORY_SCHEMA_VERSION
  date: number
}

export type HistoryStrongItem = BaseHistoryItem & {
  type: 'strong'
  Hebreu: string
  Grec: string
  Mot: string
  book: number
  reference?: string
  Code?: string | number
}

export type HistoryVerseItem = BaseHistoryItem & {
  type: 'verse'
  book: string | number
  chapter: string | number
  verse: string | number
  version: string
}

export type HistoryWordItem = BaseHistoryItem & {
  type: 'word'
  word: string
  entryId?: number
  correspondenceId?: string
  work?: string
  resourceId?: string
  dictionaryTitle?: string
  language?: ResourceLanguage
}

export type HistoryNaveItem = BaseHistoryItem & {
  type: 'nave'
  name: string
  name_lower: string
}

export type HistoryItem = HistoryStrongItem | HistoryVerseItem | HistoryWordItem | HistoryNaveItem

type WithoutHistoryMetadata<T> = T extends HistoryItem ? Omit<T, 'id' | 'schemaVersion'> : never

export type HistoryItemInput = WithoutHistoryMetadata<HistoryItem>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined

const optionalNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

const optionalLanguage = (value: unknown): ResourceLanguage | undefined =>
  value === 'fr' || value === 'en' ? value : undefined

const isPositiveInteger = (value: number): boolean => Number.isInteger(value) && value > 0

export const getHistoryItemKey = (item: HistoryItem | HistoryItemInput): string => {
  switch (item.type) {
    case 'verse':
      return `verse:${Number(item.book)}:${Number(item.chapter)}:${Number(item.verse)}:${item.version}`
    case 'strong': {
      const reference = getHistoryStrongReference(item)
      return reference
        ? `strong:${reference}`
        : `strong:${item.book}:${item.Mot.trim().toLocaleLowerCase()}`
    }
    case 'word': {
      const resource = item.resourceId ?? item.work ?? 'legacy'
      const language = item.language ?? 'legacy'
      const entry = item.entryId ?? item.correspondenceId ?? item.word.trim().toLocaleLowerCase()
      return `word:${resource}:${language}:${entry}`
    }
    case 'nave':
      return `nave:${item.name_lower.trim().toLocaleLowerCase()}`
  }
}

const normalizeHistoryItem = (value: unknown, index = 0): HistoryItem | null => {
  if (!isRecord(value)) return null

  const date = Number(value.date)
  if (!Number.isFinite(date) || date <= 0) return null

  const idFromStorage = optionalString(value.id)
  const metadata = (item: HistoryItemInput) => ({
    ...item,
    id: idFromStorage ?? `${date}:${index}:${getHistoryItemKey(item)}`,
    schemaVersion: HISTORY_SCHEMA_VERSION,
  })

  switch (value.type) {
    case 'verse': {
      const book = Number(value.book)
      const chapter = Number(value.chapter)
      const verse = Number(value.verse)
      const version = optionalString(value.version)
      if (![book, chapter, verse].every(isPositiveInteger) || !version) return null
      return metadata({ type: 'verse', book, chapter, verse, version, date })
    }
    case 'strong': {
      const book = Number(value.book)
      const Mot = optionalString(value.Mot)
      if (!isPositiveInteger(book) || !Mot) return null
      return metadata({
        type: 'strong',
        book,
        Mot,
        Hebreu: optionalString(value.Hebreu) ?? '',
        Grec: optionalString(value.Grec) ?? '',
        reference: optionalString(value.reference),
        Code:
          typeof value.Code === 'string' || typeof value.Code === 'number' ? value.Code : undefined,
        date,
      })
    }
    case 'word': {
      const word = optionalString(value.word)
      if (!word) return null
      return metadata({
        type: 'word',
        word,
        entryId: optionalNumber(value.entryId),
        correspondenceId: optionalString(value.correspondenceId),
        work: optionalString(value.work),
        resourceId: optionalString(value.resourceId),
        dictionaryTitle: optionalString(value.dictionaryTitle),
        language: optionalLanguage(value.language),
        date,
      })
    }
    case 'nave': {
      const name = optionalString(value.name)
      const nameLower = optionalString(value.name_lower)
      if (!name || !nameLower) return null
      return metadata({ type: 'nave', name, name_lower: nameLower, date })
    }
    default:
      return null
  }
}

export const migrateHistoryItems = (value: unknown): HistoryItem[] => {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  const migrated: HistoryItem[] = []

  value.forEach((candidate, index) => {
    const item = normalizeHistoryItem(candidate, index)
    if (!item) return
    const key = getHistoryItemKey(item)
    if (seen.has(key)) return
    seen.add(key)
    migrated.push(item)
  })

  return migrated.slice(0, MAX_HISTORY_ITEMS)
}

export const addHistoryItem = (history: HistoryItem[], input: HistoryItemInput): HistoryItem[] => {
  const item = normalizeHistoryItem({
    ...input,
    id: `${input.date}:${getHistoryItemKey(input)}`,
    schemaVersion: HISTORY_SCHEMA_VERSION,
  })
  if (!item) return history

  const key = getHistoryItemKey(item)
  return [item, ...history.filter(existing => getHistoryItemKey(existing) !== key)].slice(
    0,
    MAX_HISTORY_ITEMS
  )
}
