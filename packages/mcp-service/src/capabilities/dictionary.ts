import type {
  DictionaryCatalogResponseDto,
  DictionaryDirectoryResponseDto,
  DictionaryEntryResponseDto,
} from '@bible-strong/resource-domain/contracts/dictionaryContract'
import * as z from 'zod/v4'
import { findReferences } from '../bible/reference'
import type { DictionaryEntryCard, DictionarySource } from '../cards/types'
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
  sourceLine,
  StudyError,
  type StudyContext,
  type StudyResult,
} from '../study'

const ARTICLE_LENGTH = 6000

// The dictionary an article is read in when several hold it, most complete first.
const PREFERRED_WORKS: Record<StudyLanguage, readonly string[]> = {
  fr: ['westphal', 'bost', 'lelievre', 'calmet'],
  en: ['easton-webster', 'smith', 'isbe', 'unfoldingword-translation-words'],
}

const source = z.object({
  dictionary: z.string().describe('The dictionary, for the `dictionary` input of get_dictionary_entry.'),
  dictionaryTitle: z.string(),
  entryId: z.number(),
  word: z.string(),
})

const preferenceOf = (language: StudyLanguage, work: string): number => {
  const rank = PREFERRED_WORKS[language].indexOf(work)
  return rank === -1 ? PREFERRED_WORKS[language].length : rank
}

type DirectoryItem = DictionaryDirectoryResponseDto['items'][number]

/** The articles of one notion written in a language, the preferred dictionary first. */
const sourcesOf = (item: DirectoryItem, language: StudyLanguage): DictionarySource[] =>
  item.sources
    .filter(entry => entry.resource.language === language)
    .map(entry => ({
      work: entry.resource.work,
      workTitle: entry.title,
      entryId: entry.id,
      word: entry.word,
    }))
    .sort((left, right) => preferenceOf(language, left.work) - preferenceOf(language, right.work))

/**
 * Looks a word up in the headings of every dictionary. A name is not spelled the same by
 * all (« Melchisédek », « Melchisédec »): when nothing matches, its beginning is looked up.
 */
const searchDirectory = async (
  context: StudyContext,
  language: StudyLanguage,
  query: string,
  limit: number
) => {
  const ask = (search: string) =>
    context.api.get<DictionaryDirectoryResponseDto>('/v1/dictionaries/directory', {
      language,
      search,
      limit,
    })
  const found = await ask(query)
  const beginning = query.slice(0, Math.max(4, Math.ceil(query.length * 0.6)))
  return found?.items.length || beginning === query ? found : ask(beginning)
}

// --- Finding an article ----------------------------------------------------------

export const dictionarySearchInput = {
  query: z
    .string()
    .min(1)
    .max(80)
    .describe('The word or name to look up in the Bible dictionaries: "Melchisédek", "covenant".'),
  limit: z.number().int().min(1).max(30).optional().describe('Notions to return (default 10).'),
  language: languageInput,
}

export const dictionarySearchOutput = z.object({
  query: z.string(),
  results: z.array(z.object({ word: z.string(), articles: z.array(source) })),
})

