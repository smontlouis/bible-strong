/**
 * The recordings of Bible versions (ADR-0117). A version has from none to many: a reading, a
 * dramatized one, another voice. Each is streamed from its publisher's host; the catalog only says
 * where a chapter is and which books it covers. The device's voice is not a recording: the player
 * adds it to every version.
 */

export type BibleAudioKind = 'reading' | 'drama'

export type BibleAudioLanguage = 'fr' | 'en'

/** Where the chapters of some books are: the first source naming a book wins, one without books is the default. */
export type BibleAudioAddress = {
  books?: number[]
  /**
   * The address of a chapter, with `{book}`, `{chapter}`, `{testament}` (`at` or `nt`),
   * `{testamentBook}` (the book's rank in its testament) and `{bookCode}` (from `bookCodes`).
   * A width pads a number with zeros: `{chapter:3}` gives `007`.
   */
  url: string
}

export type BibleAudioRecording = {
  /** Durable: the player remembers a reader's choice by it. */
  id: string
  /** The Bible version read, by its code: `LSG`. */
  version: string
  name: Record<BibleAudioLanguage, string>
  kind: BibleAudioKind
  /** The books it covers, by number; absent, every book of the version. */
  books?: number[]
  sources: BibleAudioAddress[]
  /** Codes of the books in the publisher's addresses, by book number (the first is book 1). */
  bookCodes?: string[]
  /** Who publishes the recording, shown with it. */
  credit?: string
  /** What the publisher asks to be shown with every chapter heard. */
  attribution?: BibleAudioAttribution
}

/**
 * The mention a publisher sets as a condition of its recording: a label (« Voix : tresorsonore.com »),
 * the address it opens, and the publisher's logo beside it.
 */
export type BibleAudioAttribution = {
  label: Record<BibleAudioLanguage, string>
  url: string
  logo?: string
}

export type BibleAudioCatalog = {
  version: 1
  recordings: BibleAudioRecording[]
  /**
   * The place painted on the cover of a chapter, by `book:chapter`: the unique name of an entity
   * whose portrait the media host holds. A chapter absent from it keeps a cover of type alone.
   */
  places?: Record<string, string>
  /**
   * The timeline scene painted on the cover of a chapter, by `book:chapter`: the slug of an event
   * whose painting the media host holds (ADR-0096). It comes before the place.
   */
  scenes?: Record<string, string>
}

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/
const TOKEN_PATTERN = /\{(book|chapter|testament|testamentBook|bookCode)(?::(\d))?\}/g
const FIRST_NEW_TESTAMENT_BOOK = 40
const LAST_NEW_TESTAMENT_BOOK = 66

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const isBookList = (value: unknown): value is number[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(book => Number.isInteger(book) && (book as number) > 0)

const isHttpsTemplate = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith('https://') && value.includes('{chapter')

const parseSource = (value: unknown): BibleAudioAddress | undefined => {
  if (!isRecord(value) || !isHttpsTemplate(value.url)) return undefined
  if (value.books !== undefined && !isBookList(value.books)) return undefined
  return value.books === undefined ? { url: value.url } : { books: value.books, url: value.url }
}

const parseName = (value: unknown): Record<BibleAudioLanguage, string> | undefined => {
  if (!isRecord(value) || typeof value.fr !== 'string' || typeof value.en !== 'string')
    return undefined
  if (!value.fr.trim() || !value.en.trim()) return undefined
  return { fr: value.fr, en: value.en }
}

const isHttpsAddress = (value: unknown): value is string =>
  typeof value === 'string' && /^https:\/\/[^\s]+$/.test(value)

const parseAttribution = (value: unknown): BibleAudioAttribution | undefined => {
  if (!isRecord(value)) return undefined
  const label = parseName(value.label)
  if (!label || !isHttpsAddress(value.url)) return undefined
  if (value.logo !== undefined && !isHttpsAddress(value.logo)) return undefined
  return { label, url: value.url, ...(value.logo ? { logo: value.logo } : {}) }
}

const parseRecording = (value: unknown): BibleAudioRecording | undefined => {
  if (!isRecord(value)) return undefined
  const { id, version, kind, books, bookCodes, credit } = value
  const name = parseName(value.name)
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) return undefined
  if (typeof version !== 'string' || !version.trim() || !name) return undefined
  if (kind !== 'reading' && kind !== 'drama') return undefined
  if (books !== undefined && !isBookList(books)) return undefined
  if (!Array.isArray(value.sources)) return undefined
  const sources = value.sources.map(parseSource)
  if (!sources.length || sources.some(source => !source)) return undefined
  if (
    bookCodes !== undefined &&
    (!Array.isArray(bookCodes) || !bookCodes.every(code => typeof code === 'string'))
  )
    return undefined
  // A publisher's condition the app cannot show leaves the recording out rather than unmentioned.
  const attribution =
    value.attribution === undefined ? undefined : parseAttribution(value.attribution)
  if (value.attribution !== undefined && !attribution) return undefined
  const usesBookCodes = (sources as BibleAudioAddress[]).some(source =>
    source.url.includes('{bookCode')
  )
  if (usesBookCodes && !bookCodes) return undefined
  return {
    id,
    version,
    name,
    kind,
    ...(books ? { books } : {}),
    sources: sources as BibleAudioAddress[],
    ...(bookCodes ? { bookCodes: bookCodes as string[] } : {}),
    ...(typeof credit === 'string' && credit.trim() ? { credit } : {}),
    ...(attribution ? { attribution } : {}),
  }
}

