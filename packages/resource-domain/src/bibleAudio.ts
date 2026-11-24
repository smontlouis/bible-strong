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
}

export type BibleAudioCatalog = {
  version: 1
  recordings: BibleAudioRecording[]
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
  }
}

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
  return { version: 1, recordings }
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
