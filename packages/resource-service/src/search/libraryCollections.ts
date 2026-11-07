// Document collections of the library (ADR-0106): articles and lessons that are not resources of
// the app. A prepared file of JSON lines is imported as passages of one collection publication,
// library:<collection>:<language>; the passages of a document, in order, are its whole text.
import type { LibraryLanguage, LibraryPassageDraft } from './libraryDocuments'
import { passageReference } from './libraryDocuments'
import { splitIntoPassages } from './libraryText'

export type LibraryDocument = {
  key: string
  title: string
  authors: string[]
  date: string | null
  url: string | null
  /** What situates the document in its collection, such as the quarter and lesson. */
  context: string | null
  book: number | null
  chapter: number | null
  verseStart: number | null
  verseEnd: number | null
  text: string
}

export type LibraryCollection = {
  id: string
  title: string
  tradition: string
  tags: string[]
  languages: readonly LibraryLanguage[]
  rights: { holder: string; terms_reference: string }
  /** One prepared record, or undefined for a record to leave out. */
  parse: (record: Record<string, unknown>, language: LibraryLanguage) => LibraryDocument | undefined
}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
const integer = (value: unknown, min: number, max: number) =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max
    ? (value as number)
    : null

/** FNV-1a, 32 bits: a short stable tag for a key that had to be rewritten. */
const fnv = (value: string) => {
  let hash = 0x811c9dc5
  for (const character of value) {
    hash ^= character.codePointAt(0)!
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/**
 * A document key of letters, digits, dots and hyphens. A slug with other characters (« — »,
 * Greek, accents) is spelled without them and tagged, so that two slugs never meet.
 */
export const documentKeyOf = (slug: string) => {
  const safe = slug
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/gu, '-')
    .replace(/^[-.]+|-+$/gu, '')
    .slice(0, 150)
  return safe === slug ? slug : `${safe || 'document'}-${fnv(slug)}`
}

/** « 10-17 », « 8 » or « 14,15 » to a first and last verse. */
export const verseRange = (verses: unknown): [number | null, number | null] => {
  const numbers = text(verses)
    .split(/[^0-9]+/u)
    .filter(Boolean)
    .map(Number)
    .filter(value => value >= 1 && value <= 176)
  return numbers.length ? [numbers[0], numbers.at(-1) ?? numbers[0]] : [null, null]
}

const bri: LibraryCollection = {
  id: 'bri',
  title: 'Biblical Research Institute',
  tradition: 'Protestantisme',
  tags: ['Adventiste'],
  languages: ['en'],
  rights: {
    holder: 'General Conference of Seventh-day Adventists, Biblical Research Institute',
    terms_reference: 'Use granted to Bible Strong by the General Conference',
  },
  parse(record) {
    const slug = text(record.slug)
    const body = text(record.text)
    if (!slug || /[\\/#?\u0000-\u001f]/u.test(slug) || !body || !text(record.title)) return
    const url = text(record.url)
    return {
      key: documentKeyOf(slug),
      title: text(record.title),
      authors: Array.isArray(record.authors)
        ? record.authors.flatMap(author => {
            const name = text((author as { name?: unknown } | null)?.name)
            return name ? [name] : []
          })
        : [],
      date: text(record.date).slice(0, 10) || null,
      url: url.startsWith('https://adventistbiblicalresearch.org/') ? url : null,
      context: null,
      book: null,
      chapter: null,
      verseStart: null,
      verseEnd: null,
      text: body,
    }
  },
}

const LESSON_LABELS: Record<LibraryLanguage, { lesson: string; teacher: string }> = {
  en: { lesson: 'lesson', teacher: 'teacher comments' },
  fr: { lesson: 'leçon', teacher: 'commentaire du moniteur' },
}

const sabbathSchool: LibraryCollection = {
  id: 'sabbath-school',
  title: 'Adult Sabbath School Bible Study Guide',
  tradition: 'Protestantisme',
  tags: ['Adventiste'],
  languages: ['en', 'fr'],
  rights: {
    holder: 'General Conference of Seventh-day Adventists, Sabbath School and Personal Ministries',
    terms_reference: 'Used with permission',
  },
  parse(record, language) {
    const id = text(record.id)
    const prefix = `sabbath-school/${language}/`
    const key = id.startsWith(prefix) ? id.slice(prefix.length) : ''
    const body = text(record.text)
    if (!/^\d{4}-\d{2}\/\d{2}\/[a-z0-9-]{1,40}$/u.test(key) || !body) return
    const labels = LESSON_LABELS[language]
    const lesson = integer(record.lesson, 1, 20)
    const teacher = record.kind === 'teacher-comments'
    const title = text(record.title) || text(record.lessonTitle)
    const first = Array.isArray(record.references)
      ? (record.references[0] as Record<string, unknown> | undefined)
      : undefined
    const [verseStart, verseEnd] = verseRange(first?.verses)
    return {
      key,
      title: teacher ? `${text(record.lessonTitle)} (${labels.teacher})` : title,
      authors: [],
      date: text(record.date) || null,
      url: null,
      context: [
        `${text(record.quarterTitle)} (${text(record.quarter)})`,
        lesson ? `${labels.lesson} ${lesson} « ${text(record.lessonTitle)} »` : null,
      ]
        .filter(Boolean)
        .join(', '),
      book: integer(first?.book, 1, 66),
      chapter: integer(first?.chapter, 1, 150),
      verseStart,
      verseEnd,
      text: body,
    }
  },
}

export const LIBRARY_COLLECTIONS: Record<string, LibraryCollection> = {
  bri,
  'sabbath-school': sabbathSchool,
}

export const collectionIdentity = (collection: string, language: LibraryLanguage) =>
  `library:${collection}:${language}`

/** The passages of a document: the heading names the collection, its tradition and the document. */
export function documentPassages(
  collection: LibraryCollection,
  language: LibraryLanguage,
  document: LibraryDocument
): LibraryPassageDraft[] {
  const tradition = [collection.tradition, ...collection.tags].join(', ')
  const year = document.date?.slice(0, 4)
  const reference =
    document.book && document.chapter
      ? passageReference(
          language,
          document.book,
          document.chapter,
          document.verseStart,
          document.verseEnd
        )
      : null
  const heading = [
    `${collection.title} (${tradition})`,
    document.context,
    document.authors.length ? document.authors.join(', ') : null,
    `« ${document.title} »${year && !document.context ? ` (${year})` : ''}`,
    reference,
  ]
    .filter(Boolean)
    .join(', ')
  return splitIntoPassages(document.text).map((content, part) => ({
    passageKey: `${document.key}#${part}`,
    corpus: 'document',
    language,
    work: collection.id,
    workTitle: collection.title,
    tradition: collection.tradition,
    tags: [...collection.tags],
    title: document.title,
    heading,
    book: document.book,
    chapter: document.chapter,
    verseStart: document.verseStart,
    verseEnd: document.verseEnd,
    part,
    content,
    target: {
      kind: 'document',
      collection: collection.id,
      language,
      documentKey: document.key,
      part,
      ...(document.url ? { url: document.url } : {}),
    },
  }))
}
