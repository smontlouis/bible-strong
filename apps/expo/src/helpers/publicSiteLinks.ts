import { ONLINE_BIBLE_VERSION_IDS } from '~helpers/ordinaryBibleVersions'
import { getSupportedOsisBookId } from '~helpers/osisReference'
import { createStrongIdentity } from '~helpers/strongIdentities'

/** The public site, where a shared resource can be read without the application (ADR-0068). */
export const PUBLIC_SITE_URL = 'https://bible-strong.app'

const onlineVersions = new Set<string>(ONLINE_BIBLE_VERSION_IDS)

/**
 * A canonical path of the application, read on the public site. A path that cannot be
 * built opens the home page: sharing never fails for its link.
 */
export const getPublicSiteUrl = (buildPath: () => string): string => {
  try {
    return `${PUBLIC_SITE_URL}${buildPath()}`
  } catch {
    return PUBLIC_SITE_URL
  }
}

/**
 * The page of the site showing shared verses (`book-chapter-verse` keys): their passage
 * when they follow each other, otherwise the chapter of the first one. A version the site
 * does not serve opens its home page.
 */
export const getVersesShareUrl = (verseKeys: readonly string[], version: string): string => {
  const verses = verseKeys.map(key => key.split('-').map(Number))
  const [book, chapter] = verses[0] ?? []
  const bookSlug = book ? getSupportedOsisBookId(book)?.toLowerCase() : undefined
  if (!bookSlug || !chapter || !onlineVersions.has(version)) return PUBLIC_SITE_URL

  const chapterUrl = `${PUBLIC_SITE_URL}/bible/${version
    .toLowerCase()
    .replaceAll('_', '-')}/${bookSlug}/${chapter}`
  if (verses.some(verse => verse[0] !== book || verse[1] !== chapter)) return chapterUrl
  const numbers = verses.map(verse => verse[2] ?? 0).sort((left, right) => left - right)
  const first = numbers[0] ?? 0
  const last = numbers.at(-1) ?? first
  const consecutive = numbers.every((number, index) => index === 0 || number === first + index)
  if (first < 1 || !consecutive) return chapterUrl
  return `${chapterUrl}/${first}${last > first ? `-${last}` : ''}`
}

/** The entry of a Strong number on the site, in the language of the lexicon being read. */
export const getStrongShareUrl = (
  code: string,
  lexicalLanguage: 'hebrew' | 'greek',
  language: 'fr' | 'en'
): string =>
  getPublicSiteUrl(() => {
    const identity = createStrongIdentity(code, lexicalLanguage)
    return `/strong/${language}/${identity.code[0]?.toLowerCase()}${identity.code.slice(1)}`
  })
