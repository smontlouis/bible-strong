/**
 * The daily-reading files of the public media host: one file per collection (the verse
 * meditations of Bible Strong in French and English, each devotional book of the plans), and one
 * catalog that says which file is current. The format is described in
 * `portraits/verse-of-the-day/collections-1/FORMAT.md`, where the files are built.
 */

export const DAILY_READINGS_BASE_URL = 'https://media.bible-strong.app/daily-readings'
export const DAILY_READINGS_CATALOG_URL = `${DAILY_READINGS_BASE_URL}/catalog.json`
export const DAILY_SCENES_BASE_URL = 'https://media.bible-strong.app/daily-scenes'

export type DailyCollectionKind = 'verse-meditations' | 'devotional-book'

export type DailyStrongWord = { word: string; code: string; translit: string }

export type DailyCard =
  | { type: 'verse'; text: string; label: string }
  | { type: 'opening'; text: string; citation?: string }
  | { type: 'hook'; text: string }
  | { type: 'part'; title: string; text: string; strong?: DailyStrongWord }
  | { type: 'prayer'; text: string }
  | { type: 'questions'; items: string[] }
  | { type: 'text'; text: string }

export type DailyEntry = {
  scene: string
  /** The passage of a verse meditation, in the numbering of the file's language (`MAT.5.6`). */
  ref?: string
  label?: string
  /** A book's title of the day, without its date. */
  title?: string
  theme?: string
  cards: DailyCard[]
}

export type DailyCollection = {
  id: string
  kind: DailyCollectionKind
  language: string
  /** `MM-DD` → entry key. */
  calendar: Record<string, string>
  /** The entries « Changer de verset » may offer (verse meditations only). */
  reserve: string[]
  entries: Record<string, DailyEntry>
}

export type DailyCatalogCollection = {
  hash: string
  language: string
  kind: DailyCollectionKind
  bytes: number
  days: number
}

export type DailyScene = { hash: string; widths: number[] }

export type DailyCatalog = {
  generatedAt: string
  collections: Record<string, DailyCatalogCollection>
  scenes: Record<string, DailyScene>
}

const HASH_PATTERN = /^[0-9a-f]{12}$/
const DAY_PATTERN = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const isString = (value: unknown): value is string => typeof value === 'string' && value !== ''
const isKind = (value: unknown): value is DailyCollectionKind =>
  value === 'verse-meditations' || value === 'devotional-book'

const parseCatalogCollection = (value: unknown): DailyCatalogCollection | undefined => {
  if (
    !isRecord(value) ||
    typeof value.hash !== 'string' ||
    !HASH_PATTERN.test(value.hash) ||
    !isString(value.language) ||
    !isKind(value.kind)
  )
    return undefined
  return {
    hash: value.hash,
    language: value.language,
    kind: value.kind,
    bytes: typeof value.bytes === 'number' ? value.bytes : 0,
    days: typeof value.days === 'number' ? value.days : 0,
  }
}

const parseScene = (value: unknown): DailyScene | undefined => {
  if (!isRecord(value) || typeof value.hash !== 'string' || !HASH_PATTERN.test(value.hash))
    return undefined
  const widths = Array.isArray(value.widths)
    ? value.widths.filter((width): width is number => typeof width === 'number' && width > 0)
    : []
  return widths.length ? { hash: value.hash, widths: [...widths].sort((a, b) => a - b) } : undefined
}

/** Keeps the well-formed collections and scenes of a published catalog, or nothing. */
export const parseDailyCatalog = (value: unknown): DailyCatalog | undefined => {
  if (
    !isRecord(value) ||
    value.format !== 'bible-strong-daily-readings-catalog' ||
    value.version !== 1 ||
    !isRecord(value.collections) ||
    !isRecord(value.scenes)
  )
    return undefined
  const keep = <T>(record: Record<string, unknown>, parse: (item: unknown) => T | undefined) =>
    Object.fromEntries(
      Object.entries(record).flatMap(([key, item]) => {
        const parsed = parse(item)
        return parsed ? [[key, parsed]] : []
      })
    ) as Record<string, T>
  return {
    generatedAt: typeof value.generatedAt === 'string' ? value.generatedAt : '',
    collections: keep(value.collections, parseCatalogCollection),
    scenes: keep(value.scenes, parseScene),
  }
}

