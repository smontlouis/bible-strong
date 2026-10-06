import type { BibleVerseTextsDto } from '@bible-strong/resource-domain/contracts/bibleChapterContract'
import type {
  StrongBibleCountsDto,
  StrongBibleOccurrencesDto,
} from '@bible-strong/resource-domain/contracts/strongBibleContract'
import type {
  StrongLexiconEntryDto,
  StrongLexiconSearchResponseDto,
} from '@bible-strong/resource-domain/contracts/strongLexiconContract'
import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'
import {
  editorialHtmlToText,
  escapeHtml,
  sanitizeEditorialHtml,
  truncateText,
} from '../resources/editorialHtml'
import {
  isResourceLanguage,
  RESOURCE_PAGE_CACHE_CONTROL,
  type ResourceLanguage,
} from '../resources/publicSite'
import { findBibleBook } from '../bible/bibleBooks'
import { readResource } from '../resources/resourceApi'
import { renderStrongDefinitionHtml } from './strongHtml'
import {
  isStrongLexicon,
  parseStrongCode,
  STRONG_LETTERS,
  strongLexicalLanguage,
  type StrongLexicalLanguage,
} from './strongRoutes'

const SAMPLE_VERSE_COUNT = 12
const DESCRIPTION_LENGTH = 155

// The Strong-tagged Bible read alongside each lexicon language.
const CONCORDANCE_VERSION: Record<ResourceLanguage, string> = { fr: 'LSG', en: 'KJV' }

export type StrongPageRelation = {
  group: 'subentry' | 'identity' | 'family'
  label: string
  code: string
  gloss: string
  original: string
  transliteration: string
}

export type StrongPageConcordance = {
  version: string
  verseCount: number
  books: { book: number; verseCount: number }[]
  verses: { book: number; chapter: number; verse: number; html: string }[]
}

export type StrongPageData = {
  language: ResourceLanguage
  code: string
  classicCode: string
  lexicalLanguage: StrongLexicalLanguage
  original: string
  transliteration: string
  pronunciation?: string
  gloss: string
  description: string
  morphology?: { code: string; meaning: string; description?: string }
  definitionHtml?: string
  detailedDefinitionHtml?: string
  nameMeaningHtml?: string
  relations: StrongPageRelation[]
  dictionaryArticles: { title: string; html: string }[]
  entity?: { name: string; brief: string; description: string }
  concordance?: StrongPageConcordance
}

const hasContent = (html: string | undefined): html is string => Boolean(html?.trim())

const sameText = (left: string, right: string): boolean =>
  editorialHtmlToText(left).toLocaleLowerCase() === editorialHtmlToText(right).toLocaleLowerCase()

const markOccurrences = (
  text: string,
  spans: StrongBibleOccurrencesDto['verses'][number]['spans'],
  classicCode: string
): string => {
  const matches = spans
    .filter(span =>
      span.identities.some(
        // Indexes do not all pad their codes (`G26` and `G0026` name the same entry).
        identity => parseStrongCode(identity.code)?.code === classicCode
      )
    )
    .sort((left, right) => left.startOffset - right.startOffset)

  let html = ''
  let position = 0
  for (const span of matches) {
    const end = span.startOffset + span.length
    if (span.startOffset < position || end > text.length) return escapeHtml(text)
    html += `${escapeHtml(text.slice(position, span.startOffset))}<mark>${escapeHtml(
      text.slice(span.startOffset, end)
    )}</mark>`
    position = end
  }
  return html + escapeHtml(text.slice(position))
}

const concordanceIdentityPath = (
  language: ResourceLanguage,
  classicCode: string,
  book: number
): string =>
  `/v1/strong-bibles/${CONCORDANCE_VERSION[language]}/books/${book}/identities/${encodeURIComponent(classicCode)}`

// Any book of the matching testament anchors a lookup across the whole index.
const anchorBook = (lexicalLanguage: StrongLexicalLanguage): number =>
  lexicalLanguage === 'hebrew' ? 1 : 40

