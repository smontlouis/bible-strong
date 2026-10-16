import {
  COMMENTARY_CATALOG,
  getCommentaryCatalogForLanguage,
  type CommentaryCatalogEntry,
} from '@bible-strong/resource-catalog/commentaries'
import type { BibleVerseTextsDto } from '@bible-strong/resource-domain/contracts/bibleChapterContract'
import type {
  CommentaryVerseSectionsResponseDto,
  CrossReferenceResponseDto,
} from '@bible-strong/resource-domain/contracts/supplementaryContract'
import * as z from 'zod/v4'
import { BOOK_COUNT } from '../bible/books'
import { quoteText } from '../bible/layout'
import {
  findReferences,
  formatPassage,
  formatVerse,
  parseVerseKey,
  verseKey,
  verseOsis,
  type VerseLocation,
} from '../bible/reference'
import { defaultVersionId } from '../bible/versions'
import type { CommentariesCard, CrossReferencesCard } from '../cards/types'
import type { StudyLanguage } from '../language'
import {
  blocksToText,
  editorialLinks,
  htmlToBlocks,
  truncateText,
  withReferences,
} from '../richText'
import {
  languageInput,
  lines,
  referenceInput,
  sourceLine,
  StudyError,
  type StudyContext,
  type StudyResult,
} from '../study'
import { requirePassages, resolveVersions } from './passage'

const COMMENT_LENGTH = 2500
const MAX_COMMENTARIES = 10

// The commentaries read when none is named: whole-Bible ones of several traditions, then
// the ones that cover a testament or a book. Any other is read by naming it.
const GENERAL: Record<StudyLanguage, readonly string[]> = {
  fr: ['bible-annotee', 'mhy-fr', 'barnes', 'acbc', 'aquifer-fr', 'fre-chry', 'fre-aug'],
  en: ['mhcc', 'barnes', 'jfb', 'acbc', 'aquifer-fr', 'calvin', 'wesley', 'geneva-notes'],
}

const defaultCommentaries = (language: StudyLanguage, book: number): string[] => {
  if (language === 'fr') return [...GENERAL.fr]
  const specific = book === 19 ? ['treasury-david', 'kd'] : book <= 39 ? ['kd'] : ['rwp']
  return [...GENERAL.en, ...specific].slice(0, MAX_COMMENTARIES)
}

const catalog: readonly CommentaryCatalogEntry[] = COMMENTARY_CATALOG

const findCommentary = (value: string, language: StudyLanguage) => {
  const wanted = value.trim().toLowerCase()
  return catalog.find(
    entry =>
      entry.languages.includes(language) &&
      (entry.id === wanted ||
        entry.publicationId.toLowerCase() === wanted ||
        entry.shortName.toLowerCase() === wanted)
  )
}

/**
 * Commentaries come from several markup traditions (OSIS, GBF, ThML). Their own elements
 * are rewritten into formatting a card draws, as the public site does
 * (apps/site/features/commentary/commentaryHtml.ts). Names are matched with their case:
 * GBF closes `<FI>` with `<Fi>`.
 */
