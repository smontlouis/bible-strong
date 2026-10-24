import type { BibleVerseTextsDto } from '@bible-strong/resource-domain/contracts/bibleChapterContract'
import type {
  StrongBibleCountsDto,
  StrongBibleLemmaStatsDto,
  StrongBibleOccurrencesDto,
} from '@bible-strong/resource-domain/contracts/strongBibleContract'
import type { StrongLexiconEntryDto } from '@bible-strong/resource-domain/contracts/strongLexiconContract'
import { presentStrongDefinitions } from '@bible-strong/resource-domain/strong-definition-presentation'
import * as z from 'zod/v4'
import { bookName } from '../bible/books'
import { quoteText } from '../bible/layout'
import {
  findReferences,
  formatVerse,
  parsePassages,
  verseKey,
  verseOsis,
} from '../bible/reference'
import {
  defaultStrongVersionId,
  findVersion,
  hasStrongNumbers,
  versionName,
} from '../bible/versions'
import type {
  MarkedPart,
  StrongEntryCard,
  StrongOccurrencesCard,
  StrongSummary,
  VerseHit,
} from '../cards/types'
import type { StudyLanguage } from '../language'
import {
  blocksToText,
  editorialLinks,
  htmlToBlocks,
  truncateText,
  withReferences,
} from '../richText'
import {
  anchorBook,
  parseStrongCode,
  requireStrongCode,
  sameStrongCode,
  strongCodeInput,
  strongCodeSpellings,
  type StrongCode,
} from '../strong/codes'
import { findLexiconEntries } from '../strong/search'
import {
  languageInput,
  lines,
  sourceLine,
  StudyError,
  type StudyContext,
  type StudyResult,
} from '../study'

const DEFINITION_LENGTH = 4000
const TRANSLATION_COUNT = 8
const RELATED_COUNT = 8

// --- The entry -----------------------------------------------------------------

export const strongEntryInput = {
  code: strongCodeInput,
  language: languageInput,
}

const strongSummary = z.object({
  code: z.string(),
  original: z.string(),
  transliteration: z.string(),
  gloss: z.string(),
})

export const strongEntryOutput = z.object({
  code: z.string().describe('The entry as the lexicon names it, such as G0026.'),
  number: z.string().describe('The classical Strong number, such as G26.'),
  originalLanguage: z.enum(['hebrew', 'greek']),
  original: z.string(),
  transliteration: z.string(),
  pronunciation: z.string().optional(),
  gloss: z.string().describe('The short translation of the word.'),
  morphology: z.string().optional(),
  definition: z.string(),
  translations: z
    .array(z.object({ word: z.string(), verses: z.number() }))
    .describe('The words a Bible renders it by, with the number of verses for each.'),
  occurrences: z
    .object({ version: z.string(), verses: z.number() })
    .optional()
    .describe('How many verses hold the word in the Bible of the answer language.'),
  related: z.array(strongSummary),
  url: z.string().optional(),
})

type StrongEntryModel = z.infer<typeof strongEntryOutput>

type ResolvedEntry = {
  simple?: StrongLexiconEntryDto
  detailed?: StrongLexiconEntryDto
  entry: StrongLexiconEntryDto
  code: StrongCode
}

/**
 * Reads the entry a code names at both reading levels: the classic short definition and
 * the detailed lexicon. A classical number answers with the first sense of its family.
 */
const readEntry = async (
  context: StudyContext,
  asked: StrongCode,
  language: StudyLanguage
): Promise<ResolvedEntry | undefined> => {
  for (const spelling of strongCodeSpellings(asked.code)) {
    const path = `/v1/strong-lexicon/entries/${encodeURIComponent(spelling)}`
    const [simple, detailed] = await Promise.all([
      context.api.get<StrongLexiconEntryDto>(path, { language, level: 'simple' }),
      context.api.get<StrongLexiconEntryDto>(path, { language }),
    ])
    const entry = detailed ?? simple
    if (entry) {
      return { simple, detailed, entry, code: parseStrongCode(entry.stepCode) ?? asked }
    }
  }
  return undefined
}