const loadBookCounts = async (
  language: ResourceLanguage,
  classicCode: string,
  lexicalLanguage: StrongLexicalLanguage
): Promise<StrongPageConcordance['books']> => {
  const counts = await readResource<StrongBibleCountsDto>(
    `${concordanceIdentityPath(language, classicCode, anchorBook(lexicalLanguage))}/counts`
  )
  return (counts?.counts ?? [])
    .filter(count => count.verseCount > 0)
    .map(count => ({ book: count.book, verseCount: count.verseCount }))
}

// The Resource API returns at most this many occurrences per request.
const OCCURRENCE_REQUEST_LIMIT = 500
// A word found in thousands of verses of one book needs a few requests; the cap only
// guards against a cursor that would not advance.
const MAX_OCCURRENCE_REQUESTS = 20

/**
 * A window of occurrences with their verse text, in one book or across the Bible.
 *
 * The Resource API pages by position, not by number: a request continues after a given
 * verse. A window is therefore read from the start of the book it begins in, and the
 * verses before it are passed over.
 */
const loadOccurrences = async (
  language: ResourceLanguage,
  classicCode: string,
  lexicalLanguage: StrongLexicalLanguage,
  {
    book,
    startBook,
    skip = 0,
    take,
  }: {
    /** Restricts the occurrences to one book. */
    book?: number
    /** The book the window begins in, when reading across the Bible. */
    startBook?: number
    /** How many occurrences come before the window, counted from the start position. */
    skip?: number
    take: number
  }
): Promise<StrongPageConcordance['verses']> => {
  const version = CONCORDANCE_VERSION[language]
  const path = `${concordanceIdentityPath(language, classicCode, book ?? anchorBook(lexicalLanguage))}/occurrences`
  // A cursor names the verse a page comes after; verse 0 of chapter 0 is before any book.
  let cursor = book === undefined && startBook !== undefined ? `strong:v1:${startBook}:0:0` : undefined
  const window: StrongBibleOccurrencesDto['verses'][number][] = []
  let remainingSkip = skip
  for (let request = 0; request < MAX_OCCURRENCE_REQUESTS; request += 1) {
    const response = await readResource<StrongBibleOccurrencesDto>(path, {
      limit: Math.min(OCCURRENCE_REQUEST_LIMIT, remainingSkip + take - window.length),
      cursor,
      allBooks: book === undefined ? 'true' : undefined,
    })
    const verses = response?.verses ?? []
    window.push(...verses.slice(remainingSkip, remainingSkip + take - window.length))
    remainingSkip = Math.max(0, remainingSkip - verses.length)
    cursor = response?.nextCursor
    if (window.length >= take || !cursor || !verses.length) break
  }

  const texts = window.length
    ? await readResource<BibleVerseTextsDto>(`/v1/bibles/${version}/verses`, {
        references: window.map(verse => `${verse.book}-${verse.chapter}-${verse.verse}`).join(','),
      })
    : undefined
  const textByKey = new Map(
    (texts?.verses ?? []).map(verse => [`${verse.book}-${verse.chapter}-${verse.number}`, verse.text])
  )
  return window.flatMap(verse => {
    const text = textByKey.get(`${verse.book}-${verse.chapter}-${verse.verse}`)
    if (!text) return []
    return [
      {
        book: verse.book,
        chapter: verse.chapter,
        verse: verse.verse,
        html: markOccurrences(text, verse.spans, classicCode),
      },
    ]
  })
}

const loadConcordance = async (
  language: ResourceLanguage,
  classicCode: string,
  lexicalLanguage: StrongLexicalLanguage
): Promise<StrongPageConcordance | undefined> => {
  const [books, verses] = await Promise.all([
    loadBookCounts(language, classicCode, lexicalLanguage),
    loadOccurrences(language, classicCode, lexicalLanguage, { take: SAMPLE_VERSE_COUNT }),
  ])
  if (!books.length) return undefined
  return {
    version: CONCORDANCE_VERSION[language],
    verseCount: books.reduce((total, count) => total + count.verseCount, 0),
    books,
    verses,
  }
}

