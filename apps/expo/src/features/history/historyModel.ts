import type { ResourceLanguage } from '~helpers/databaseTypes'
import { getHistoryStrongReference } from '~helpers/historyStrongReference'

export const HISTORY_SCHEMA_VERSION = 2 as const
// Each type keeps its own quota so a reading session never evicts consulted resources.
export const MAX_HISTORY_ITEMS_PER_TYPE = 50

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

// Titles of user-owned items (study, note) are a fallback: the History reads them live.
export type HistoryStudyItem = BaseHistoryItem & {
  type: 'study'
  studyId: string
  title: string
}

export type HistoryNoteItem = BaseHistoryItem & {
  type: 'note'
  noteId: string
  title: string
  reference?: string
}

export type HistoryPlanItem = BaseHistoryItem & {
  type: 'plan'
  planId: string
  title: string
  subtitle?: string
}

export type HistoryMeditationItem = BaseHistoryItem & {
  type: 'meditation'
  collectionId: string
  readingId: string
  title: string
  collectionTitle?: string
  readingDate?: string
}

export type HistoryTimelineItem = BaseHistoryItem & {
  type: 'timeline'
  slug: string
  title: string
  dateLabel?: string
  language?: ResourceLanguage
}

export type HistoryCommentaryItem = BaseHistoryItem & {
  type: 'commentary'
  /** Verse key, `book-chapter-verse`. */
  verse: string
}

export type HistoryCommentaryResourceItem = BaseHistoryItem & {
  type: 'commentary-resource'
  projectionId: string
  book: number
  chapter: number
  sectionId?: string
  title: string
  passage: string
}

export type HistoryItem =
  | HistoryStrongItem
  | HistoryVerseItem
  | HistoryWordItem
  | HistoryNaveItem
  | HistoryStudyItem
  | HistoryNoteItem
  | HistoryPlanItem
  | HistoryMeditationItem
  | HistoryTimelineItem
  | HistoryCommentaryItem
  | HistoryCommentaryResourceItem

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

const optionalPositiveInteger = (value: unknown): number | undefined => {
  const number = Number(value)
  return isPositiveInteger(number) ? number : undefined
}

export const HISTORY_FILTERS = [
  'all',
  'bible',
  'strong',
  'word',
  'nave',
  'commentary',
  'timeline',
  'study',
  'note',
  'plan',
] as const
export type HistoryFilter = (typeof HISTORY_FILTERS)[number]

export const isHistoryFilter = (value: unknown): value is HistoryFilter =>
  HISTORY_FILTERS.includes(value as HistoryFilter)

const filterTypes: Record<Exclude<HistoryFilter, 'all'>, HistoryItem['type'][]> = {
  bible: ['verse'],
  strong: ['strong'],
  word: ['word'],
  nave: ['nave'],
  commentary: ['commentary', 'commentary-resource'],
  timeline: ['timeline'],
  study: ['study'],
  note: ['note'],
  plan: ['plan', 'meditation'],
}

export const matchesHistoryFilter = (item: HistoryItem, filter: HistoryFilter): boolean =>
  filter === 'all' || filterTypes[filter].includes(item.type)