const DIALECT_REWRITES: readonly (readonly [RegExp, string])[] = [
  [/<a\b[^>]*\bclass=(?:"[^"]*\bexternal-source\b[^"]*"|'[^']*\bexternal-source\b[^']*')[^>]*>[\s\S]*?<\/a>/giu, ''],
  [/&amp;(nbsp|#\d+|#x[0-9a-f]+);/giu, '&$1;'],
  [/<FI>/gu, '<i>'],
  [/<Fi>/gu, '</i>'],
  [/<FB>/gu, '<b>'],
  [/<Fb>/gu, '</b>'],
  [/<FU>#?/gu, ''],
  [/\|?<Fu>/gu, ''],
  [/<catchWord\b[^>]*>/gu, '<b>'],
  [/<\/catchWord>/gu, '</b>'],
  [/<note\b[^>]*>\s*/gu, ' ('],
  [/\s*<\/note>/gu, ')'],
  [/<item\b[^>]*>/gu, '<p>'],
  [/<\/item>/gu, '</p>'],
  [/<lb\b[^>]*>/gu, '<br>'],
  [/<mn\b[^>]*>/gu, '<sup>'],
  [/<\/mn>/gu, '</sup>'],
  [/<w\b[^>]*\blemma="strong:([HG]\d+)"[^>]*>([^<]*)<\/w>/gu, '<a href="strong://$1">$2</a>'],
  [/<span>(\d{1,3})<\/span>/gu, '<sup>$1</sup>'],
]

const commentToBlocks = (html: string, language: StudyLanguage) => {
  let source = html
  for (const [pattern, replacement] of DIALECT_REWRITES) {
    source = source.replace(pattern, replacement)
  }
  return withReferences(htmlToBlocks(source, editorialLinks()), text =>
    findReferences(text, language)
  )
}

// --- What commentaries say on a verse ---------------------------------------------

export const commentariesInput = {
  reference: referenceInput('The verse to read commentaries on'),
  commentaries: z
    .array(z.string().min(2).max(64))
    .min(1)
    .max(MAX_COMMENTARIES)
    .optional()
    .describe(
      'Commentaries to read, by the `id` list_commentaries returns: ["barnes", "calvin"]. ' +
        'Defaults to a set of whole-Bible commentaries of several traditions.'
    ),
  language: languageInput,
}

export const commentariesOutput = z.object({
  reference: z.string(),
  osis: z.string(),
  verse: z.string().optional().describe('The text of the verse.'),
  comments: z.array(
    z.object({
      commentary: z.string().describe('The id of the commentary.'),
      title: z.string(),
      author: z.string(),
      covers: z.string().describe('The verses this comment covers.'),
      text: z.string(),
      url: z.string().optional(),
    })
  ),
  silent: z
    .array(z.string())
    .describe('Commentaries asked for that say nothing on this verse.'),
})

type CommentariesModel = z.infer<typeof commentariesOutput>

export const loadCommentaries = async (
  context: StudyContext,
  input: { reference: string; commentaries?: string[]; language?: StudyLanguage }
): Promise<StudyResult<CommentariesModel>> => {
  const language = input.language ?? context.language
  const passage = requirePassages(input.reference, language)[0]!
  const verse: VerseLocation = {
    book: passage.book,
    chapter: passage.chapter,
    verse: passage.startVerse,
  }
  const asked = (input.commentaries ?? defaultCommentaries(language, verse.book)).map(id => {
    const entry = findCommentary(id, language)
    if (!entry) {
      throw new StudyError(
        `"${id}" is not a commentary read in ${language === 'fr' ? 'French' : 'English'}. ` +
          'list_commentaries gives their ids.'
      )
    }
    return entry
  })
  const entries = [...new Map(asked.map(entry => [entry.id, entry])).values()]
  const version = defaultVersionId(language)

  const [response, verseText] = await Promise.all([
    context.api.get<CommentaryVerseSectionsResponseDto>(
      `/v1/commentaries/verses/${verseKey(verse)}/sections`,
      { language, commentaries: entries.map(entry => entry.publicationId).join(',') }
    ),
    context.api
      .get<BibleVerseTextsDto>(`/v1/bibles/${version}/verses`, { references: verseKey(verse) })
      .catch(() => undefined),
  ])

  const reference = formatVerse(verse, language)
  const items = (response?.sections ?? []).flatMap(section => {
    const entry = entries.find(item => item.publicationId === section.resource.resourceId)
    if (!entry) return []
    const body = commentToBlocks(section.content, language)
    if (!body.length) return []
    return [
      {
        entry,
        body,
        range: formatPassage(
          {
            book: verse.book,
            chapter: verse.chapter,
            startVerse: section.startVerse,
            endVerse: section.endVerse,
            wholeChapter: false,
          },
          language
        ),
        url: context.links.commentarySection(
          language,
          entry.id,
          verse.book,
          verse.chapter,
          section.slug
        ),
      },
    ]
  })
  const silent = entries
    .filter(entry => !items.some(item => item.entry.id === entry.id))
    .map(entry => entry.id)
  const quoted = verseText?.verses[0]?.text ? quoteText(verseText.verses[0].text) : undefined

  const card: CommentariesCard = {
    kind: 'commentaries',
    language,
    title: reference,
    osis: verseOsis(verse),
    ...(quoted ? { verse: { version, text: quoted } } : {}),
    items: items.map(({ entry, body, range, url }) => ({
      id: entry.id,
      name: entry.title,
      author: entry.author,
      range,
      body,
      url,
    })),
  }

  const comments = items.map(({ entry, body, range, url }) => ({
    commentary: entry.id,
    title: entry.title,
    author: entry.author,
    covers: range,
    text: truncateText(blocksToText(body), COMMENT_LENGTH),
    url,
  }))

  return {
    text: comments.length
      ? lines(
          quoted ? `${reference} (${version}) — ${quoted}` : reference,
          '',
          ...comments.flatMap(comment => [
            `## ${comment.title} — ${comment.author} (${comment.covers})`,
            comment.text,
            sourceLine(comment.url),
            '',
          ])
        )
      : `None of these commentaries says anything on ${reference}: ${silent.join(', ')}. ` +
        'list_commentaries gives others.',
    model: {
      reference,
      osis: verseOsis(verse),
      ...(quoted ? { verse: quoted } : {}),
      comments,
      silent,
    },
    card,
  }
}

// --- The commentaries ------------------------------------------------------------

export const commentaryListInput = { language: languageInput }

export const commentaryListOutput = z.object({
  commentaries: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      author: z.string(),
      description: z.string(),
    })
  ),
})

export const loadCommentaryList = async (
  context: StudyContext,
  input: { language?: StudyLanguage }
): Promise<StudyResult<z.infer<typeof commentaryListOutput>>> => {
  const language = input.language ?? context.language
  const commentaries = getCommentaryCatalogForLanguage(language).map(
    (entry: CommentaryCatalogEntry) => ({
      id: entry.id,
      title: entry.title,
      author: entry.author,
      description: entry.description[language] ?? entry.description.fr ?? entry.description.en ?? '',
    })
  )
  return {
    text: commentaries
      .map(entry => `${entry.id} — ${entry.title}, ${entry.author}. ${entry.description}`)
      .join('\n'),
    model: { commentaries },
  }
}