export const loadStrongPage = createServerFn({ method: 'GET' })
  .validator((data: { language: string; code: string }) => data)
  .handler(async ({ data }): Promise<StrongPageData> => {
    const identity = parseStrongCode(data.code)
    if (!isResourceLanguage(data.language) || !identity) throw notFound()
    const language = data.language
    const lexicalLanguage = strongLexicalLanguage(identity.code)

    // ADR-0064: the historical definition is the first reading level, the detailed
    // lexicon carries the in-depth notice, the relations and the optional modules.
    const entryPath = `/v1/strong-lexicon/entries/${encodeURIComponent(identity.code)}`
    const [simple, detailed] = await Promise.all([
      readResource<StrongLexiconEntryDto>(entryPath, { language, level: 'simple' }),
      readResource<StrongLexiconEntryDto>(entryPath, { language }),
    ])
    const entry = detailed ?? simple
    if (!entry) throw notFound()

    const classicCode = parseStrongCode(entry.classicStrong)?.code ?? identity.code
    const concordance = await loadConcordance(language, classicCode, lexicalLanguage)

    const render = (html: string) =>
      renderStrongDefinitionHtml(html, { language, currentCode: identity.code })
    const simpleDefinition = hasContent(simple?.definitionHtml) ? simple.definitionHtml : undefined
    const detailedDefinition = hasContent(detailed?.definitionHtml)
      ? detailed.definitionHtml
      : undefined
    const essential = simpleDefinition ?? detailedDefinition
    const deep =
      simpleDefinition && detailedDefinition && !sameText(simpleDefinition, detailedDefinition)
        ? detailedDefinition
        : undefined
    const nameMeaning = entry.nameMeaningHtml ?? simple?.nameMeaningHtml
    const gloss = simple?.gloss || entry.gloss
    const definitionText = essential ? editorialHtmlToText(essential) : ''

    return {
      language,
      code: identity.code,
      classicCode,
      lexicalLanguage,
      original: entry.original,
      transliteration: entry.transliteration,
      pronunciation: entry.pronunciation ?? simple?.pronunciation,
      gloss,
      description: truncateText(
        [gloss, definitionText].filter(Boolean).join(' — '),
        DESCRIPTION_LENGTH
      ),
      morphology: entry.morphology ?? simple?.morphology,
      definitionHtml: essential ? render(essential) : undefined,
      detailedDefinitionHtml: deep ? render(deep) : undefined,
      nameMeaningHtml:
        hasContent(nameMeaning) && !(essential && sameText(nameMeaning, essential))
          ? render(nameMeaning)
          : undefined,
      relations: (detailed?.relations ?? []).flatMap((relation, index, relations) => {
        const related = parseStrongCode(relation.stepCode)
        if (!related || related.code === identity.code) return []
        // One entry can be related twice within a group (name of, same identity).
        const firstIndex = relations.findIndex(
          other => other.group === relation.group && other.stepCode === relation.stepCode
        )
        if (firstIndex !== index) return []
        return [
          {
            group: relation.group,
            label: relation.label,
            code: related.code,
            gloss: relation.gloss,
            original: relation.original,
            transliteration: relation.transliteration,
          },
        ]
      }),
      dictionaryArticles: (detailed?.resources ?? []).map(resource => ({
        title: resource.title,
        html: sanitizeEditorialHtml(resource.contentHtml),
      })),
      entity: detailed?.entity
        ? {
            name: detailed.entity.name,
            brief: detailed.entity.brief,
            description: detailed.entity.shortDescription || detailed.entity.description,
          }
        : undefined,
      concordance,
    }
  })

const CONCORDANCE_PAGE_SIZE = 50

export type StrongConcordancePageData = {
  language: ResourceLanguage
  code: string
  classicCode: string
  lexicalLanguage: StrongLexicalLanguage
  original: string
  transliteration: string
  gloss: string
  version: string
  verseCount: number
  books: StrongPageConcordance['books']
  /** The book the listing is restricted to, when one is selected. */
  book?: number
  verses: StrongPageConcordance['verses']
  page: number
  pageCount: number
}

