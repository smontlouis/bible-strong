import books, { type Book } from '~assets/bible_versions/books-desc'
import legacyBookAliases from '~assets/bible_versions/books.json'
import { versions } from '~helpers/bibleVersions'
import { STRONG_BIBLE_REVERSE_INTERLINEAR_CANDIDATES } from '~helpers/strongBibleReverseInterlinearCandidate'
import { isStrongCapableBibleVersion } from '~helpers/strongBiblePublications'
import { getSupportedOsisBookId } from '~helpers/osisReference'

export type PublicBiblePresentation = 'text' | 'strong' | 'reverse-interlinear'

export type PublicBiblePassage = {
  startVerse: number
  endVerse?: number
}

export type PublicBibleRoute = {
  version: string
  presentation: PublicBiblePresentation
  book: Book
  chapter: number
  passage?: PublicBiblePassage
  glossLanguage?: 'fr' | 'en'
}

const MAX_PUBLIC_VERSE_NUMBER = 250
const MAX_PUBLIC_PASSAGE_LENGTH = 250

const normalizeSlug = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[’']/gu, '')
    .toLocaleLowerCase('fr')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')

const versionSlug = (version: string): string => version.toLocaleLowerCase().replaceAll('_', '-')

const booksByAlias = new Map<string, Book>()
const bookSlugsById = new Map<number, string>()

for (const book of books) {
  const osisId = getSupportedOsisBookId(book.Numero)
  if (!osisId) throw new Error(`PUBLIC_BIBLE_ROUTE_OSIS_ID_MISSING:${book.Numero}`)
  const canonicalSlug = osisId.toLocaleLowerCase()
  bookSlugsById.set(book.Numero, canonicalSlug)

  const legacyAliases = legacyBookAliases[String(book.Numero) as keyof typeof legacyBookAliases]
  const aliases = [osisId, book.Nom, ...(legacyAliases ?? [])]
  for (const alias of aliases) {
    const normalizedAlias = normalizeSlug(alias)
    const existing = booksByAlias.get(normalizedAlias)
    if (existing && existing.Numero !== book.Numero) {
      throw new Error(`PUBLIC_BIBLE_ROUTE_ALIAS_COLLISION:${normalizedAlias}`)
    }
    booksByAlias.set(normalizedAlias, book)
  }
}
const versionsBySlug = new Map(
  Object.keys(versions).map(version => [versionSlug(version), version] as const)
)

const normalizedSegments = (value: string | readonly string[] | undefined): string[] => {
  if (Array.isArray(value)) return value.filter(Boolean)
  return typeof value === 'string' ? value.split('/').filter(Boolean) : []
}

const parsePositiveInteger = (value: string | undefined): number | undefined => {
  if (!value || !/^\d+$/u.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined
}

const parsePassage = (value: string | undefined): PublicBiblePassage | undefined => {
  if (!value) return undefined
  const match = /^(\d+)(?:-(\d+))?$/u.exec(value)
  if (!match) return undefined
  const startVerse = Number(match[1])
  const endVerse = match[2] === undefined ? undefined : Number(match[2])
  if (
    !Number.isSafeInteger(startVerse) ||
    startVerse < 0 ||
    startVerse > MAX_PUBLIC_VERSE_NUMBER ||
    (endVerse !== undefined &&
      (!Number.isSafeInteger(endVerse) ||
        endVerse < startVerse ||
        endVerse > MAX_PUBLIC_VERSE_NUMBER ||
        endVerse - startVerse + 1 > MAX_PUBLIC_PASSAGE_LENGTH))
  ) {
    return undefined
  }
  return endVerse === undefined || endVerse === startVerse
    ? { startVerse }
    : { startVerse, endVerse }
}

export const isPublicBiblePresentationSupported = (
  version: string,
  presentation: PublicBiblePresentation
): boolean => {
  if (presentation === 'text') return true
  if (presentation === 'strong') return isStrongCapableBibleVersion(version)
  return Object.prototype.hasOwnProperty.call(STRONG_BIBLE_REVERSE_INTERLINEAR_CANDIDATES, version)
}

export const parsePublicBibleRoute = (
  value: string | readonly string[] | undefined,
  glossLanguage?: string
): PublicBibleRoute | undefined => {
  const segments = normalizedSegments(value)
  const version = versionsBySlug.get(segments[0]?.toLocaleLowerCase() ?? '')
  if (!version) return undefined

  let presentation: PublicBiblePresentation = 'text'
  let position = 1
  const presentationSegment = segments[position]
  if (presentationSegment === 'strong' || presentationSegment === 'reverse-interlinear') {
    presentation = presentationSegment
    position += 1
  }

  if (!isPublicBiblePresentationSupported(version, presentation)) return undefined
  if (segments.length < position + 2 || segments.length > position + 3) return undefined

  const book = booksByAlias.get(normalizeSlug(segments[position] ?? ''))
  const chapter = parsePositiveInteger(segments[position + 1])
  if (!book || !chapter || chapter > book.Chapitres) return undefined

  const passageSegment = segments[position + 2]
  const passage = parsePassage(passageSegment)
  if (passageSegment && !passage) return undefined

  const normalizedGlossLanguage =
    presentation === 'reverse-interlinear' && (glossLanguage === 'fr' || glossLanguage === 'en')
      ? glossLanguage
      : undefined

  return {
    version,
    presentation,
    book,
    chapter,
    ...(passage ? { passage } : {}),
    ...(normalizedGlossLanguage ? { glossLanguage: normalizedGlossLanguage } : {}),
  }
}

export const buildPublicBiblePath = ({
  version,
  presentation,
  book,
  chapter,
  passage,
  glossLanguage,
}: PublicBibleRoute): string => {
  const bookSlug = bookSlugsById.get(book.Numero)
  if (
    !bookSlug ||
    !versions[version] ||
    !isPublicBiblePresentationSupported(version, presentation)
  ) {
    throw new Error('PUBLIC_BIBLE_ROUTE_INVALID')
  }
  if (!Number.isSafeInteger(chapter) || chapter < 1 || chapter > book.Chapitres) {
    throw new Error('PUBLIC_BIBLE_ROUTE_INVALID_CHAPTER')
  }

  const segments = [
    'bible',
    versionSlug(version),
    ...(presentation === 'text' ? [] : [presentation]),
    bookSlug,
    String(chapter),
  ]
  if (passage) {
    const { startVerse, endVerse } = passage
    if (
      !Number.isSafeInteger(startVerse) ||
      startVerse < 0 ||
      startVerse > MAX_PUBLIC_VERSE_NUMBER ||
      (endVerse !== undefined &&
        (!Number.isSafeInteger(endVerse) ||
          endVerse < startVerse ||
          endVerse > MAX_PUBLIC_VERSE_NUMBER ||
          endVerse - startVerse + 1 > MAX_PUBLIC_PASSAGE_LENGTH))
    ) {
      throw new Error('PUBLIC_BIBLE_ROUTE_INVALID_PASSAGE')
    }
    segments.push(
      endVerse !== undefined && endVerse !== startVerse
        ? `${startVerse}-${endVerse}`
        : String(startVerse)
    )
  }

  const path = `/${segments.join('/')}`
  return presentation === 'reverse-interlinear' && glossLanguage
    ? `${path}?gloss=${glossLanguage}`
    : path
}

export const getPublicBibleBookSlug = (book: Book | number): string | undefined =>
  bookSlugsById.get(typeof book === 'number' ? book : book.Numero)
