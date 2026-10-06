import { BHG_INTERLINEAR_PUBLICATION_CATALOG } from '@bible-strong/resource-catalog/interlinear-bible'
import { isStrongBibleVersionId } from '@bible-strong/resource-catalog/strong-bibles'
import {
  DEFAULT_RESOURCE_LANGUAGE,
  isResourceLanguage,
  WEB_APP_ORIGIN,
  type ResourceLanguage,
} from '../resources/publicSite'
import { bibleBookSlug, findBibleBook } from './bibleBooks'
import { bibleVersionSlug, findBibleVersion, type BibleVersion } from './bibleVersions'

/**
 * How a Bible is read (ADR-0053). `interlinear` reads the original-language Bible word by
 * word; its glosses exist in French and in English, so the path names their language.
 */
export const BIBLE_PRESENTATIONS = ['text', 'strong', 'reverse-interlinear', 'interlinear'] as const
export type BiblePresentation = (typeof BIBLE_PRESENTATIONS)[number]

/** The original-language Bible every interlinear presentation is aligned on. */
export const INTERLINEAR_VERSION_ID: string = BHG_INTERLINEAR_PUBLICATION_CATALOG.applicationVersionId

export type BiblePassage = { startVerse: number; endVerse?: number }

export type BibleRoute = {
  version: BibleVersion
  presentation: BiblePresentation
  book: number
  chapter: number
  passage?: BiblePassage
  /** The gloss language of the `interlinear` presentation. */
  gloss?: ResourceLanguage
}

export type BibleLocation = {
  versionId: string
  presentation?: BiblePresentation
  book: number
  chapter: number
  passage?: BiblePassage
  gloss?: ResourceLanguage
}

const MAX_VERSE_NUMBER = 250

const parsePositiveInteger = (value: string | undefined): number | undefined => {
  if (!value || !/^\d{1,3}$/u.test(value)) return undefined
  const parsed = Number(value)
  return parsed > 0 ? parsed : undefined
}

const parsePassage = (value: string): BiblePassage | undefined => {
  const match = /^(\d{1,3})(?:-(\d{1,3}))?$/u.exec(value)
  if (!match) return undefined
  const startVerse = Number(match[1])
  const endVerse = match[2] === undefined ? undefined : Number(match[2])
  if (startVerse > MAX_VERSE_NUMBER) return undefined
  if (endVerse !== undefined && (endVerse < startVerse || endVerse > MAX_VERSE_NUMBER)) {
    return undefined
  }
  return endVerse === undefined || endVerse === startVerse ? { startVerse } : { startVerse, endVerse }
}

export const isBiblePresentationSupported = (
  versionId: string,
  presentation: BiblePresentation
): boolean => {
  if (presentation === 'text') return true
  if (presentation === 'interlinear') return versionId === INTERLINEAR_VERSION_ID
  // Every Strong-tagged translation is aligned on the original-language Bible.
  return isStrongBibleVersionId(versionId)
}

export const supportedBiblePresentations = (versionId: string): BiblePresentation[] =>
  BIBLE_PRESENTATIONS.filter(presentation => isBiblePresentationSupported(versionId, presentation))

/**
 * The reading mode to keep when moving to another version: the same one when it exists,
 * the matching interlinear between a translation and the original-language Bible, or the
 * plain text.
 */
export const closestBiblePresentation = (
  versionId: string,
  presentation: BiblePresentation
): BiblePresentation => {
  if (isBiblePresentationSupported(versionId, presentation)) return presentation
  const counterpart =
    presentation === 'interlinear'
      ? 'reverse-interlinear'
      : presentation === 'reverse-interlinear'
        ? 'interlinear'
        : undefined
  return counterpart && isBiblePresentationSupported(versionId, counterpart) ? counterpart : 'text'
}

const isPresentationSegment = (value: string | undefined): value is BiblePresentation =>
  value !== 'text' && (BIBLE_PRESENTATIONS as readonly string[]).includes(value ?? '')

/**
 * Parses the grammar of ADR-0053:
 *
 * - `/bible/:version[/strong|/reverse-interlinear]/:book/:chapter[/:passage]`
 * - `/bible/:version/interlinear/:language/:book/:chapter[/:passage]`
 *
 * Only canonical OSIS book identities are accepted; the chapter still has to be checked
 * against the coverage of the version.
 */
export const parseBibleRoute = (path: string | undefined): BibleRoute | undefined => {
  const segments = (path ?? '').split('/').filter(Boolean)
  const version = findBibleVersion(segments[0])
  if (!version) return undefined

  const presentation: BiblePresentation = isPresentationSegment(segments[1]) ? segments[1] : 'text'
  if (!isBiblePresentationSupported(version.id, presentation)) return undefined
  const gloss = presentation === 'interlinear' ? segments[2]?.toLowerCase() : undefined
  if (presentation === 'interlinear' && !isResourceLanguage(gloss)) return undefined

  const position = presentation === 'text' ? 1 : presentation === 'interlinear' ? 3 : 2
  if (segments.length < position + 2 || segments.length > position + 3) return undefined

  const book = findBibleBook(segments[position])
  const chapter = parsePositiveInteger(segments[position + 1])
  if (!book || !chapter) return undefined

  const passageSegment = segments[position + 2]
  const passage = passageSegment === undefined ? undefined : parsePassage(passageSegment)
  if (passageSegment !== undefined && !passage) return undefined

  return {
    version,
    presentation,
    book,
    chapter,
    ...(passage ? { passage } : {}),
    ...(isResourceLanguage(gloss) ? { gloss } : {}),
  }
}

export const buildBiblePath = ({
  versionId,
  presentation = 'text',
  book,
  chapter,
  passage,
  gloss,
}: BibleLocation): string => {
  const bookSlug = bibleBookSlug(book)
  if (!bookSlug || !isBiblePresentationSupported(versionId, presentation)) {
    throw new Error('BIBLE_ROUTE_INVALID')
  }
  const segments = [
    'bible',
    bibleVersionSlug(versionId),
    ...(presentation === 'text' ? [] : [presentation]),
    ...(presentation === 'interlinear' ? [gloss ?? DEFAULT_RESOURCE_LANGUAGE] : []),
    bookSlug,
    String(chapter),
  ]
  if (passage) {
    segments.push(
      passage.endVerse !== undefined && passage.endVerse !== passage.startVerse
        ? `${passage.startVerse}-${passage.endVerse}`
        : String(passage.startVerse)
    )
  }
  return `/${segments.join('/')}`
}

/** The study workspace shares this grammar, so the same path opens the same reading. */
export const buildWebAppBibleUrl = (location: BibleLocation): string =>
  `${WEB_APP_ORIGIN}${buildBiblePath(location)}`
