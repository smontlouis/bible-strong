import type {
  DictionaryCatalogResponseDto,
  DictionaryDirectoryResponseDto,
  DictionaryEntriesResponseDto,
  DictionaryEntryResponseDto,
} from '@bible-strong/resource-domain/contracts/dictionaryContract'
import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { truncateText } from '../resources/editorialHtml'
import {
  isResourceLanguage,
  RESOURCE_LANGUAGES,
  type ResourceLanguage,
} from '../resources/publicSite'
import { readResource } from '../resources/resourceApi'
import { answerShared, notingStaleAnswers, type NotedAnswer } from '../resources/staleAnswers'
import { dictionaryArticleExcerpt, renderDictionaryArticleHtml } from './dictionaryHtml'
import {
  createDictionaryArticleSlug,
  DICTIONARY_LETTERS,
  DICTIONARY_LIST_PAGE_SIZE,
  dictionaryLetter,
  dictionaryLetterInitials,
  parseDictionaryEntryId,
  parseDictionaryTermSlug,
  parseDictionaryWorkRoute,
} from './dictionaryRoutes'

const DESCRIPTION_LENGTH = 155
const LIST_TTL_MS = 60 * 60 * 1000
// The Resource API returns at most this many articles per request.
const LIST_REQUEST_LIMIT = 500
// The largest work holds about 9,400 articles; the cap only guards against a cursor loop.
const MAX_LIST_REQUESTS = 60
const DIRECTORY_REQUEST_LIMIT = 100

export type DictionaryWork = {
  id: string
  title: string
  abbreviation: string
  authors: string[]
  description: string
  edition: string
  source: string
  attribution: string
}

export type DictionaryListEntry = { id: number; word: string }

const listCache = new Map<string, { at: number; list: Promise<NotedAnswer<unknown>> }>()

/**
 * Lists only change when a dictionary is republished: a server instance keeps each one for
 * an hour. The read itself is kept, so pages rendered at the same time share it; a failed
 * read is forgotten, and so is a list a STALE answer of the Resource API came into, which
 * each page that was sharing the read then reads again.
 */
const cached = <T>(key: string, load: () => Promise<T>): Promise<T> => {
  const hit = listCache.get(key)
  if (hit && Date.now() - hit.at < LIST_TTL_MS) {
    return answerShared(hit.list as Promise<NotedAnswer<T>>, load)
  }
  const list = notingStaleAnswers(load)
  listCache.set(key, { at: Date.now(), list })
  const forget = () => {
    if (listCache.get(key)?.list === list) listCache.delete(key)
  }
  list.then(({ stale }) => {
    if (stale) forget()
  }, forget)
  return list.then(({ value }) => value)
}

/** The dictionaries published in a language. */
export const listDictionaryWorks = (language: ResourceLanguage): Promise<DictionaryWork[]> =>
  cached(`works:${language}`, async () => {
    const catalog = await readResource<DictionaryCatalogResponseDto>('/v1/dictionaries', {
      language,
    })
    return (catalog?.dictionaries ?? []).map(work => ({
      id: work.resource.work,
      title: work.title,
      abbreviation: work.abbreviation,
      authors: [...work.authors],
      description: work.description,
      edition: work.edition,
      source: work.source,
      attribution: work.attribution,
    }))
  })

// The Resource API answers "unavailable" for a work it does not publish, so a work is
// looked up in the catalog before any of its articles is asked for.
const requireDictionaryWork = async (params: {
  language: string
  work: string
}): Promise<{ language: ResourceLanguage; work: DictionaryWork }> => {
  const route = parseDictionaryWorkRoute(params)
  if (!route) throw notFound()
  const work = (await listDictionaryWorks(route.language)).find(
    candidate => candidate.id === route.work
  )
  if (!work) throw notFound()
  return { language: route.language, work }
}

const entriesPath = (language: ResourceLanguage, work: string): string =>
  `/v1/dictionaries/${work}/${language}/entries`

/** The articles of a published work in the order of the Resource API, optionally by initial. */
export const listDictionaryEntries = async (
  language: ResourceLanguage,
  work: string,
  initial?: string
): Promise<DictionaryListEntry[]> => {
  const entries: DictionaryListEntry[] = []
  let cursor: string | undefined
  for (let request = 0; request < MAX_LIST_REQUESTS; request += 1) {
    const response = await readResource<DictionaryEntriesResponseDto>(entriesPath(language, work), {
      initial,
      limit: LIST_REQUEST_LIMIT,
      cursor,
    })
    for (const entry of response?.entries ?? []) entries.push({ id: entry.id, word: entry.word })
    cursor = response?.nextCursor
    if (!cursor) break
  }
  return entries
}