const parseCard = (value: unknown): DailyCard | undefined => {
  if (!isRecord(value)) return undefined
  switch (value.type) {
    case 'verse':
      return isString(value.text) && isString(value.label)
        ? { type: 'verse', text: value.text, label: value.label }
        : undefined
    case 'opening':
      return isString(value.text)
        ? {
            type: 'opening',
            text: value.text,
            ...(isString(value.citation) ? { citation: value.citation } : {}),
          }
        : undefined
    case 'hook':
    case 'prayer':
    case 'text':
      return isString(value.text) ? { type: value.type, text: value.text } : undefined
    case 'part': {
      if (!isString(value.title) || !isString(value.text)) return undefined
      const strong = value.strong
      return {
        type: 'part',
        title: value.title,
        text: value.text,
        ...(isRecord(strong) &&
        isString(strong.word) &&
        isString(strong.code) &&
        isString(strong.translit)
          ? { strong: { word: strong.word, code: strong.code, translit: strong.translit } }
          : {}),
      }
    }
    case 'questions': {
      const items = Array.isArray(value.items) ? value.items.filter(isString) : []
      return items.length ? { type: 'questions', items } : undefined
    }
    default:
      // A card of a later version is skipped rather than refusing the whole file.
      return undefined
  }
}

const parseEntry = (value: unknown): DailyEntry | undefined => {
  if (!isRecord(value) || !isString(value.scene) || !Array.isArray(value.cards)) return undefined
  const cards = value.cards.flatMap(card => {
    const parsed = parseCard(card)
    return parsed ? [parsed] : []
  })
  if (!cards.length) return undefined
  return {
    scene: value.scene,
    cards,
    ...(isString(value.ref) ? { ref: value.ref } : {}),
    ...(isString(value.label) ? { label: value.label } : {}),
    ...(isString(value.title) ? { title: value.title } : {}),
    ...(isString(value.theme) ? { theme: value.theme } : {}),
  }
}

/** Reads a collection file, or nothing when it is not the collection asked for. */
export const parseDailyCollection = (value: unknown, id: string): DailyCollection | undefined => {
  if (
    !isRecord(value) ||
    value.format !== 'bible-strong-daily-readings' ||
    value.version !== 1 ||
    value.id !== id ||
    !isKind(value.kind) ||
    !isString(value.language) ||
    !isRecord(value.calendar) ||
    !isRecord(value.entries)
  )
    return undefined
  const entries: Record<string, DailyEntry> = {}
  for (const [key, entry] of Object.entries(value.entries)) {
    const parsed = parseEntry(entry)
    if (parsed) entries[key] = parsed
  }
  const calendar: Record<string, string> = {}
  for (const [day, key] of Object.entries(value.calendar)) {
    if (DAY_PATTERN.test(day) && typeof key === 'string' && entries[key]) calendar[day] = key
  }
  const reserve = Array.isArray(value.reserve)
    ? value.reserve.filter((key): key is string => typeof key === 'string' && !!entries[key])
    : []
  return { id, kind: value.kind, language: value.language, calendar, reserve, entries }
}

export const getDailyCollectionUri = (id: string, hash: string) =>
  `${DAILY_READINGS_BASE_URL}/${encodeURIComponent(id)}/${hash}.json`

export type DailySceneLayer = 'bg' | 'fg'

/** The smallest published width that covers `minWidth`, or the largest. */
export const getDailySceneUri = (
  sceneId: string,
  scene: DailyScene,
  layer: DailySceneLayer,
  minWidth: number
) => {
  const width = scene.widths.find(candidate => candidate >= minWidth) ?? scene.widths.at(-1)
  return `${DAILY_SCENES_BASE_URL}/${encodeURIComponent(sceneId)}/${scene.hash}/${layer}-w${width}.webp`
}

/** The verse meditations of a language: French for French, English for every other. */
export const getVerseMeditationsId = (language: string) =>
  language.toLowerCase().startsWith('fr') ? 'verse-meditations-fr' : 'verse-meditations-en'

/** The entry of a civil date (`YYYY-MM-DD`), or nothing when the collection has none that day. */
export const getDailyEntryKey = (collection: DailyCollection, date: string) =>
  collection.calendar[date.slice(5)]

/**
 * An entry of the reserve for « Changer de verset », other than those already shown: the next one
 * after the last offered, from a starting point that depends on the date, so that two days do not
 * offer the same verses in the same order.
 */
export const getReserveEntryKey = (
  collection: DailyCollection,
  date: string,
  shown: readonly string[]
): string | undefined => {
  const reserve = collection.reserve.filter(key => !shown.includes(key))
  if (!reserve.length) return undefined
  const seed = [...date].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 1_000_003, 7)
  return reserve[seed % reserve.length]
}
