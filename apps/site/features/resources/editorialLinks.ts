import { findBibleBook } from '../bible/bibleBooks'
import { buildBiblePath } from '../bible/bibleRoutes'
import { defaultBibleVersionId } from '../bible/bibleVersions'
import { buildStrongPath, parseStrongCode } from '../strong/strongRoutes'
import type { ResourceLanguage } from './publicSite'

export type BibleReference = { book: number; chapter: number; verse?: number; endVerse?: number }

/** The Bible page a reference opens, in the reference Bible of a language. */
export const buildBibleReferencePath = (
  language: ResourceLanguage,
  { book, chapter, verse, endVerse }: BibleReference
): string | undefined => {
  try {
    return buildBiblePath({
      versionId: defaultBibleVersionId(language),
      book,
      chapter,
      passage: verse === undefined ? undefined : { startVerse: verse, endVerse },
    })
  } catch {
    return undefined
  }
}

/**
 * Reads an OSIS reference: `Gen.1`, `Gen.1.1`, `Gen.1.1-3` or `Gen.1.1-Gen.1.3`. A range
 * leaving its chapter is read up to the first verse only.
 */
export const parseOsisReference = (value: string): BibleReference | undefined => {
  const match = /^([1-4]?[A-Za-z]+)\.(\d+)(?:\.(\d+))?(?:-(?:(?:[1-4]?[A-Za-z]+)\.(\d+)\.)?(\d+))?$/u.exec(
    value.trim()
  )
  if (!match) return undefined
  const book = findBibleBook(match[1])
  const chapter = Number(match[2])
  if (!book || !chapter) return undefined
  if (match[3] === undefined) return { book, chapter }
  const verse = Number(match[3])
  const sameChapter = match[4] === undefined || Number(match[4]) === chapter
  const endVerse = sameChapter && match[5] !== undefined ? Number(match[5]) : undefined
  return { book, chapter, verse, ...(endVerse && endVerse > verse ? { endVerse } : {}) }
}

/**
 * Resolves the link schemes shared by every editorial resource: `strong://H430` to a Strong
 * entry and `bible://Gen.1.1` to a Bible passage. Anything else is left to the caller.
 */
export const resolveEditorialHref = (
  href: string,
  { language }: { language: ResourceLanguage }
): string | undefined => {
  const strong = /^strong:(?:\/\/)?([HGhg]\d+[A-Za-z]*)$/u.exec(href)
  if (strong) {
    const identity = parseStrongCode(strong[1])
    return identity ? buildStrongPath(language, identity.code) : undefined
  }
  const bible = /^bible:(?:\/\/)?(.+)$/u.exec(href)
  if (bible) {
    const reference = parseOsisReference(decodeURIComponent(bible[1] ?? ''))
    return reference ? buildBibleReferencePath(language, reference) : undefined
  }
  return undefined
}