export const loadDictionarySearch = async (
  context: StudyContext,
  input: { query: string; limit?: number; language?: StudyLanguage }
): Promise<StudyResult<z.infer<typeof dictionarySearchOutput>>> => {
  const language = input.language ?? context.language
  const query = input.query.trim()
  const directory = await searchDirectory(context, language, query, input.limit ?? 10)
  const results = (directory?.items ?? []).flatMap(item => {
    const articles = sourcesOf(item, language)
    return articles.length ? [{ word: item.label, articles }] : []
  })
  return {
    text: results.length
      ? results
          .map(
            result =>
              `${result.word} — ${result.articles
                .map(article => `${article.workTitle} [${article.work} #${article.entryId}]`)
                .join('; ')}`
          )
          .join('\n')
      : `No dictionary has an article matching "${query}".`,
    model: {
      query,
      results: results.map(result => ({
        word: result.word,
        articles: result.articles.map(article => ({
          dictionary: article.work,
          dictionaryTitle: article.workTitle,
          entryId: article.entryId,
          word: article.word,
        })),
      })),
    },
  }
}

// --- An article ------------------------------------------------------------------

export const dictionaryEntryInput = {
  word: z
    .string()
    .min(1)
    .max(80)
    .optional()
    .describe('The heading of the article to read: "Jérusalem", "Pharisees".'),
  dictionary: z
    .string()
    .max(64)
    .optional()
    .describe(
      'The dictionary to read it in: westphal, bost, lelievre or calmet in French; ' +
        'easton-webster, smith, isbe or unfoldingword-translation-words in English. ' +
        'Defaults to the most complete one holding the article.'
    ),
  entryId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('The identity of an article returned by search_dictionaries; needs `dictionary`.'),
  language: languageInput,
}

export const dictionaryEntryOutput = z.object({
  word: z.string(),
  dictionary: z.string(),
  dictionaryTitle: z.string(),
  entryId: z.number(),
  text: z.string().describe('The article, as plain text.'),
  otherDictionaries: z.array(source).describe('The same notion in other dictionaries.'),
  url: z.string().optional(),
})

type DictionaryEntryModel = z.infer<typeof dictionaryEntryOutput>

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

/** Finds the notion a word names, and the dictionaries of a language that write about it. */
const findSources = async (
  context: StudyContext,
  language: StudyLanguage,
  word: string
): Promise<DictionarySource[]> => {
  const directory = await searchDirectory(context, language, word, 30)
  const wanted = normalize(word)
  const items = directory?.items ?? []
  const exact =
    items.find(item => normalize(item.label) === wanted) ??
    items.find(item => item.sources.some(entry => normalize(entry.word) === wanted))
  // Without an exact heading, the nearest one is the first the directory lists.
  for (const item of exact ? [exact] : items) {
    const sources = sourcesOf(item, language)
    if (sources.length) return sources
  }
  return []
}

const workTitles = new Map<string, string>()

/** The title of a dictionary, as its catalog gives it. */
const titleOf = async (context: StudyContext, work: string, language: StudyLanguage) => {
  const key = `${language}:${work}`
  if (!workTitles.size) {
    const catalog = await context.api
      .get<DictionaryCatalogResponseDto>('/v1/dictionaries')
      .catch(() => undefined)
    for (const dictionary of catalog?.dictionaries ?? []) {
      workTitles.set(`${dictionary.resource.language}:${dictionary.resource.work}`, dictionary.title)
    }
  }
  return workTitles.get(key) ?? work
}

export const loadDictionaryEntry = async (
  context: StudyContext,
  input: { word?: string; dictionary?: string; entryId?: number; language?: StudyLanguage }
): Promise<StudyResult<DictionaryEntryModel>> => {
  const language = input.language ?? context.language
  const asked = input.dictionary?.trim().toLowerCase()
  // The Resource API answers an unknown dictionary as one that is not published yet.
  if (asked && !PREFERRED_WORKS[language].includes(asked)) {
    throw new StudyError(
      `"${input.dictionary}" is not a dictionary read in ${language === 'fr' ? 'French' : 'English'}. ` +
        `Use one of: ${PREFERRED_WORKS[language].join(', ')}.`
    )
  }

  let chosen: DictionarySource | undefined
  let others: DictionarySource[] = []
  if (asked && input.entryId) {
    chosen = { work: asked, workTitle: '', entryId: input.entryId, word: input.word ?? '' }
  } else if (input.word?.trim()) {
    const sources = await findSources(context, language, input.word)
    chosen = (asked && sources.find(item => item.work === asked)) || sources[0]
    others = sources.filter(item => item !== chosen)
    if (!chosen) {
      throw new StudyError(
        `No ${language === 'fr' ? 'French' : 'English'} dictionary has an article "${input.word}". ` +
          'search_dictionaries finds the headings that exist.'
      )
    }
  } else {
    throw new StudyError('Give the word to look up, or a dictionary with an entryId.')
  }

  const response = await context.api.get<DictionaryEntryResponseDto>(
    `/v1/dictionaries/${chosen.work}/${language}/entries/by-id/${chosen.entryId}`
  )
  if (!response) {
    throw new StudyError(`The dictionary "${chosen.work}" has no article ${chosen.entryId}.`)
  }
  const { entry } = response
  if (!others.length) {
    others = (await findSources(context, language, entry.word).catch(() => [])).filter(
      item => !(item.work === chosen.work && item.entryId === entry.id)
    )
  }

  const workTitle = chosen.workTitle || (await titleOf(context, chosen.work, language))
  const body = withReferences(
    htmlToBlocks(entry.definition, editorialLinks(chosen.work)),
    text => findReferences(text, language)
  )
  const url = context.links.dictionaryEntry(language, chosen.work, entry.id, entry.word)

  const card: DictionaryEntryCard = {
    kind: 'dictionary_entry',
    language,
    title: entry.word,
    work: chosen.work,
    workTitle,
    entryId: entry.id,
    body,
    others,
    url,
  }

  const text = truncateText(blocksToText(body), ARTICLE_LENGTH)
  return {
    text: lines(
      `${entry.word} — ${workTitle}`,
      '',
      text,
      '',
      others.length
        ? `Also in: ${others.map(item => `${item.workTitle} [${item.work} #${item.entryId}]`).join('; ')}`
        : undefined,
      sourceLine(url)
    ),
    model: {
      word: entry.word,
      dictionary: chosen.work,
      dictionaryTitle: workTitle,
      entryId: entry.id,
      text,
      otherDictionaries: others.map(item => ({
        dictionary: item.work,
        dictionaryTitle: item.workTitle,
        entryId: item.entryId,
        word: item.word,
      })),
      url,
    },
    card,
  }
}
