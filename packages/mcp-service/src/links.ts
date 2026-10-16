import { bookSlug } from './bible/books'
import type { Passage } from './bible/reference'
import { defaultVersionId, versionSlug } from './bible/versions'
import type { StudyLanguage } from './language'

/**
 * The pages of the public site each result links to. The paths are the canonical ones of
 * the site (ADR-0053 and following): a result always opens the page that holds it.
 */
export type SiteLinks = ReturnType<typeof createSiteLinks>

/** `G26` and `g0026` name the same entry; a path writes it `g0026`, a sense `h0430G`. */
export const strongCodeSlug = (code: string): string | undefined => {
  const match = /^([HG])0*(\d+)([A-Za-z]*)$/iu.exec(code.trim())
  return match ? `${match[1]!.toLowerCase()}${match[2]!.padStart(4, '0')}${match[3]}` : undefined
}

/** The address of an article names its heading, without accents: « Jokébed » is `jokebed`. */
export const articleSlug = (word: string): string =>
  word
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '') || 'article'

const TIMELINE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u

export const createSiteLinks = (origin: string) => {
  const site = origin.replace(/\/+$/u, '')

  const passage = (versionId: string, { book, chapter, startVerse, endVerse, wholeChapter }: Passage) => {
    const slug = bookSlug(book)
    if (!slug) return undefined
    const chapterPath = `${site}/bible/${versionSlug(versionId)}/${slug}/${chapter}`
    if (wholeChapter) return chapterPath
    return startVerse === endVerse
      ? `${chapterPath}/${startVerse}`
      : `${chapterPath}/${startVerse}-${endVerse}`
  }

  return {
    home: (language: StudyLanguage) => (language === 'fr' ? `${site}/fr` : `${site}/`),

    passage,

    /** A verse in the Bible a language reads by default. */
    verse: (language: StudyLanguage, book: number, chapter: number, verse: number) =>
      passage(defaultVersionId(language), {
        book,
        chapter,
        startVerse: verse,
        endVerse: verse,
        wholeChapter: false,
      }),

    /** The original text of a verse read word by word, glossed in a language. */
    interlinear: (language: StudyLanguage, book: number, chapter: number, verse: number) => {
      const slug = bookSlug(book)
      return slug ? `${site}/bible/bhg/interlinear/${language}/${slug}/${chapter}/${verse}` : undefined
    },

    strong: (language: StudyLanguage, code: string) => {
      const slug = strongCodeSlug(code)
      return slug ? `${site}/strong/${language}/${slug}` : undefined
    },

    concordance: (language: StudyLanguage, code: string) => {
      const slug = strongCodeSlug(code)
      return slug ? `${site}/strong/${language}/${slug}/concordance` : undefined
    },

    dictionaryEntry: (language: StudyLanguage, work: string, entryId: number, word: string) =>
      `${site}/dictionary/${language}/${work}/${entryId}/${articleSlug(word)}`,

    naveTopic: (language: StudyLanguage, normalizedName: string) =>
      `${site}/nave/${language}/${encodeURIComponent(normalizedName)}`,

    /** `commentary` is the identity of the catalog; `section` the range a comment covers. */
    commentarySection: (
      language: StudyLanguage,
      commentary: string,
      book: number,
      chapter: number,
      section?: string
    ) => {
      const slug = bookSlug(book)
      if (!slug) return undefined
      const chapterPath = `${site}/commentary/${language}/${commentary}/${slug}/${chapter}`
      return section ? `${chapterPath}/${section}` : chapterPath
    },

    timeline: (language: StudyLanguage) => `${site}/timeline/${language}`,

    timelineEvent: (language: StudyLanguage, slug: string) =>
      TIMELINE_SLUG_PATTERN.test(slug) ? `${site}/timeline/${language}/${slug}` : undefined,
  }
}