export const loadStrongConcordancePage = createServerFn({ method: 'GET' })
  .validator((data: { language: string; code: string; book?: string; page?: number }) => data)
  .handler(async ({ data }): Promise<StrongConcordancePageData> => {
    const identity = parseStrongCode(data.code)
    if (!isResourceLanguage(data.language) || !identity) throw notFound()
    const language = data.language
    const lexicalLanguage = strongLexicalLanguage(identity.code)
    const book = data.book === undefined ? undefined : findBibleBook(data.book)
    if (data.book !== undefined && book === undefined) throw notFound()
    const page = data.page ?? 1
    if (!Number.isSafeInteger(page) || page < 1) throw notFound()

    const entry = await readResource<StrongLexiconEntryDto>(
      `/v1/strong-lexicon/entries/${encodeURIComponent(identity.code)}`,
      { language, content: 'definitions' }
    )
    if (!entry) throw notFound()
    const classicCode = parseStrongCode(entry.classicStrong)?.code ?? identity.code

    const books = await loadBookCounts(language, classicCode, lexicalLanguage)
    const listed = book === undefined ? books : books.filter(count => count.book === book)
    const listedCount = listed.reduce((total, count) => total + count.verseCount, 0)
    const pageCount = Math.ceil(listedCount / CONCORDANCE_PAGE_SIZE)
    if (page > pageCount) throw notFound()

    // The page begins in the book holding its first verse; the verses of that book that
    // come before it are passed over.
    let skip = (page - 1) * CONCORDANCE_PAGE_SIZE
    let startBook: number | undefined
    if (book === undefined) {
      for (const count of books) {
        if (skip < count.verseCount) {
          startBook = count.book
          break
        }
        skip -= count.verseCount
      }
    }
    const verses = await loadOccurrences(language, classicCode, lexicalLanguage, {
      book,
      startBook,
      skip,
      take: CONCORDANCE_PAGE_SIZE,
    })

    return {
      language,
      code: identity.code,
      classicCode,
      lexicalLanguage,
      original: entry.original,
      transliteration: entry.transliteration,
      gloss: entry.gloss,
      version: CONCORDANCE_VERSION[language],
      verseCount: books.reduce((total, count) => total + count.verseCount, 0),
      books,
      book,
      verses,
      page,
      pageCount,
    }
  })

/** What the card opened by a Strong number shows before the full entry. */
export type StrongPreviewData = {
  code: string
  original: string
  transliteration: string
  pronunciation?: string
  gloss: string
  morphology?: string
  definitionHtml?: string
}

export const loadStrongPreview = createServerFn({ method: 'GET' })
  .validator((data: { language: string; code: string }) => data)
  .handler(async ({ data }): Promise<StrongPreviewData> => {
    const identity = parseStrongCode(data.code)
    if (!isResourceLanguage(data.language) || !identity) throw notFound()
    const language = data.language

    // Same reading order as the entry page: the historical definition first (ADR-0064).
    const entryPath = `/v1/strong-lexicon/entries/${encodeURIComponent(identity.code)}`
    const [simple, detailed] = await Promise.all([
      readResource<StrongLexiconEntryDto>(entryPath, { language, level: 'simple' }),
      readResource<StrongLexiconEntryDto>(entryPath, { language, content: 'definitions' }),
    ])
    const entry = detailed ?? simple
    if (!entry) throw notFound()
    const definition = [simple?.definitionHtml, detailed?.definitionHtml].find(hasContent)

    // A preview is as stable as the entry page, so the CDN may keep it as long.
    setResponseHeader('Cache-Control', RESOURCE_PAGE_CACHE_CONTROL)
    return {
      code: identity.code,
      original: entry.original,
      transliteration: entry.transliteration,
      pronunciation: entry.pronunciation ?? simple?.pronunciation,
      gloss: simple?.gloss || entry.gloss,
      morphology: (entry.morphology ?? simple?.morphology)?.meaning,
      definitionHtml: definition
        ? renderStrongDefinitionHtml(definition, { language, currentCode: identity.code })
        : undefined,
    }
  })

// French glosses file their accented initials under the plain letter; the Resource API
// matches a prefix exactly, so each spelling is asked for.
const ACCENTED_INITIALS: Record<string, string[]> = {
  a: ['à', 'â'],
  c: ['ç'],
  e: ['é', 'è', 'ê', 'ë'],
  i: ['î', 'ï'],
  o: ['ô', 'œ'],
  u: ['ù', 'û'],
}
const LETTERS_TTL_MS = 60 * 60 * 1000
// The largest letter holds about a thousand entries; the cap only guards a cursor loop.
const MAX_LIST_PAGES = 10