/** The articles filed under a letter, in the alphabetical order of the language. */
const listLetterEntries = (
  language: ResourceLanguage,
  work: string,
  letter: string
): Promise<DictionaryListEntry[]> =>
  cached(`entries:${language}:${work}:${letter}`, async () => {
    const lists = await Promise.all(
      dictionaryLetterInitials(letter, language).map(initial =>
        listDictionaryEntries(language, work, initial)
      )
    )
    return lists
      .flat()
      .sort(
        (left, right) =>
          left.word.localeCompare(right.word, language, { sensitivity: 'base' }) ||
          left.id - right.id
      )
  })

/** The letters under which a work has articles. */
const listDictionaryLetters = (language: ResourceLanguage, work: string): Promise<string[]> =>
  cached(`letters:${language}:${work}`, async () => {
    const hasEntries = async (initial: string) => {
      const page = await readResource<DictionaryEntriesResponseDto>(entriesPath(language, work), {
        initial,
        limit: 1,
      })
      return (page?.entries.length ?? 0) > 0
    }
    const filled = await Promise.all(
      DICTIONARY_LETTERS.map(async letter => {
        // An accented initial is only asked for when the plain letter has no article.
        for (const initial of dictionaryLetterInitials(letter, language)) {
          if (await hasEntries(initial)) return true
        }
        return false
      })
    )
    return DICTIONARY_LETTERS.filter((_, index) => filled[index])
  })

export type DictionaryIndexPageData = {
  language: ResourceLanguage
  works: DictionaryWork[]
  /** The languages that have dictionaries, hence a page like this one. */
  languages: ResourceLanguage[]
}

export const loadDictionaryIndexPage = createServerFn({ method: 'GET' })
  .validator((data: { language: string }) => data)
  .handler(async ({ data }): Promise<DictionaryIndexPageData> => {
    const { language } = data
    if (!isResourceLanguage(language)) throw notFound()
    const catalogs = await Promise.all(RESOURCE_LANGUAGES.map(listDictionaryWorks))
    const works = catalogs[RESOURCE_LANGUAGES.indexOf(language)] ?? []
    if (!works.length) throw notFound()
    return {
      language,
      works,
      languages: RESOURCE_LANGUAGES.filter((_, index) => catalogs[index]?.length),
    }
  })

export type DictionaryWorkPageData = {
  language: ResourceLanguage
  work: DictionaryWork
  letters: string[]
}

export const loadDictionaryWorkPage = createServerFn({ method: 'GET' })
  .validator((data: { language: string; work: string }) => data)
  .handler(async ({ data }): Promise<DictionaryWorkPageData> => {
    const { language, work } = await requireDictionaryWork(data)
    return { language, work, letters: await listDictionaryLetters(language, work.id) }
  })

export type DictionaryLetterPageData = {
  language: ResourceLanguage
  work: DictionaryWork
  letter: string
  letters: string[]
  /** The articles of the page being read. */
  entries: DictionaryListEntry[]
  /** How many articles the letter holds across its pages. */
  entryCount: number
  page: number
  pageCount: number
}

export const loadDictionaryLetterPage = createServerFn({ method: 'GET' })
  .validator((data: { language: string; work: string; letter: string; page?: number }) => data)
  .handler(async ({ data }): Promise<DictionaryLetterPageData> => {
    const { letter, page = 1 } = data
    if (!DICTIONARY_LETTERS.includes(letter)) throw notFound()
    if (!Number.isSafeInteger(page) || page < 1) throw notFound()
    const { language, work } = await requireDictionaryWork(data)

    const [letters, entries] = await Promise.all([
      listDictionaryLetters(language, work.id),
      listLetterEntries(language, work.id, letter),
    ])
    const pageCount = Math.ceil(entries.length / DICTIONARY_LIST_PAGE_SIZE)
    if (page > pageCount) throw notFound()

    return {
      language,
      work,
      letter,
      letters,
      entries: entries.slice(
        (page - 1) * DICTIONARY_LIST_PAGE_SIZE,
        page * DICTIONARY_LIST_PAGE_SIZE
      ),
      entryCount: entries.length,
      page,
      pageCount,
    }
  })

