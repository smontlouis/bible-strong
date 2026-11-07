// Document collections of the library (ADR-0106): texts that are not resources of the app,
// imported from a prepared file of JSON lines. The first line describes the collection, every
// other line is one document; the passages of a document, in order, are its whole text. Which
// collections exist and how their files are prepared is decided where the files are prepared.
import type { LibraryLanguage, LibraryPassageDraft } from './libraryDocuments'
import { passageReference } from './libraryDocuments'
import { splitIntoPassages } from './libraryText'

export type LibraryCollection = {
  id: string
  title: string
  tradition: string | null
  tags: string[]
  language: LibraryLanguage
  rights: { holder: string; terms_reference: string }
}

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
  /** Short labels the prepared file gives the document, returned with each of its hits. */
  labels: string[]
}

const text = (value: unknown, max = 100_000) =>
  typeof value === 'string' && value.trim().length <= max ? value.trim() : ''
const integer = (value: unknown, min: number, max: number) =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max
    ? (value as number)
    : null
const strings = (value: unknown, check: (item: string) => boolean, max: number) =>
  Array.isArray(value)
    ? [...new Set(value.map(item => text(item)).filter(item => item && check(item)))].slice(0, max)
    : []

const COLLECTION_ID = /^[a-z0-9][a-z0-9-]{0,39}$/u
/** A document key: letters, digits, dots, hyphens and slashes; no « . » or « .. » segment. */
const DOCUMENT_KEY = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/u
const LABEL = /^[A-Za-z][A-Za-z ,'-]{1,59}$/u

/** The first line of a prepared file: { "collection": { id, title, tradition, tags, language, rights } }. */
export function parseCollectionHeader(record: Record<string, unknown>): LibraryCollection {
  const value = (record.collection ?? {}) as Record<string, unknown>
  const rights = (value.rights ?? {}) as Record<string, unknown>
  const collection = {
    id: text(value.id),
    title: text(value.title, 200),
    tradition: text(value.tradition, 60) || null,
    tags: strings(value.tags, tag => tag.length <= 40, 8),
    language: value.language as LibraryLanguage,
    rights: { holder: text(rights.holder, 300), terms_reference: text(rights.terms_reference, 300) },
  }
  if (
    !COLLECTION_ID.test(collection.id) ||
    !collection.title ||
    (collection.language !== 'fr' && collection.language !== 'en') ||
    !collection.rights.holder ||
    !collection.rights.terms_reference
  )
    throw new Error('LIBRARY_COLLECTION_HEADER_INVALID')
  return collection
}

/** One document line, or undefined for a line the import leaves out. */
export function parseCollectionDocument(
  record: Record<string, unknown>
): LibraryDocument | undefined {
  const key = text(record.key)
  const title = text(record.title, 300)
  const body = text(record.text, 5_000_000)
  if (!DOCUMENT_KEY.test(key) || /\/\.\.?(?:\/|$)/u.test(key) || !title || !body) return
  const url = text(record.url, 500)
  let source: URL | undefined
  try {
    source = url ? new URL(url) : undefined
  } catch {}
  const date = text(record.date, 10)
  return {
    key,
    title,
    authors: strings(record.authors, author => author.length <= 120, 12),
    date: /^\d{4}(?:-\d{2}){0,2}$/u.test(date) ? date : null,
    url: source?.protocol === 'https:' ? url : null,
    context: text(record.context, 300) || null,
    book: integer(record.book, 1, 66),
    chapter: integer(record.chapter, 1, 150),
    verseStart: integer(record.verseStart, 1, 176),
    verseEnd: integer(record.verseEnd, 1, 176),
    text: body,
    labels: strings(record.labels, label => LABEL.test(label), 6),
  }
}

export const collectionIdentity = (collection: string, language: LibraryLanguage) =>
  `library:${collection}:${language}`

/** The passages of a document: the heading names the collection, its tradition and the document. */
export function documentPassages(
  collection: LibraryCollection,
  document: LibraryDocument
): LibraryPassageDraft[] {
  const { language } = collection
  const tradition = [collection.tradition, ...collection.tags].filter(Boolean).join(', ')
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
    tradition ? `${collection.title} (${tradition})` : collection.title,
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
      ...(document.labels.length ? { labels: [...document.labels] } : {}),
    },
  }))
}
