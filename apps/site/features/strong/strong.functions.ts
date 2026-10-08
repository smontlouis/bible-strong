import type { BibleVerseTextsDto } from '@bible-strong/resource-domain/contracts/bibleChapterContract'
import type {
  StrongBibleCountsBatchDto,
  StrongBibleCountsDto,
  StrongBibleLemmaStatsDto,
  StrongBibleOccurrencesDto,
} from '@bible-strong/resource-domain/contracts/strongBibleContract'
import type {
  StrongLexiconEntryDto,
  StrongLexiconNumberSensesDto,
  StrongLexiconSearchResponseDto,
} from '@bible-strong/resource-domain/contracts/strongLexiconContract'
import {
  isSameStrongDefinition,
  presentStrongDefinitions,
} from '@bible-strong/resource-domain/strong-definition-presentation'
import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'
import {
  editorialHtmlToText,
  escapeHtml,
  sanitizeEditorialHtml,
  truncateText,
} from '../resources/editorialHtml'
import { createPageReads, type PageReads } from '../resources/pageReads'
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
import {
  EVERY_STRONG_SENSE,
  groupStrongListLines,
  hasStrongNumberPage,
  strongSenseSummaries,
  toStrongSenseRef,
  uniqueStrongGlosses,
  type StrongListLine,
  type StrongSenseRef,
} from './strongSenses'

const SAMPLE_VERSE_COUNT = 20
// How many of the words a translation renders an entry by are listed.
const TRANSLATION_COUNT = 12
const SENSE_SUMMARY_LENGTH = 170
const DESCRIPTION_LENGTH = 155

// The Strong-tagged Bible read alongside each lexicon language.
const CONCORDANCE_VERSION: Record<ResourceLanguage, string> = { fr: 'LSG', en: 'KJV' }

// Another sense of the word says more than a shared identity, which says more than a family.
const RELATION_RANK: Record<StrongPageRelation['group'], number> = {
  subentry: 0,
  identity: 1,
  family: 2,
}

export type StrongPageRelation = {
  group: 'subentry' | 'identity' | 'family'
  label: string
  code: string
  gloss: string
  original: string
  transliteration: string
}

/** A word the Bible of the page renders an entry by, and how many times. */
export type StrongTranslation = { word: string; count: number }

export type StrongPageConcordance = {
  version: string
  verseCount: number
  books: { book: number; verseCount: number }[]
  verses: { book: number; chapter: number; verse: number; html: string }[]
  /** The words the entry is translated by, the most frequent first. */
  translations: StrongTranslation[]
}

export type StrongPageData = {
  kind: 'sense'
  language: ResourceLanguage
  /** The code of the sense: the identity of the entry, as in the study workspace. */
  code: string
  /** The classical Strong number the sense is filed under. */
  classicCode: string
  /** The page of that number, where it lists this sense among the others. */
  number?: { code: string; senseCount: number }
  lexicalLanguage: StrongLexicalLanguage
  original: string
  transliteration: string
  pronunciation?: string
  gloss: string
  description: string
  morphology?: { code: string; meaning: string; description?: string }
  definitionHtml?: string
  /** The other definition: the detailed notice, or the general one under a specific sense. */
  deepDefinition?: { kind: 'detailed' | 'general'; html: string }
  nameMeaningHtml?: string
  relations: StrongPageRelation[]
  dictionaryArticles: { title: string; html: string }[]
  entity?: { name: string; brief: string; description: string }
  concordance?: StrongPageConcordance
  /**
   * A part of the page is missing because it could not be read, as opposed to not existing.
   * The page is shown as it is, and the CDN keeps it a minute only.
   */
  incomplete?: true
}

/** One sense of a classical number, as the page of the number lists it. */
export type StrongNumberSense = {
  code: string
  gloss: string
  original: string
  transliteration: string
  /** What tells the sense apart: who a person is, or the start of its own notice. */
  summary?: string
  verseCount: number
  /** The books it is found in, in the order of the Bible. */
  books: number[]
}