/** The same notion in another dictionary, of either language. */
export type DictionaryRelatedArticle = {
  language: ResourceLanguage
  work: string
  workTitle: string
  id: number
  word: string
}

/**
 * The articles the Resource API files under the same notion as an article. A notion is
 * found by the heading of one of its articles; a heading too short to single it out is
 * narrowed down by its initial.
 */
const listRelatedArticles = async (
  language: ResourceLanguage,
  work: string,
  entry: DictionaryListEntry
): Promise<{ label?: string; articles: DictionaryRelatedArticle[] }> => {
  const isArticle = (source: DictionaryRelatedArticle) =>
    source.language === language && source.work === work && source.id === entry.id
  const search = async (initial?: string) => {
    const directory = await readResource<DictionaryDirectoryResponseDto>(
      '/v1/dictionaries/directory',
      { language, search: entry.word, initial, limit: DIRECTORY_REQUEST_LIMIT }
    )
    const notions = (directory?.items ?? []).map(item => ({
      label: item.label,
      sources: item.sources.map(source => ({
        language: source.resource.language,
        work: source.resource.work,
        workTitle: source.title,
        id: source.id,
        word: source.word,
      })),
    }))
    return {
      notion: notions.find(notion => notion.sources.some(isArticle)),
      complete: !directory?.nextCursor,
    }
  }

  let found = await search()
  if (!found.notion && !found.complete) {
    found = await search([...entry.word.trim().toLowerCase()][0])
  }
  return {
    label: found.notion?.label,
    articles: (found.notion?.sources ?? [])
      .filter(source => !isArticle(source))
      .sort(
        (left, right) => Number(right.language === language) - Number(left.language === language)
      ),
  }
}

export type DictionaryEntryPageData = {
  language: ResourceLanguage
  work: DictionaryWork
  id: number
  word: string
  /** The canonical slug, derived from the current heading (ADR-0055). */
  slug: string
  html: string
  description: string
  /** The letter the article is filed under, with its neighbours in that list. */
  letter?: string
  previous?: DictionaryListEntry
  next?: DictionaryListEntry
  related: DictionaryRelatedArticle[]
  /** The page that reads the term in every dictionary of the language that defines it. */
  term?: { word: string; count: number }
}

export const loadDictionaryEntryPage = createServerFn({ method: 'GET' })
  .validator((data: { language: string; work: string; entryId: string }) => data)
  .handler(async ({ data }): Promise<DictionaryEntryPageData> => {
    const entryId = parseDictionaryEntryId(data.entryId)
    if (!entryId) throw notFound()
    const { language, work } = await requireDictionaryWork(data)
    const response = await readResource<DictionaryEntryResponseDto>(
      `${entriesPath(language, work.id)}/by-id/${entryId}`
    )
    if (!response) throw notFound()
    const { id, word, definition } = response.entry

    // The article is complete without its neighbours and related articles: a list that
    // cannot be read leaves them out instead of failing the page.
    const letter = dictionaryLetter(word, language)
    const [siblings, notion] = await Promise.all([
      letter ? listLetterEntries(language, work.id, letter).catch(() => []) : [],
      listRelatedArticles(language, work.id, { id, word }).catch(() => ({
        label: undefined,
        articles: [],
      })),
    ])
    const related = notion.articles
    const sameLanguage = related.filter(article => article.language === language).length
    const position = siblings.findIndex(sibling => sibling.id === id)
    const html = renderDictionaryArticleHtml(definition, { language, work: work.id, entryId: id })

    return {
      language,
      work,
      id,
      word,
      slug: createDictionaryArticleSlug(word),
      html,
      description:
        dictionaryArticleExcerpt(html, DESCRIPTION_LENGTH) ||
        truncateText(`${word} – ${work.title}`, DESCRIPTION_LENGTH),
      letter,
      previous: position > 0 ? siblings[position - 1] : undefined,
      next: position >= 0 ? siblings[position + 1] : undefined,
      related,
      term:
        notion.label && sameLanguage > 0
          ? { word: notion.label, count: sameLanguage + 1 }
          : undefined,
    }
  })

// A term is found among the notions its first word brings up; a few pages are enough.
const TERM_SEARCH_PAGES = 4