// --- Cross-references ------------------------------------------------------------

const MAX_REFERENCES = 30

export const crossReferencesInput = {
  reference: referenceInput('The verse whose cross-references to read'),
  version: z
    .string()
    .min(2)
    .max(32)
    .optional()
    .describe('Bible version code the referenced verses are quoted in. Defaults to LSG or KJV.'),
  language: languageInput,
}

export const crossReferencesOutput = z.object({
  reference: z.string(),
  osis: z.string(),
  version: z.string(),
  verse: z.string().optional(),
  groups: z.array(
    z.object({
      phrase: z
        .string()
        .optional()
        .describe('The words of the verse these references are filed under, in English.'),
      references: z.array(
        z.object({ reference: z.string(), osis: z.string(), text: z.string().optional() })
      ),
    })
  ),
  url: z.string().optional(),
})

export const loadCrossReferences = async (
  context: StudyContext,
  input: { reference: string; version?: string; language?: StudyLanguage }
): Promise<StudyResult<z.infer<typeof crossReferencesOutput>>> => {
  const language = input.language ?? context.language
  const passage = requirePassages(input.reference, language)[0]!
  const verse: VerseLocation = {
    book: passage.book,
    chapter: passage.chapter,
    verse: passage.startVerse,
  }
  const version = resolveVersions(input.version ? [input.version] : undefined, language)[0]!
  const reference = formatVerse(verse, language)

  // The list is the same in every language, and is published under the French one.
  const response = await context.api.get<CrossReferenceResponseDto>(
    `/v1/cross-references/fr/verses/${verseKey(verse)}`
  )

  // The list mixes the words of the verse that head a group with the verses of the group.
  const groups: { phrase?: string; verses: VerseLocation[] }[] = []
  let kept = 0
  for (const item of response?.references ?? []) {
    const location = parseVerseKey(item)
    // A verse the list names wrongly (`0-3-4`) is neither a verse nor words of this one.
    if (!location && /^\d+-\d+-\d+$/u.test(item.trim())) continue
    if (!location) {
      groups.push({ phrase: item.replace(/[.:]\s*$/u, '').trim(), verses: [] })
      continue
    }
    if (location.book > BOOK_COUNT || kept === MAX_REFERENCES) continue
    if (!groups.length) groups.push({ verses: [] })
    groups.at(-1)!.verses.push(location)
    kept += 1
  }
  const filled = groups.filter(group => group.verses.length)
  if (!filled.length) {
    throw new StudyError(`${reference} has no cross-reference.`)
  }

  const keys = [verse, ...filled.flatMap(group => group.verses)].map(verseKey)
  const texts = await context.api
    .get<BibleVerseTextsDto>(`/v1/bibles/${version.id}/verses`, {
      references: [...new Set(keys)].join(','),
    })
    .catch(() => undefined)
  const textOf = new Map(
    (texts?.verses ?? []).map(item => [
      verseKey({ book: item.book, chapter: item.chapter, verse: item.number }),
      quoteText(item.text),
    ])
  )
  const quoted = textOf.get(verseKey(verse))
  const url = context.links.passage(version.id, {
    book: verse.book,
    chapter: verse.chapter,
    startVerse: verse.verse,
    endVerse: verse.verse,
    wholeChapter: false,
  })

  const shaped = filled.map(group => ({
    ...(group.phrase ? { phrase: group.phrase } : {}),
    items: group.verses.map(location => ({
      label: formatVerse(location, language),
      osis: verseOsis(location),
      ...(textOf.has(verseKey(location)) ? { text: textOf.get(verseKey(location)) } : {}),
    })),
  }))

  const card: CrossReferencesCard = {
    kind: 'cross_references',
    language,
    title: reference,
    osis: verseOsis(verse),
    version: version.id,
    ...(quoted ? { verse: quoted } : {}),
    groups: shaped,
    url,
  }

  return {
    text: lines(
      quoted ? `${reference} (${version.id}) — ${quoted}` : reference,
      '',
      ...shaped.flatMap(group => [
        group.phrase ? `On "${group.phrase}":` : undefined,
        ...group.items.map(item => `${item.label}${item.text ? ` — ${item.text}` : ''}`),
        '',
      ]),
      sourceLine(url)
    ),
    model: {
      reference,
      osis: verseOsis(verse),
      version: version.id,
      ...(quoted ? { verse: quoted } : {}),
      groups: shaped.map(group => ({
        ...(group.phrase ? { phrase: group.phrase } : {}),
        references: group.items.map(item => ({
          reference: item.label,
          osis: item.osis,
          ...(item.text ? { text: item.text } : {}),
        })),
      })),
      url,
    },
    card,
  }
}