/** The page of a classical number the lexicon splits into several senses. */
export type StrongNumberPageData = {
  kind: 'number'
  language: ResourceLanguage
  /** The classical number, which names the page. */
  code: string
  lexicalLanguage: StrongLexicalLanguage
  original: string
  transliteration: string
  pronunciation?: string
  /** The glosses of its senses, each once, the most frequent sense first. */
  glosses: string[]
  nameMeaningHtml?: string
  /** The historical notice of the number, which covers every sense. */
  definitionHtml?: string
  senses: StrongNumberSense[]
  /** The verses of the number, every sense together. */
  concordance?: Pick<StrongPageConcordance, 'version' | 'verseCount' | 'verses' | 'translations'>
  /** A part of the page is missing because it could not be read; see `StrongPageData`. */
  incomplete?: true
}

/**
 * Where a code leads when it is not the address of its page: a number with one sense, or a
 * code in another letter case, leads to the sense that answered.
 */
export type StrongSenseAddress = { kind: 'moved'; code: string }

/** What a code answers with: its page, or the address of the sense it leads to. */
export type StrongPageAnswer = StrongPageData | StrongNumberPageData | StrongSenseAddress

/** Where a request for the verses of a number is sent when the number has its own page. */
export type StrongNumberAddress = { kind: 'number'; code: string }

const hasContent = (html: string | undefined): html is string => Boolean(html?.trim())

/** The classical number a code is written under: `H1254B` is written under `H1254`. */
const writtenNumber = (code: string): string => code.replace(/[A-Za-z]+$/u, '')

/**
 * The codes that may name one entry: a code can be written in another letter case, and the
 * lexicon is asked for each spelling in turn. A suffix that names no sense names nothing:
 * it does not fall back on the number it is written under.
 */
const strongCodeCandidates = (code: string): string[] => {
  const number = writtenNumber(code)
  const suffix = code.slice(number.length)
  return [
    ...new Set([code, `${number}${suffix.toUpperCase()}`, `${number}${suffix.toLowerCase()}`]),
  ]
}

/** A read worth a second try: one slow answer among many should not fail a page. */
const readTwice = <Result>(read: () => Promise<Result>): Promise<Result> => read().catch(read)

type ResolvedStrongEntry = {
  simple?: StrongLexiconEntryDto
  detailed?: StrongLexiconEntryDto
  entry: StrongLexiconEntryDto
  /** The code of the sense that answered: the canonical identity of the entry. */
  code: string
}

type StrongEntryLevels = readonly [
  simple: Promise<StrongLexiconEntryDto | undefined>,
  detailed: Promise<StrongLexiconEntryDto | undefined>,
]

/** Asks for both reading levels of the entry a code is spelled as (ADR-0064). */
const readStrongEntryLevels = (
  reads: PageReads,
  candidate: string,
  language: ResourceLanguage,
  detailedContent?: 'definitions'
): StrongEntryLevels => {
  const path = `/v1/strong-lexicon/entries/${encodeURIComponent(candidate)}`
  return [
    reads.queue(() => readResource<StrongLexiconEntryDto>(path, { language, level: 'simple' })),
    reads.queue(() =>
      readResource<StrongLexiconEntryDto>(path, { language, content: detailedContent })
    ),
  ]
}

/**
 * The entry as the first of its two levels to answer gives it. Both carry the same codes,
 * which is all that what is read next depends on. No answer when neither level has it.
 */
const firstStrongEntryLevel = (
  levels: StrongEntryLevels
): Promise<StrongLexiconEntryDto | undefined> =>
  Promise.any(
    levels.map(async level => (await level) ?? Promise.reject(new Error('STRONG_ENTRY_ABSENT')))
  ).catch(() => undefined)

/**
 * Reads the entry a code names, at both reading levels (ADR-0064). The lexicon answers a
 * classical number with the first sense of its family; the page then belongs to that sense.
 * The levels of the code as it was asked may have been asked for already.
 */