const letterPrefixes = (letter: string, language: ResourceLanguage): string[] => [
  letter,
  ...(language === 'fr' ? (ACCENTED_INITIALS[letter] ?? []) : []),
]

const browseSimpleLexicon = (
  language: ResourceLanguage,
  lexicon: StrongLexicalLanguage,
  query: { prefix: string; limit: number; cursor?: string }
) =>
  readResource<StrongLexiconSearchResponseDto>('/v1/strong-lexicon/entries', {
    language,
    level: 'simple',
    lexicalLanguage: lexicon,
    ...query,
  })

const lettersCache = new Map<string, { at: number; letters: string[] }>()

/** The letters under which a lexicon has entries; kept an hour per server instance. */
export const listStrongLetters = async (
  language: ResourceLanguage,
  lexicon: StrongLexicalLanguage
): Promise<string[]> => {
  const key = `${language}:${lexicon}`
  const cached = lettersCache.get(key)
  if (cached && Date.now() - cached.at < LETTERS_TTL_MS) return cached.letters
  // An accented initial never comes without its plain letter, so one probe per letter is enough.
  const filled = await Promise.all(
    STRONG_LETTERS.map(async letter => {
      const page = await browseSimpleLexicon(language, lexicon, { prefix: letter, limit: 1 })
      return (page?.entries.length ?? 0) > 0
    })
  )
  const letters = STRONG_LETTERS.filter((_, index) => filled[index])
  lettersCache.set(key, { at: Date.now(), letters })
  return letters
}

export type StrongIndexPageData = {
  language: ResourceLanguage
  letters: Record<StrongLexicalLanguage, string[]>
}

export const loadStrongIndexPage = createServerFn({ method: 'GET' })
  .validator((data: { language: string }) => data)
  .handler(async ({ data }): Promise<StrongIndexPageData> => {
    if (!isResourceLanguage(data.language)) throw notFound()
    const [hebrew, greek] = await Promise.all([
      listStrongLetters(data.language, 'hebrew'),
      listStrongLetters(data.language, 'greek'),
    ])
    return { language: data.language, letters: { hebrew, greek } }
  })

export type StrongListEntry = {
  code: string
  gloss: string
  original: string
  transliteration: string
}

export type StrongLetterPageData = {
  language: ResourceLanguage
  lexicon: StrongLexicalLanguage
  letter: string
  letters: string[]
  entries: StrongListEntry[]
}

/** The entries of a lexicon whose gloss starts with a letter, one per classical number. */
export const loadStrongLetterPage = createServerFn({ method: 'GET' })
  .validator((data: { language: string; lexicon: string; letter: string }) => data)
  .handler(async ({ data }): Promise<StrongLetterPageData> => {
    const { language, lexicon, letter } = data
    if (!isResourceLanguage(language) || !isStrongLexicon(lexicon)) throw notFound()
    if (!STRONG_LETTERS.includes(letter)) throw notFound()

    const readAll = async (prefix: string) => {
      const found: StrongLexiconSearchResponseDto['entries'][number][] = []
      let cursor: string | undefined
      for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
        const response = await browseSimpleLexicon(language, lexicon, { prefix, limit: 500, cursor })
        found.push(...(response?.entries ?? []))
        cursor = response?.nextCursor
        if (!cursor) break
      }
      return found
    }
    const [letters, ...lists] = await Promise.all([
      listStrongLetters(language, lexicon),
      ...letterPrefixes(letter, language).map(readAll),
    ])

    const byCode = new Map<string, StrongListEntry>()
    for (const entry of lists.flat()) {
      const code = parseStrongCode(entry.classicStrong)?.code
      if (!code || byCode.has(code)) continue
      byCode.set(code, {
        code,
        gloss: entry.gloss,
        original: entry.original,
        transliteration: entry.transliteration,
      })
    }
    const entries = [...byCode.values()].sort(
      (left, right) =>
        left.gloss.localeCompare(right.gloss, language, { sensitivity: 'base' }) ||
        left.code.localeCompare(right.code)
    )
    if (!entries.length) throw notFound()

    return { language, lexicon, letter, letters, entries }
  })