const CHAPTER_KEY_PATTERN = /^\d{1,3}:\d{1,3}$/

const parseChapterMap = (
  value: unknown,
  isName: (name: string) => boolean
): Record<string, string> | undefined => {
  if (!isRecord(value)) return undefined
  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] =>
      CHAPTER_KEY_PATTERN.test(entry[0]) && typeof entry[1] === 'string' && isName(entry[1])
  )
  return entries.length ? Object.fromEntries(entries) : undefined
}

const SCENE_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/

/** The key of a chapter in the places of the catalog. */
export const getBibleAudioChapterKey = (book: number, chapter: number) => `${book}:${chapter}`

/** The timeline scene painted on the cover of a chapter, by its slug, if the catalog has one. */
export const getChapterScene = (catalog: BibleAudioCatalog, book: number, chapter: number) =>
  catalog.scenes?.[getBibleAudioChapterKey(book, chapter)]

/** The place painted on the cover of a chapter, by its unique name, if the catalog has one. */
export const getChapterPlace = (catalog: BibleAudioCatalog, book: number, chapter: number) =>
  catalog.places?.[getBibleAudioChapterKey(book, chapter)]

/**
 * The well-formed recordings of a published catalog, or nothing when it is not one. A malformed
 * entry is left out rather than failing the whole catalog; a repeated id keeps its first entry.
 */
export const parseBibleAudioCatalog = (value: unknown): BibleAudioCatalog | undefined => {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.recordings)) return undefined
  const seen = new Set<string>()
  const recordings = value.recordings.flatMap(entry => {
    const recording = parseRecording(entry)
    if (!recording || seen.has(recording.id)) return []
    seen.add(recording.id)
    return [recording]
  })
  const places = parseChapterMap(value.places, name => name.includes('@'))
  const scenes = parseChapterMap(value.scenes, name => SCENE_SLUG_PATTERN.test(name))
  return {
    version: 1,
    recordings,
    ...(places ? { places } : {}),
    ...(scenes ? { scenes } : {}),
  }
}

/** The recordings of a version, in the catalog's order. */
export const getVersionRecordings = (catalog: BibleAudioCatalog, version: string) =>
  catalog.recordings.filter(recording => recording.version === version)

export const recordingCoversBook = (recording: BibleAudioRecording, book: number) =>
  !recording.books || recording.books.includes(book)

const pad = (value: number | string, width: string | undefined) =>
  width ? String(value).padStart(Number(width), '0') : String(value)

/** The address of a chapter of a recording, or nothing when it does not cover the book. */
export const getBibleAudioUrl = (
  recording: BibleAudioRecording,
  book: number,
  chapter: number
): string | undefined => {
  if (!recordingCoversBook(recording, book)) return undefined
  const source =
    recording.sources.find(candidate => candidate.books?.includes(book)) ??
    recording.sources.find(candidate => !candidate.books)
  if (!source) return undefined
  const isNewTestament = book >= FIRST_NEW_TESTAMENT_BOOK && book <= LAST_NEW_TESTAMENT_BOOK
  let missing = false
  const url = source.url.replace(TOKEN_PATTERN, (_token, name: string, width?: string) => {
    switch (name) {
      case 'book':
        return pad(book, width)
      case 'chapter':
        return pad(chapter, width)
      case 'testament':
        return isNewTestament ? 'nt' : 'at'
      case 'testamentBook':
        return pad(isNewTestament ? book - FIRST_NEW_TESTAMENT_BOOK + 1 : book, width)
      default: {
        const code = recording.bookCodes?.[book - 1]
        if (!code) missing = true
        return code ?? ''
      }
    }
  })
  return missing ? undefined : url
}
