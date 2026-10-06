import type { BibleVerseTextsDto } from '@bible-strong/resource-domain/contracts/bibleChapterContract'
import type {
  StrongBibleCountsDto,
  StrongBibleOccurrencesDto,
} from '@bible-strong/resource-domain/contracts/strongBibleContract'
import type { StrongLexiconEntryDto } from '@bible-strong/resource-domain/contracts/strongLexiconContract'
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
import { parseStrongCode, strongLexicalLanguage, type StrongLexicalLanguage } from './strongRoutes'

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

/** One page of occurrences with their verse text, in one book or across the Bible. */
const loadOccurrences = async (
  language: ResourceLanguage,
  classicCode: string,
  lexicalLanguage: StrongLexicalLanguage,
  { book, cursor, limit }: { book?: number; cursor?: string; limit: number }
): Promise<{ verses: StrongPageConcordance['verses']; nextCursor?: string }> => {
  const version = CONCORDANCE_VERSION[language]
  const occurrences = await readResource<StrongBibleOccurrencesDto>(
    `${concordanceIdentityPath(language, classicCode, book ?? anchorBook(lexicalLanguage))}/occurrences`,
    { limit, cursor, allBooks: book === undefined ? 'true' : undefined }
  )
  const sample = occurrences?.verses ?? []
  const texts = sample.length
    ? await readResource<BibleVerseTextsDto>(`/v1/bibles/${version}/verses`, {
        references: sample.map(verse => `${verse.book}-${verse.chapter}-${verse.verse}`).join(','),
      })
    : undefined
  const textByKey = new Map(
    (texts?.verses ?? []).map(verse => [`${verse.book}-${verse.chapter}-${verse.number}`, verse.text])
  )
  return {
    nextCursor: occurrences?.nextCursor,
    verses: sample.flatMap(verse => {
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
    }),
  }
}

const loadConcordance = async (
  language: ResourceLanguage,
  classicCode: string,
  lexicalLanguage: StrongLexicalLanguage
): Promise<StrongPageConcordance | undefined> => {
  const [books, { verses }] = await Promise.all([
    loadBookCounts(language, classicCode, lexicalLanguage),
    loadOccurrences(language, classicCode, lexicalLanguage, { limit: SAMPLE_VERSE_COUNT }),
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
  nextCursor?: string
  /** Whether this is the first, unfiltered page: the only one worth indexing. */
  isFirstPage: boolean
}

export const loadStrongConcordancePage = createServerFn({ method: 'GET' })
  .validator((data: { language: string; code: string; book?: string; cursor?: string }) => data)
  .handler(async ({ data }): Promise<StrongConcordancePageData> => {
    const identity = parseStrongCode(data.code)
    if (!isResourceLanguage(data.language) || !identity) throw notFound()
    const language = data.language
    const lexicalLanguage = strongLexicalLanguage(identity.code)
    const book = data.book === undefined ? undefined : findBibleBook(data.book)
    if (data.book !== undefined && book === undefined) throw notFound()

    const entry = await readResource<StrongLexiconEntryDto>(
      `/v1/strong-lexicon/entries/${encodeURIComponent(identity.code)}`,
      { language, content: 'definitions' }
    )
    if (!entry) throw notFound()
    const classicCode = parseStrongCode(entry.classicStrong)?.code ?? identity.code

    const [books, occurrences] = await Promise.all([
      loadBookCounts(language, classicCode, lexicalLanguage),
      loadOccurrences(language, classicCode, lexicalLanguage, {
        book,
        cursor: data.cursor,
        limit: CONCORDANCE_PAGE_SIZE,
      }),
    ])
    if (!books.length || (book !== undefined && !books.some(count => count.book === book))) {
      throw notFound()
    }

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
      verses: occurrences.verses,
      nextCursor: occurrences.nextCursor,
      isFirstPage: book === undefined && data.cursor === undefined,
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