const readStrongEntry = async (
  reads: PageReads,
  requested: string,
  language: ResourceLanguage,
  { detailedContent, asked }: { detailedContent?: 'definitions'; asked?: StrongEntryLevels } = {}
): Promise<ResolvedStrongEntry | undefined> => {
  for (const candidate of strongCodeCandidates(requested)) {
    const [simple, detailed] = await Promise.all(
      (candidate === requested && asked) ||
        readStrongEntryLevels(reads, candidate, language, detailedContent)
    )
    const entry = detailed ?? simple
    if (entry) {
      return { simple, detailed, entry, code: parseStrongCode(entry.stepCode)?.code ?? candidate }
    }
  }
  return undefined
}

/** The reading order of the two definitions, the one of the study workspace. */
const presentDefinitions = ({ simple, detailed, entry }: ResolvedStrongEntry) =>
  presentStrongDefinitions({
    definitionHtml: simple?.definitionHtml,
    detailedDefinitionHtml: detailed?.definitionHtml,
    gloss: simple?.gloss || entry.gloss,
    stepCode: entry.stepCode,
    eStrong: entry.eStrong,
    classicStrong: entry.classicStrong,
    relations: [...(detailed?.relations ?? [])],
    language: entry.language,
  })

const markOccurrences = (
  text: string,
  spans: StrongBibleOccurrencesDto['verses'][number]['spans'],
  code: string
): string => {
  const matches = spans
    .filter(span =>
      span.identities.some(
        // Indexes do not all pad their codes (`G26` and `G0026` name the same entry).
        identity => parseStrongCode(identity.code)?.code === code
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

// The occurrences of a sense: a word tagged with its code, not every word of its family.
const concordanceIdentityPath = (language: ResourceLanguage, code: string, book: number): string =>
  `/v1/strong-bibles/${CONCORDANCE_VERSION[language]}/books/${book}/identities/${encodeURIComponent(code)}`

// Any book of the matching testament anchors a lookup across the whole index.
const anchorBook = (lexicalLanguage: StrongLexicalLanguage): number =>
  lexicalLanguage === 'hebrew' ? 1 : 40

// The books a code is read in, as the Resource API counts its verses in each.
const bookCountsOf = (
  counts: StrongBibleCountsDto['counts'] | undefined
): StrongPageConcordance['books'] =>
  (counts ?? [])
    .filter(count => count.verseCount > 0)
    .map(count => ({ book: count.book, verseCount: count.verseCount }))

const loadBookCounts = async (
  reads: PageReads,
  language: ResourceLanguage,
  code: string,
  lexicalLanguage: StrongLexicalLanguage
): Promise<StrongPageConcordance['books']> => {
  const counts = await reads.queue(() =>
    readResource<StrongBibleCountsDto>(
      `${concordanceIdentityPath(language, code, anchorBook(lexicalLanguage))}/counts`
    )
  )
  return bookCountsOf(counts?.counts)
}

// The Resource API counts the verses of at most this many codes in one read.
const COUNTED_CODE_LIMIT = 100

/** The books each of several codes is read in: one read for all of them. */
const loadBookCountsOf = async (
  reads: PageReads,
  language: ResourceLanguage,
  codes: readonly string[],
  lexicalLanguage: StrongLexicalLanguage
): Promise<Map<string, StrongPageConcordance['books']>> => {
  const path = `/v1/strong-bibles/${CONCORDANCE_VERSION[language]}/books/${anchorBook(lexicalLanguage)}/identities/batch/counts`
  const books = new Map<string, StrongPageConcordance['books']>()
  for (let start = 0; start < codes.length; start += COUNTED_CODE_LIMIT) {
    const references = codes.slice(start, start + COUNTED_CODE_LIMIT).join(',')
    const counted = await reads.queue(() =>
      readResource<StrongBibleCountsBatchDto>(path, { references })
    )
    for (const { reference, counts } of counted?.references ?? []) {
      books.set(reference, bookCountsOf(counts))
    }
  }
  return books
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
  reads: PageReads,
  language: ResourceLanguage,
  code: string,
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
  const path = `${concordanceIdentityPath(language, code, book ?? anchorBook(lexicalLanguage))}/occurrences`
  // A cursor names the verse a page comes after; verse 0 of chapter 0 is before any book.
  let cursor =
    book === undefined && startBook !== undefined ? `strong:v1:${startBook}:0:0` : undefined
  const window: StrongBibleOccurrencesDto['verses'][number][] = []
  let remainingSkip = skip
  for (let request = 0; request < MAX_OCCURRENCE_REQUESTS; request += 1) {
    const query = {
      limit: Math.min(OCCURRENCE_REQUEST_LIMIT, remainingSkip + take - window.length),
      cursor,
      allBooks: book === undefined ? 'true' : undefined,
    }
    const response = await reads.queue(() => readResource<StrongBibleOccurrencesDto>(path, query))
    const verses = response?.verses ?? []
    window.push(...verses.slice(remainingSkip, remainingSkip + take - window.length))
    remainingSkip = Math.max(0, remainingSkip - verses.length)
    cursor = response?.nextCursor
    if (window.length >= take || !cursor || !verses.length) break
  }

  const texts = window.length
    ? await reads.queue(() =>
        readResource<BibleVerseTextsDto>(`/v1/bibles/${version}/verses`, {
          references: window
            .map(verse => `${verse.book}-${verse.chapter}-${verse.verse}`)
            .join(','),
        })
      )
    : undefined
  const textByKey = new Map(
    (texts?.verses ?? []).map(verse => [
      `${verse.book}-${verse.chapter}-${verse.number}`,
      verse.text,
    ])
  )
  return window.flatMap(verse => {
    const text = textByKey.get(`${verse.book}-${verse.chapter}-${verse.verse}`)
    if (!text) return []
    return [
      {
        book: verse.book,
        chapter: verse.chapter,
        verse: verse.verse,
        html: markOccurrences(text, verse.spans, code),
      },
    ]
  })
}

/**
 * The words the Bible of the page renders an entry by. A word the translators supplied is
 * marked with braces in the index (`{Dieu}`); it is counted with the word itself. The page
 * can do without them: when they cannot be read it is shown without, and is incomplete.
 */
const loadTranslations = async (
  reads: PageReads,
  language: ResourceLanguage,
  code: string,
  lexicalLanguage: StrongLexicalLanguage
): Promise<StrongTranslation[]> => {
  const stats = await reads.optional(() =>
    readResource<StrongBibleLemmaStatsDto>(
      `${concordanceIdentityPath(language, code, anchorBook(lexicalLanguage))}/lemmas`
    )
  )
  const counts = new Map<string, number>()
  for (const { lemma, occurrenceCount } of stats?.lemmas ?? []) {
    const word = lemma.replace(/[{}]/gu, '').trim()
    if (word) counts.set(word, (counts.get(word) ?? 0) + occurrenceCount)
  }
  return [...counts]
    .map(([word, count]) => ({ word, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, TRANSLATION_COUNT)
}

const loadConcordance = async (
  reads: PageReads,
  language: ResourceLanguage,
  code: string,
  lexicalLanguage: StrongLexicalLanguage
): Promise<StrongPageConcordance | undefined> => {
  const [books, verses, translations] = await Promise.all([
    loadBookCounts(reads, language, code, lexicalLanguage),
    loadOccurrences(reads, language, code, lexicalLanguage, { take: SAMPLE_VERSE_COUNT }),
    loadTranslations(reads, language, code, lexicalLanguage),
  ])
  if (!books.length) return undefined
  return {
    version: CONCORDANCE_VERSION[language],
    verseCount: books.reduce((total, count) => total + count.verseCount, 0),
    books,
    verses,
    translations,
  }
}

/** A sense of a number as the lexicon lists it under that number, with what tells it apart. */
type StrongNumberSenseRef = StrongSenseRef & {
  /** Who the person or the place of the sense is. */
  brief?: string
  /** The notice of the sense itself, in the detailed lexicon. */
  noticeHtml?: string
}

/**
 * The senses filed under one classical number, each with what tells it apart: one read,
 * which the page of the number and the pages of its senses share.
 */
const loadSenses = async (
  reads: PageReads,
  language: ResourceLanguage,
  classicCode: string
): Promise<StrongNumberSenseRef[]> => {
  const response = await reads.queue(() =>
    readResource<StrongLexiconNumberSensesDto>(
      `/v1/strong-lexicon/numbers/${encodeURIComponent(classicCode)}/senses`,
      { language }
    )
  )
  // The read answers every number, with no sense for one the lexicon does not hold. No
  // answer is a Resource service older than the read: the page fails rather than take a
  // split number for one without senses, and redirect it.
  if (!response) throw new Error('STRONG_NUMBER_SENSES_UNAVAILABLE')
  const senses = new Map<string, StrongNumberSenseRef>()
  for (const entry of response.senses) {
    const sense = toStrongSenseRef(entry)
    if (sense?.classicCode === classicCode) {
      senses.set(sense.code, {
        ...sense,
        brief: entry.entityBrief,
        noticeHtml: entry.detailedDefinitionHtml,
      })
    }
  }
  return [...senses.values()].sort((left, right) =>
    left.code < right.code ? -1 : left.code > right.code ? 1 : 0
  )
}

// A sense adds one letter to its classical number; a number that ran out of capitals goes on
// with small letters, which name other senses.
const SENSE_SUFFIXES = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz']

type SenseBooks = Map<string, StrongPageConcordance['books']>

/**
 * Where the senses of a number are read, asked for before the senses are known: under every
 * code a sense of the number can carry. A code that names no sense counts nothing.
 */
const loadCandidateSenseBooks = (
  reads: PageReads,
  language: ResourceLanguage,
  classicCode: string,
  lexicalLanguage: StrongLexicalLanguage
): Promise<SenseBooks> =>
  readTwice(() =>
    loadBookCountsOf(
      reads,
      language,
      SENSE_SUFFIXES.map(suffix => `${classicCode}${suffix}`),
      lexicalLanguage
    )
  )

/**
 * Where each sense of a number is read: what was asked for with the senses, and a read of
 * its own for a sense whose code is not its number and a letter.
 */
const loadSenseBooks = async (
  reads: PageReads,
  language: ResourceLanguage,
  lexicalLanguage: StrongLexicalLanguage,
  senses: readonly StrongSenseRef[],
  asked: Promise<SenseBooks> | undefined
): Promise<SenseBooks> => {
  const counted = (await asked) ?? new Map()
  const others = senses.map(sense => sense.code).filter(code => !counted.has(code))
  if (!others.length) return counted
  const rest = await readTwice(() => loadBookCountsOf(reads, language, others, lexicalLanguage))
  return new Map([...counted, ...rest])
}

/**
 * The page of a classical number: the word once, then each sense with what tells it apart
 * and where it is read. The lexicon lists the senses with what tells each apart, and the
 * Bible counts the verses of all of them at once.
 */
const loadNumberPage = async ({
  reads,
  resolved,
  language,
  lexicalLanguage,
  classicCode,
  senses,
  askedSenseBooks,
  concordance,
}: {
  reads: PageReads
  resolved: ResolvedStrongEntry
  language: ResourceLanguage
  lexicalLanguage: StrongLexicalLanguage
  classicCode: string
  senses: readonly StrongNumberSenseRef[]
  /** Where the senses are read, when it was asked for with them. */
  askedSenseBooks?: Promise<SenseBooks>
  /** The number read whole as well: its verses and the words it is translated by. */
  concordance: Promise<StrongPageConcordance | undefined>
}): Promise<StrongNumberPageData> => {
  const { simple, entry } = resolved
  const [number, books] = await Promise.all([
    concordance,
    loadSenseBooks(reads, language, lexicalLanguage, senses, askedSenseBooks),
  ])
  const read = senses.map(sense => ({
    sense,
    // The sense the number answered with was read whole, with the number.
    told:
      sense.code === resolved.code
        ? {
            brief: resolved.detailed?.entity?.brief,
            noticeHtml: resolved.detailed?.definitionHtml,
          }
        : sense,
    books: books.get(sense.code) ?? [],
  }))

  const summaries = strongSenseSummaries(
    read.map(({ sense, told }) => ({
      brief: told.brief,
      noticeHtml: told.noticeHtml,
      gloss: sense.gloss,
    }))
  )
  const listed = read
    .map(({ sense, books: senseBooks }, index): StrongNumberSense => {
      const summary = summaries[index]
      return {
        code: sense.code,
        gloss: sense.gloss,
        original: sense.original,
        transliteration: sense.transliteration,
        summary: summary ? truncateText(summary, SENSE_SUMMARY_LENGTH) : undefined,
        verseCount: senseBooks.reduce((total, count) => total + count.verseCount, 0),
        books: senseBooks.map(count => count.book),
      }
    })
    // The sense read most often comes first; the others keep the order of the lexicon.
    .sort((left, right) => right.verseCount - left.verseCount)

  const render = (html: string) =>
    renderStrongDefinitionHtml(html, { language, currentCode: classicCode })
  const nameMeaning = entry.nameMeaningHtml ?? simple?.nameMeaningHtml
  const definition = simple?.definitionHtml

  return {
    kind: 'number',
    language,
    code: classicCode,
    lexicalLanguage,
    original: entry.original,
    transliteration: entry.transliteration,
    pronunciation: entry.pronunciation ?? simple?.pronunciation,
    glosses: uniqueStrongGlosses(listed),
    nameMeaningHtml:
      hasContent(nameMeaning) && !isSameStrongDefinition(definition, nameMeaning)
        ? render(nameMeaning)
        : undefined,
    definitionHtml: hasContent(definition) ? render(definition) : undefined,
    senses: listed,
    concordance: number && {
      version: number.version,
      verseCount: number.verseCount,
      verses: number.verses,
      translations: number.translations,
    },
    incomplete: reads.incomplete || undefined,
  }
}

/**
 * The page a code names. A classical number the lexicon splits into senses has a page that
 * lists them; any other code names one sense, and is the address of its page only when it
 * is the code of that sense.
 */
export const loadStrongPage = createServerFn({ method: 'GET' })
  .validator((data: { language: string; code: string }) => data)
  .handler(async ({ data }): Promise<StrongPageAnswer> => {
    const identity = parseStrongCode(data.code)
    if (!isResourceLanguage(data.language) || !identity) throw notFound()
    const language = data.language
    const lexicalLanguage = strongLexicalLanguage(identity.code)
    // The page reads a few documents at a time, and knows what it could not read.
    const reads = createPageReads()

    // What does not depend on the entry leaves with it. Should the entry not exist, or
    // lead elsewhere, nobody waits for those answers.
    const unawaited = <Result>(read: Promise<Result>): Promise<Result> => {
      read.catch(() => undefined)
      return read
    }
    const sensesOf = (
      number: string
    ): {
      number: string
      senses: Promise<StrongNumberSenseRef[]>
      books?: Promise<SenseBooks>
    } => ({
      number,
      senses: unawaited(loadSenses(reads, language, number)),
    })
    const asked = readStrongEntryLevels(reads, identity.code, language)
    // A code with a suffix is a sense among others: its number is asked for its senses
    // while the entry is read, since nearly every sense is filed under the number it is
    // written under. A code without one seldom needs them: it asks once a level of the
    // entry has answered with a sense that has a code of its own, without waiting for the
    // other level. Such a number may be a page of senses: where they are read is asked for
    // with them, so that the page is two reads deep.
    const written = writtenNumber(identity.code)
    const earlySenses =
      written === identity.code
        ? firstStrongEntryLevel(asked).then(named => {
            const sense = parseStrongCode(named?.stepCode)?.code
            const number = parseStrongCode(named?.classicStrong)?.code
            if (!sense || !number || sense === number) return undefined
            return {
              ...sensesOf(number),
              books: unawaited(loadCandidateSenseBooks(reads, language, number, lexicalLanguage)),
            }
          })
        : Promise.resolve(sensesOf(written))
    // The verses of the code that is asked for are those of the page, whether it names a
    // sense or a number that has a page.
    const earlyConcordance = unawaited(
      loadConcordance(reads, language, identity.code, lexicalLanguage)
    )

    const resolved = await readStrongEntry(reads, identity.code, language, { asked })
    if (!resolved) throw notFound()
    const { simple, detailed, entry, code } = resolved
    const classicCode = parseStrongCode(entry.classicStrong)?.code ?? code

    // A sense that carries its classical number as its code is the page of that number.
    const early = await earlySenses
    const sensesRequest =
      code === classicCode
        ? Promise.resolve([])
        : early?.number === classicCode
          ? early.senses
          : loadSenses(reads, language, classicCode)
    if (identity.code === classicCode) {
      const senses = await sensesRequest
      if (hasStrongNumberPage(classicCode, senses)) {
        return loadNumberPage({
          reads,
          resolved,
          language,
          lexicalLanguage,
          classicCode,
          senses,
          askedSenseBooks: early?.number === classicCode ? early.books : undefined,
          concordance: earlyConcordance,
        })
      }
    }
    // A number with a single sense, or a code in another letter case: the page is the one
    // of the sense that answered, at its own address, and reads nothing more here.
    if (code !== identity.code) return { kind: 'moved', code }
    const [concordance, senses] = await Promise.all([earlyConcordance, sensesRequest])
    const numberPage = hasStrongNumberPage(classicCode, senses)
    const senseCodes = new Set(senses.map(sense => sense.code))

    const render = (html: string) =>
      renderStrongDefinitionHtml(html, { language, currentCode: code })
    const definitions = presentDefinitions(resolved)
    const nameMeaning = entry.nameMeaningHtml ?? simple?.nameMeaningHtml
    const gloss = simple?.gloss || entry.gloss
    const definitionText = definitions.essentialHtml
      ? editorialHtmlToText(definitions.essentialHtml)
      : ''

    const related = (detailed?.relations ?? []).flatMap((relation): StrongPageRelation[] => {
      const target = parseStrongCode(relation.stepCode)
      if (!target || target.code === code) return []
      // The senses of a number are told apart on its page rather than listed again here.
      if (numberPage && senseCodes.has(target.code)) return []
      return [
        {
          group: relation.group,
          label: relation.label,
          code: target.code,
          gloss: relation.gloss,
          original: relation.original,
          transliteration: relation.transliteration,
        },
      ]
    })
    // A number without a page of its own leaves its senses to list one another.
    const siblings = numberPage
      ? []
      : senses
          .filter(sense => sense.code !== code)
          .map((sense): StrongPageRelation => ({
            group: 'subentry',
            label: '',
            code: sense.code,
            gloss: sense.gloss,
            original: sense.original,
            transliteration: sense.transliteration,
          }))
    // One entry can be related in several ways (name of, same identity, derived word), and a
    // sibling sense may already be listed by the lexicon: it is shown once, under what says
    // most about it, as the study workspace does.
    const relations = [...related, ...siblings]
      .sort((left, right) => RELATION_RANK[left.group] - RELATION_RANK[right.group])
      .filter(
        (relation, index, all) => all.findIndex(other => other.code === relation.code) === index
      )

    return {
      kind: 'sense',
      language,
      code,
      classicCode,
      number: numberPage ? { code: classicCode, senseCount: senses.length } : undefined,
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
      definitionHtml: definitions.essentialHtml ? render(definitions.essentialHtml) : undefined,
      deepDefinition: definitions.deep
        ? { kind: definitions.deep.kind, html: render(definitions.deep.html) }
        : undefined,
      // A name meaning already read as a definition is not repeated.
      nameMeaningHtml:
        hasContent(nameMeaning) &&
        ![definitions.essentialHtml, definitions.deep?.html].some(html =>
          isSameStrongDefinition(html, nameMeaning)
        )
          ? render(nameMeaning)
          : undefined,
      relations,
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
      incomplete: reads.incomplete || undefined,
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
  .handler(async ({ data }): Promise<StrongConcordancePageData | StrongNumberAddress> => {
    const identity = parseStrongCode(data.code)
    if (!isResourceLanguage(data.language) || !identity) throw notFound()
    const language = data.language
    const lexicalLanguage = strongLexicalLanguage(identity.code)
    const book = data.book === undefined ? undefined : findBibleBook(data.book)
    if (data.book !== undefined && book === undefined) throw notFound()
    const page = data.page ?? 1
    if (!Number.isSafeInteger(page) || page < 1) throw notFound()
    const reads = createPageReads()

    // The books of the code that is asked for do not depend on its entry: they leave with
    // it. Should the entry not exist, nobody waits for that answer.
    const earlyBooks = loadBookCounts(reads, language, identity.code, lexicalLanguage)
    earlyBooks.catch(() => undefined)
    const resolved = await readStrongEntry(reads, identity.code, language, {
      detailedContent: 'definitions',
    })
    if (!resolved) throw notFound()
    const { simple, entry, code } = resolved
    const classicCode = parseStrongCode(entry.classicStrong)?.code ?? code
    // The verses of a number that has a page are told apart there, sense by sense.
    if (
      identity.code === classicCode &&
      code !== classicCode &&
      hasStrongNumberPage(classicCode, await loadSenses(reads, language, classicCode))
    ) {
      return { kind: 'number', code: classicCode }
    }

    const books = await (code === identity.code
      ? earlyBooks
      : loadBookCounts(reads, language, code, lexicalLanguage))
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
    const verses = await loadOccurrences(reads, language, code, lexicalLanguage, {
      book,
      startBook,
      skip,
      take: CONCORDANCE_PAGE_SIZE,
    })

    return {
      language,
      code,
      classicCode,
      lexicalLanguage,
      original: entry.original,
      transliteration: entry.transliteration,
      gloss: simple?.gloss || entry.gloss,
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
  /** The code of the sense that answered, which names its page. */
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

    const resolved = await readStrongEntry(createPageReads(), identity.code, language, {
      detailedContent: 'definitions',
    })
    if (!resolved) throw notFound()
    const { simple, entry, code } = resolved
    // The card shows what the entry page reads first.
    const definition = presentDefinitions(resolved).essentialHtml

    // A preview is as stable as the entry page, so the CDN may keep it as long.
    setResponseHeader('Cache-Control', RESOURCE_PAGE_CACHE_CONTROL)
    return {
      code,
      original: entry.original,
      transliteration: entry.transliteration,
      pronunciation: entry.pronunciation ?? simple?.pronunciation,
      gloss: simple?.gloss || entry.gloss,
      morphology: (entry.morphology ?? simple?.morphology)?.meaning,
      definitionHtml: definition
        ? renderStrongDefinitionHtml(definition, { language, currentCode: code })
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
// A letter holds a few thousand senses at most; the cap only guards a cursor loop.
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
    ...EVERY_STRONG_SENSE,
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

export type StrongListEntry = StrongListLine

export type StrongLetterPageData = {
  language: ResourceLanguage
  lexicon: StrongLexicalLanguage
  letter: string
  letters: string[]
  entries: StrongListEntry[]
}

/** The entries of a lexicon whose gloss starts with a letter, a line per number and gloss. */
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
        const response = await browseSimpleLexicon(language, lexicon, {
          prefix,
          limit: 500,
          cursor,
        })
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

    // The senses of one classical number have their own glosses, and may be filed under
    // different letters; those that read the same are gathered under their number.
    const byCode = new Map<string, StrongSenseRef>()
    for (const entry of lists.flat()) {
      const sense = toStrongSenseRef(entry)
      if (sense && !byCode.has(sense.code)) byCode.set(sense.code, sense)
    }
    const entries = groupStrongListLines([...byCode.values()]).sort(
      (left, right) =>
        left.gloss.localeCompare(right.gloss, language, { sensitivity: 'base' }) ||
        left.code.localeCompare(right.code)
    )
    if (!entries.length) throw notFound()

    return { language, lexicon, letter, letters, entries }
  })