// A chapter is one entry whatever the version or the verse it was opened at;
// the entry reopens the latest version and verse.
export const getHistoryItemKey = (item: HistoryItem | HistoryItemInput): string => {
  switch (item.type) {
    case 'verse':
      return `verse:${Number(item.book)}:${Number(item.chapter)}`
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
    case 'study':
      return `study:${item.studyId}`
    case 'note':
      return `note:${item.noteId}`
    case 'plan':
      return `plan:${item.planId}`
    case 'meditation':
      return `meditation:${item.collectionId}:${item.readingId}`
    case 'timeline':
      return `timeline:${item.slug}`
    case 'commentary':
      return `commentary:${item.verse}`
    case 'commentary-resource':
      return `commentary-resource:${item.projectionId}:${item.book}:${item.chapter}:${item.sectionId ?? ''}`
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
    case 'study': {
      const studyId = optionalString(value.studyId)
      if (!studyId) return null
      return metadata({ type: 'study', studyId, title: optionalString(value.title) ?? '', date })
    }
    case 'note': {
      const noteId = optionalString(value.noteId)
      if (!noteId) return null
      return metadata({
        type: 'note',
        noteId,
        title: optionalString(value.title) ?? '',
        reference: optionalString(value.reference),
        date,
      })
    }
    case 'plan': {
      const planId = optionalString(value.planId)
      const title = optionalString(value.title)
      if (!planId || !title) return null
      return metadata({
        type: 'plan',
        planId,
        title,
        subtitle: optionalString(value.subtitle),
        date,
      })
    }
    case 'meditation': {
      const collectionId = optionalString(value.collectionId)
      const readingId = optionalString(value.readingId)
      const title = optionalString(value.title)
      if (!collectionId || !readingId || !title) return null
      return metadata({
        type: 'meditation',
        collectionId,
        readingId,
        title,
        collectionTitle: optionalString(value.collectionTitle),
        readingDate: optionalString(value.readingDate),
        date,
      })
    }
    case 'timeline': {
      const slug = optionalString(value.slug)
      const title = optionalString(value.title)
      if (!slug || !title) return null
      return metadata({
        type: 'timeline',
        slug,
        title,
        dateLabel: optionalString(value.dateLabel),
        language: optionalLanguage(value.language),
        date,
      })
    }
    case 'commentary': {
      const verse = optionalString(value.verse)
      if (!verse || !/^\d+-\d+-\d+$/.test(verse)) return null
      return metadata({ type: 'commentary', verse, date })
    }
    case 'commentary-resource': {
      const projectionId = optionalString(value.projectionId)
      const book = optionalPositiveInteger(value.book)
      const chapter = optionalPositiveInteger(value.chapter)
      const title = optionalString(value.title)
      const passage = optionalString(value.passage)
      if (!projectionId || !book || !chapter || !title || !passage) return null
      return metadata({
        type: 'commentary-resource',
        projectionId,
        book,
        chapter,
        sectionId: optionalString(value.sectionId),
        title,
        passage,
        date,
      })
    }
    default:
      return null
  }
}

const limitHistoryTypes = (history: HistoryItem[]): HistoryItem[] => {
  const counts: Partial<Record<HistoryItem['type'], number>> = {}
  return history.filter(item => {
    const count = (counts[item.type] ?? 0) + 1
    counts[item.type] = count
    return count <= MAX_HISTORY_ITEMS_PER_TYPE
  })
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

  return limitHistoryTypes(migrated)
}

export const addHistoryItem = (history: HistoryItem[], input: HistoryItemInput): HistoryItem[] => {
  const item = normalizeHistoryItem({
    ...input,
    id: `${input.date}:${getHistoryItemKey(input)}`,
    schemaVersion: HISTORY_SCHEMA_VERSION,
  })
  if (!item) return history

  const key = getHistoryItemKey(item)
  return limitHistoryTypes([
    item,
    ...history.filter(existing => getHistoryItemKey(existing) !== key),
  ])
}

export const removeHistoryItem = (history: HistoryItem[], id: string): HistoryItem[] =>
  history.filter(item => item.id !== id)

export type HistoryDay = {
  /** Local midnight of the day, in milliseconds. */
  day: number
  items: HistoryItem[]
}

const startOfLocalDay = (time: number) => {
  const date = new Date(time)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** Groups items, already ordered from the most recent, by local calendar day. */
export const groupHistoryByDay = (history: HistoryItem[]): HistoryDay[] => {
  const days: HistoryDay[] = []
  history.forEach(item => {
    const day = startOfLocalDay(item.date)
    const last = days.at(-1)
    if (last?.day === day) last.items.push(item)
    else days.push({ day, items: [item] })
  })
  return days
}

export const getHistoryDayLabel = (
  day: number,
  now: number
): 'today' | 'yesterday' | 'thisYear' | 'older' => {
  const today = startOfLocalDay(now)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (day === today) return 'today'
  if (day === yesterday.getTime()) return 'yesterday'
  return new Date(day).getFullYear() === new Date(now).getFullYear() ? 'thisYear' : 'older'
}