const identityPath = (version: string, code: StrongCode, book = anchorBook(code.lexicon)) =>
  `/v1/strong-bibles/${version}/books/${book}/identities/${encodeURIComponent(code.code)}`

/** The words a Bible renders an entry by. A word the translators supplied is in braces. */
const readTranslations = async (context: StudyContext, version: string, code: StrongCode) => {
  const stats = await context.api
    .get<StrongBibleLemmaStatsDto>(`${identityPath(version, code)}/lemmas`)
    .catch(() => undefined)
  const counts = new Map<string, number>()
  for (const { lemma, occurrenceCount } of stats?.lemmas ?? []) {
    const word = lemma.replace(/[{}]/gu, '').trim()
    // A single letter is the remains of an elision, not a translation.
    if (word.length > 1) counts.set(word, (counts.get(word) ?? 0) + occurrenceCount)
  }
  return [...counts]
    .map(([word, count]) => ({ word, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, TRANSLATION_COUNT)
}

const readCounts = (context: StudyContext, version: string, code: StrongCode) =>
  context.api
    .get<StrongBibleCountsDto>(`${identityPath(version, code)}/counts`)
    .catch(() => undefined)

const totalVerses = (counts: StrongBibleCountsDto | undefined): number | undefined => {
  const total = counts?.counts.reduce((sum, count) => sum + count.verseCount, 0)
  return total || undefined
}

export const loadStrongEntry = async (
  context: StudyContext,
  input: { code: string; language?: StudyLanguage }
): Promise<StudyResult<StrongEntryModel>> => {
  const language = input.language ?? context.language
  const asked = requireStrongCode(input.code)
  const resolved = await readEntry(context, asked, language)
  if (!resolved) {
    throw new StudyError(
      `The lexicon has no entry ${asked.label}. search_strong_lexicon finds the number of a word.`
    )
  }
  const { simple, detailed, entry, code } = resolved
  const version = defaultStrongVersionId(language)
  const [translations, counts] = await Promise.all([
    readTranslations(context, version, code),
    readCounts(context, version, code),
  ])

  // The reading order of the two definitions is the one of the application.
  const definitions = presentStrongDefinitions({
    definitionHtml: simple?.definitionHtml,
    detailedDefinitionHtml: detailed?.definitionHtml,
    gloss: simple?.gloss || entry.gloss,
    stepCode: entry.stepCode,
    eStrong: entry.eStrong,
    classicStrong: entry.classicStrong,
    relations: [...(detailed?.relations ?? [])],
    language: entry.language,
  })
  // The lexicon indents the senses of a word with underscores.
  const read = (html: string) =>
    withReferences(
      htmlToBlocks(html.replace(/_{2,}/gu, '').replace(/^\s*:\s*/u, ''), editorialLinks()),
      text => findReferences(text, language)
    )
  const definition = read(definitions.essentialHtml ?? '')
  const more = definitions.deep ? read(definitions.deep.html) : []

  const related: StrongSummary[] = []
  for (const relation of detailed?.relations ?? []) {
    const relatedCode = parseStrongCode(relation.stepCode)
    if (!relatedCode || relatedCode.code === code.code) continue
    if (related.some(item => item.code === relatedCode.code)) continue
    related.push({
      code: relatedCode.code,
      label: relatedCode.label,
      original: relation.original,
      transliteration: relation.transliteration,
      gloss: relation.gloss,
    })
    if (related.length === RELATED_COUNT) break
  }

  const gloss = simple?.gloss || entry.gloss
  const verses = totalVerses(counts)
  const url = context.links.strong(language, code.code)
  const title = `${entry.original} · ${entry.transliteration}`

  const card: StrongEntryCard = {
    kind: 'strong_entry',
    language,
    title,
    code: code.code,
    label: code.label,
    lexicon: entry.language,
    original: entry.original,
    transliteration: entry.transliteration,
    ...(entry.pronunciation ? { pronunciation: entry.pronunciation } : {}),
    gloss,
    ...(entry.morphology?.meaning ? { morphology: entry.morphology.meaning } : {}),
    definition,
    ...(more.length ? { more } : {}),
    translations,
    ...(verses ? { occurrences: { version, verses } } : {}),
    related,
    ...(detailed?.entity
      ? {
          entity: {
            uniqueName: detailed.entity.uniqueName,
            name: detailed.entity.name,
            brief: detailed.entity.brief || detailed.entity.shortDescription,
          },
        }
      : {}),
    url,
    concordanceUrl: context.links.concordance(language, code.code),
  }

  const definitionText = truncateText(
    [blocksToText(definition), blocksToText(more)].filter(Boolean).join('\n\n'),
    DEFINITION_LENGTH
  )

  return {
    text: lines(
      `${code.label} — ${entry.original} (${entry.transliteration}) — ${gloss}`,
      `${entry.language === 'hebrew' ? 'Hebrew' : 'Greek'}` +
        (entry.morphology?.meaning ? `, ${entry.morphology.meaning}` : '') +
        (entry.pronunciation ? `. Pronounced ${entry.pronunciation}` : ''),
      '',
      definitionText,
      '',
      translations.length
        ? `Rendered in ${version} by: ${translations
            .map(translation => `${translation.word} (${translation.count})`)
            .join(', ')}`
        : undefined,
      verses ? `Found in ${verses} verses of ${version}.` : undefined,
      related.length
        ? `Related: ${related.map(item => `${item.label} ${item.original} (${item.gloss})`).join('; ')}`
        : undefined,
      sourceLine(url)
    ),
    model: {
      code: code.code,
      number: code.label,
      originalLanguage: entry.language,
      original: entry.original,
      transliteration: entry.transliteration,
      ...(entry.pronunciation ? { pronunciation: entry.pronunciation } : {}),
      gloss,
      ...(entry.morphology?.meaning ? { morphology: entry.morphology.meaning } : {}),
      definition: definitionText,
      translations: translations.map(({ word, count }) => ({ word, verses: count })),
      ...(verses ? { occurrences: { version, verses } } : {}),
      related: related.map(({ code: relatedCode, original, transliteration, gloss: meaning }) => ({
        code: relatedCode,
        original,
        transliteration,
        gloss: meaning,
      })),
      url,
    },
    card,
  }
}

// --- Finding an entry ----------------------------------------------------------

export const strongSearchInput = {
  query: z
    .string()
    .min(1)
    .max(80)
    .describe(
      'A word to find in the lexicon: its translation ("amour", "love"), its transliteration ' +
        '("agape", "hesed") or the Hebrew or Greek word itself.'
    ),
  originalLanguage: z
    .enum(['hebrew', 'greek'])
    .optional()
    .describe('Only Hebrew (Old Testament) or only Greek (New Testament) words.'),
  limit: z.number().int().min(1).max(30).optional().describe('Entries to return (default 12).'),
  language: languageInput,
}

export const strongSearchOutput = z.object({
  query: z.string(),
  entries: z.array(strongSummary.extend({ originalLanguage: z.enum(['hebrew', 'greek']) })),
})

export const loadStrongSearch = async (
  context: StudyContext,
  input: {
    query: string
    originalLanguage?: 'hebrew' | 'greek'
    limit?: number
    language?: StudyLanguage
  }
): Promise<StudyResult<z.infer<typeof strongSearchOutput>>> => {
  const language = input.language ?? context.language
  const query = input.query.trim()
  const found = await findLexiconEntries(context.api, {
    query,
    language,
    originalLanguage: input.originalLanguage,
    limit: input.limit ?? 12,
  })
  const entries = found.flatMap(entry => {
    const code = parseStrongCode(entry.stepCode)
    return code
      ? [
          {
            code: code.code,
            original: entry.original,
            transliteration: entry.transliteration,
            gloss: entry.gloss,
            originalLanguage: entry.language,
          },
        ]
      : []
  })
  return {
    text: entries.length
      ? entries
          .map(
            entry =>
              `${entry.code} — ${entry.original} (${entry.transliteration}) — ${entry.gloss} [${entry.originalLanguage}]`
          )
          .join('\n')
      : `The lexicon has no word matching "${query}". Try its translation or its transliteration.`,
    model: { query, entries },
  }
}

// --- The verses holding a word ---------------------------------------------------

const DEFAULT_OCCURRENCES = 10
const MAX_OCCURRENCES = 30

export const strongOccurrencesInput = {
  code: strongCodeInput,
  version: z
    .string()
    .min(2)
    .max(32)
    .optional()
    .describe(
      'A Bible whose words carry Strong numbers: LSG, DBY or DBR in French; KJV, NASB2020, ' +
        'NASB1995, BSB, ASV, DARBY, RLT, RWEBSTER or RV1895 in English. Defaults to LSG or KJV.'
    ),
  book: z.string().max(40).optional().describe('Only the verses of one book, by its name.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_OCCURRENCES)
    .optional()
    .describe(`Verses to return (default ${DEFAULT_OCCURRENCES}).`),
  cursor: z
    .string()
    .max(64)
    .optional()
    .describe('The `nextCursor` of a previous answer, to read the following verses.'),
  language: languageInput,
}

export const strongOccurrencesOutput = z.object({
  code: z.string(),
  version: z.string(),
  totalVerses: z.number().optional().describe('Verses holding the word, in the Bible or in the book asked.'),
  byBook: z
    .array(z.object({ book: z.string(), verses: z.number() }))
    .optional()
    .describe('The books holding the word most often.'),
  occurrences: z.array(
    z.object({
      reference: z.string(),
      osis: z.string(),
      text: z.string(),
      words: z.array(z.string()).describe('The words of the verse that translate the entry.'),
    })
  ),
  nextCursor: z.string().optional(),
  url: z.string().optional(),
})

type OccurrencesModel = z.infer<typeof strongOccurrencesOutput>

type Span = StrongBibleOccurrencesDto['verses'][number]['spans'][number]

/** Cuts a verse where the words tagged with the entry start and end. */
const markSpans = (text: string, spans: readonly Span[], code: string): MarkedPart[] => {
  const matches = spans
    .filter(span => span.length > 0 && span.identities.some(identity => sameStrongCode(identity.code, code)))
    .sort((left, right) => left.startOffset - right.startOffset)
  const parts: MarkedPart[] = []
  let position = 0
  for (const span of matches) {
    const end = span.startOffset + span.length
    // Spans that overlap or leave the text were built for another text: nothing is marked.
    if (span.startOffset < position || end > text.length) return [{ text }]
    if (span.startOffset > position) parts.push({ text: text.slice(position, span.startOffset) })
    parts.push({ text: text.slice(span.startOffset, end), hit: true })
    position = end
  }
  if (position < text.length) parts.push({ text: text.slice(position) })
  return parts
}

export const loadStrongOccurrences = async (
  context: StudyContext,
  input: {
    code: string
    version?: string
    book?: string
    limit?: number
    cursor?: string
    language?: StudyLanguage
  }
): Promise<StudyResult<OccurrencesModel>> => {
  const language = input.language ?? context.language
  const asked = requireStrongCode(input.code)
  const version = findVersion(input.version ?? defaultStrongVersionId(language))
  if (!version || !hasStrongNumbers(version.id)) {
    throw new StudyError(
      `${input.version} carries no Strong numbers. Use LSG, DBY or DBR in French; KJV, ` +
        'NASB2020, NASB1995, BSB, ASV, DARBY, RLT, RWEBSTER or RV1895 in English.'
    )
  }
  const book = input.book ? parsePassages(`${input.book} 1`, language)[0]?.book : undefined
  if (input.book && !book) {
    throw new StudyError(`"${input.book}" is not the name of a book of the Bible.`)
  }
  const limit = input.limit ?? DEFAULT_OCCURRENCES

  // The entry names the word; the lexicon may also know the code under another letter case.
  const resolved = await readEntrySummary(context, asked, language)
  const code = resolved?.code ?? asked
  const path = identityPath(version.id, code, book)

  const [found, counts] = await Promise.all([
    context.api.get<StrongBibleOccurrencesDto>(`${path}/occurrences`, {
      limit,
      cursor: input.cursor,
      allBooks: book ? 'false' : 'true',
    }),
    readCounts(context, version.id, code),
  ])
  const matched = found?.identity?.code ?? code.code
  const located = found?.verses ?? []

  const texts = located.length
    ? await context.api.get<BibleVerseTextsDto>(`/v1/bibles/${version.id}/verses`, {
        references: located.map(verse => verseKey(verse)).join(','),
      })
    : undefined
  const textOf = new Map(
    (texts?.verses ?? []).map(verse => [
      verseKey({ book: verse.book, chapter: verse.chapter, verse: verse.number }),
      verse.text,
    ])
  )

  const items = located.flatMap(verse => {
    const text = textOf.get(verseKey(verse))
    if (!text) return []
    const parts = markSpans(text, verse.spans, matched)
    const hit: VerseHit = {
      label: formatVerse(verse, language),
      osis: verseOsis(verse),
      parts,
    }
    return [{ hit, text: quoteText(text), words: parts.filter(part => part.hit).map(part => part.text) }]
  })

  const total = book
    ? counts?.counts.find(count => count.book === book)?.verseCount
    : totalVerses(counts)
  const byBook = [...(counts?.counts ?? [])]
    .sort((left, right) => right.verseCount - left.verseCount)
    .slice(0, 8)
    .map(count => ({ book: bookName(count.book, language), verses: count.verseCount }))

  const url = context.links.concordance(language, code.code)
  const original = resolved?.entry.original ?? ''
  const gloss = resolved?.entry.gloss ?? ''
  const request = { code: code.code, version: version.id, book: input.book, limit, language }

  const card: StrongOccurrencesCard = {
    kind: 'strong_occurrences',
    language,
    title: original ? `${original} · ${code.label}` : code.label,
    code: code.code,
    label: code.label,
    original,
    gloss,
    version: version.id,
    versionName: versionName(version, language),
    ...(total ? { total } : {}),
    ...(book ? { scope: bookName(book, language) } : {}),
    items: items.map(({ hit }) => hit),
    ...(found?.nextCursor ? { next: { ...request, cursor: found.nextCursor } } : {}),
    url,
  }

  return {
    text: items.length
      ? lines(
          `${code.label}${original ? ` ${original}` : ''}${gloss ? ` (${gloss})` : ''} — ` +
            (total ? `${total} verses` : 'verses') +
            ` in ${version.id}${book ? `, ${bookName(book, language)}` : ''}.`,
          !book && byBook.length
            ? `Most frequent in: ${byBook.map(item => `${item.book} (${item.verses})`).join(', ')}`
            : undefined,
          '',
          ...items.map(
            ({ hit, text, words }) =>
              `${hit.label} — ${text}${words.length ? ` [${words.join(', ')}]` : ''}`
          ),
          found?.nextCursor ? `More verses follow: pass cursor "${found.nextCursor}".` : undefined,
          sourceLine(url)
        )
      : `No verse of ${version.id}${book ? ` in ${bookName(book, language)}` : ''} holds ${code.label}.`,
    model: {
      code: code.code,
      version: version.id,
      ...(total ? { totalVerses: total } : {}),
      ...(!book && byBook.length ? { byBook } : {}),
      occurrences: items.map(({ hit, text, words }) => ({
        reference: hit.label,
        osis: hit.osis,
        text,
        words,
      })),
      ...(found?.nextCursor ? { nextCursor: found.nextCursor } : {}),
      url,
    },
    card,
  }
}

/** The word of an entry, without its definitions: what names a list of its verses. */
const readEntrySummary = async (
  context: StudyContext,
  asked: StrongCode,
  language: StudyLanguage
): Promise<{ entry: StrongLexiconEntryDto; code: StrongCode } | undefined> => {
  for (const spelling of strongCodeSpellings(asked.code)) {
    const entry = await context.api
      .get<StrongLexiconEntryDto>(`/v1/strong-lexicon/entries/${encodeURIComponent(spelling)}`, {
        language,
        level: 'simple',
      })
      .catch(() => undefined)
    if (entry) return { entry, code: parseStrongCode(entry.stepCode) ?? asked }
  }
  return undefined
}