/** A term as the dictionaries of a language define it, one article after the other. */
export type DictionaryTermPageData = {
  kind: 'term'
  language: ResourceLanguage
  /** The heading the Resource API files the notion under. */
  word: string
  slug: string
  articles: { work: DictionaryWork; id: number; word: string; html: string }[]
  /** The same notion in a dictionary of the other language, when one holds it. */
  counterpart?: DictionaryRelatedArticle
  description: string
}

/** Where a term held by a single dictionary is read: the article itself. */
export type DictionaryTermArticle = { kind: 'article'; work: string; id: number; word: string }

/**
 * `/dictionary/:language/term/:slug` — every article the dictionaries of a language have on
 * one notion. The notion is looked for by the first word of its slug, among the notions the
 * Resource API gathers across dictionaries.
 */
export const loadDictionaryTermPage = createServerFn({ method: 'GET' })
  .validator((data: { language: string; slug: string }) => data)
  .handler(async ({ data }): Promise<DictionaryTermPageData | DictionaryTermArticle> => {
    const slug = parseDictionaryTermSlug(data.slug)
    if (!isResourceLanguage(data.language) || !slug) throw notFound()
    const language = data.language

    let notion: DictionaryDirectoryResponseDto['items'][number] | undefined
    let cursor: string | undefined
    for (let page = 0; page < TERM_SEARCH_PAGES && !notion; page += 1) {
      const directory = await readResource<DictionaryDirectoryResponseDto>(
        '/v1/dictionaries/directory',
        { language, search: slug.split('-')[0], limit: DIRECTORY_REQUEST_LIMIT, cursor }
      )
      notion = directory?.items.find(item => createDictionaryArticleSlug(item.label) === slug)
      cursor = directory?.nextCursor
      if (!cursor) break
    }
    if (!notion) throw notFound()

    const works = new Map((await listDictionaryWorks(language)).map(work => [work.id, work]))
    const sources = notion.sources.filter(
      source => source.resource.language === language && works.has(source.resource.work)
    )
    const [single] = sources
    if (!single) throw notFound()
    // A notion one dictionary holds is read on the page of its article.
    if (sources.length === 1) {
      return { kind: 'article', work: single.resource.work, id: single.id, word: single.word }
    }

    const articles = (
      await Promise.all(
        sources.map(async source => {
          const work = works.get(source.resource.work)
          const response = await readResource<DictionaryEntryResponseDto>(
            `${entriesPath(language, source.resource.work)}/by-id/${source.id}`
          )
          return work && response
            ? [
                {
                  work,
                  id: response.entry.id,
                  word: response.entry.word,
                  html: renderDictionaryArticleHtml(response.entry.definition, {
                    language,
                    work: work.id,
                    entryId: response.entry.id,
                  }),
                },
              ]
            : []
        })
      )
    ).flat()
    if (!articles.length) throw notFound()

    const other = notion.sources.find(source => source.resource.language !== language)
    return {
      kind: 'term',
      language,
      word: notion.label,
      slug,
      articles,
      counterpart: other && {
        language: other.resource.language,
        work: other.resource.work,
        workTitle: other.title,
        id: other.id,
        word: other.word,
      },
      description:
        dictionaryArticleExcerpt(articles[0]?.html ?? '', DESCRIPTION_LENGTH) ||
        truncateText(notion.label, DESCRIPTION_LENGTH),
    }
  })

/** The terms several dictionaries of a language define, for the sitemap of their pages. */
export const listDictionaryTerms = (language: ResourceLanguage): Promise<string[]> =>
  cached(`terms:${language}`, async () => {
    const works = new Set((await listDictionaryWorks(language)).map(work => work.id))
    const terms: string[] = []
    let cursor: string | undefined
    for (let request = 0; request < MAX_LIST_REQUESTS; request += 1) {
      const directory = await readResource<DictionaryDirectoryResponseDto>(
        '/v1/dictionaries/directory',
        { language, limit: LIST_REQUEST_LIMIT, cursor }
      )
      for (const item of directory?.items ?? []) {
        const held = item.sources.filter(
          source => source.resource.language === language && works.has(source.resource.work)
        )
        if (held.length > 1) terms.push(item.label)
      }
      cursor = directory?.nextCursor
      if (!cursor) break
    }
    return terms
  })
