import type { NaveTopicResponseDto } from '@bible-strong/resource-domain/contracts/naveContract'
import { notFound, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { editorialHtmlToText } from '../resources/editorialHtml'
import { isResourceLanguage, type ResourceLanguage } from '../resources/publicSite'
import { readResource } from '../resources/resourceApi'
import { describeNaveTopic } from './naveHead'
import { renderNaveDescription } from './naveHtml'
import { loadNaveIndex, type NaveIndex, type NaveIndexTopic } from './naveIndex'
import {
  buildNavePath,
  isNaveLetter,
  naveListPage,
  naveListPageCount,
  naveListPageOf,
  parseNaveTopic,
} from './naveRoutes'

// Nave wrote in English; the other publication is a translation of his headings.
const ORIGINAL_LANGUAGE: ResourceLanguage = 'en'

const otherLanguage = (language: ResourceLanguage): ResourceLanguage =>
  language === 'fr' ? 'en' : 'fr'

/** A topic as a list names it. */
export type NaveListTopic = {
  normalizedName: string
  name: string
  /** The heading Nave gave the topic, when the page shows a translation of it. */
  original?: string
}

const listTopic = (
  { normalizedName, name }: Pick<NaveIndexTopic, 'normalizedName' | 'name'>,
  original?: NaveIndex
): NaveListTopic => {
  const heading = original?.topics[original.positions.get(normalizedName) ?? -1]?.name
  return {
    normalizedName,
    name,
    ...(heading && heading.toLowerCase() !== name.toLowerCase() ? { original: heading } : {}),
  }
}

// The lines of an outline read in a row, for metadata.
const outlineText = (html: string): string =>
  editorialHtmlToText(html.replace(/<\/(?:p|b)>/gu, '; ')).replace(/[;\s]+$/u, '')

export type NaveIndexPageData = {
  language: ResourceLanguage
  /** The letters holding topics. */
  letters: string[]
  topicCount: number
  /** Whether the other language has its own publication. */
  hasAlternate: boolean
}

export const loadNaveIndexPage = createServerFn({ method: 'GET' })
  .validator((data: { language: string }) => data)
  .handler(async ({ data }): Promise<NaveIndexPageData> => {
    if (!isResourceLanguage(data.language)) throw notFound()
    const language = data.language
    const [index, alternate] = await Promise.all([
      loadNaveIndex(language),
      loadNaveIndex(otherLanguage(language)),
    ])
    if (!index.topics.length) throw notFound()
    return {
      language,
      letters: [...index.byLetter.keys()],
      topicCount: index.topics.length,
      hasAlternate: alternate.topics.length > 0,
    }
  })

export type NaveLetterPageData = {
  language: ResourceLanguage
  letter: string
  letters: string[]
  /** How many topics the letter holds, every page included. */
  topicCount: number
  topics: NaveListTopic[]
  page: number
  pageCount: number
}

/** The topics filed under a letter, a numbered page at a time. */
export const loadNaveLetterPage = createServerFn({ method: 'GET' })
  .validator((data: { language: string; letter: string; page?: number }) => data)
  .handler(async ({ data }): Promise<NaveLetterPageData> => {
    const { language, letter, page = 1 } = data
    if (!isResourceLanguage(language) || !isNaveLetter(letter)) throw notFound()
    if (!Number.isSafeInteger(page) || page < 1) throw notFound()

    const [index, original] = await Promise.all([
      loadNaveIndex(language),
      language === ORIGINAL_LANGUAGE ? undefined : loadNaveIndex(ORIGINAL_LANGUAGE),
    ])
    const filed = index.byLetter.get(letter)
    if (!filed) throw notFound()
    const pageCount = naveListPageCount(filed.length)
    if (page > pageCount) throw notFound()

    return {
      language,
      letter,
      letters: [...index.byLetter.keys()],
      topicCount: filed.length,
      topics: naveListPage(filed, page).map(topic => listTopic(topic, original)),
      page,
      pageCount,
    }
  })

export type NaveTopicPageData = NaveListTopic & {
  language: ResourceLanguage
  /** The letter the topic is filed under, and the page of that letter listing it. */
  letter?: string
  letterPage?: number
  /** The outline of the topic, safe to inject. */
  html: string
  description: string
  referenceCount: number
  /** Whether the publication of the other language holds the same topic. */
  hasAlternate: boolean
  previous?: NaveListTopic
  next?: NaveListTopic
}

export const loadNaveTopicPage = createServerFn({ method: 'GET' })
  .validator((data: { language: string; topic: string }) => data)
  .handler(async ({ data }): Promise<NaveTopicPageData> => {
    const requested = parseNaveTopic(data.topic)
    if (!isResourceLanguage(data.language) || !requested) throw notFound()
    const language = data.language

    const [response, index, alternate] = await Promise.all([
      readResource<NaveTopicResponseDto>(
        `/v1/naves/${language}/topics/${encodeURIComponent(requested)}`
      ),
      loadNaveIndex(language),
      loadNaveIndex(otherLanguage(language)),
    ])
    if (!response) {
      // Published names are lower case: a capitalized one is sent to the topic it names
      // rather than answered as a missing page.
      const folded = requested.toLowerCase()
      if (folded !== requested && index.positions.has(folded)) {
        throw redirect({ href: buildNavePath(language, folded), statusCode: 301 })
      }
      throw notFound()
    }

    const { normalizedName, name } = response.topic
    const original = language === ORIGINAL_LANGUAGE ? undefined : alternate
    const outline = renderNaveDescription(response.topic.description, {
      language,
      // A topic citing itself would only reload its own page.
      hasTopic: target => target !== normalizedName && index.positions.has(target),
    })

    // Lists hold the topics the letters cover; one filed elsewhere has no neighbours.
    const position = index.positions.get(normalizedName)
    const listed = position === undefined ? undefined : index.topics[position]
    const filed = listed ? (index.byLetter.get(listed.letter) ?? []) : []
    const previous = position === undefined ? undefined : index.topics[position - 1]
    const next = position === undefined ? undefined : index.topics[position + 1]

    return {
      ...listTopic({ normalizedName, name }, original),
      language,
      letter: listed?.letter,
      letterPage: listed ? naveListPageOf(filed.length, filed.indexOf(listed)) : undefined,
      html: outline.html,
      description: describeNaveTopic({
        language,
        name,
        headings: outline.headings,
        referenceCount: outline.referenceCount,
        // Only a topic without sub-topics is described by its text.
        text: outline.headings.length ? '' : outlineText(outline.html),
      }),
      referenceCount: outline.referenceCount,
      hasAlternate: alternate.positions.has(normalizedName),
      previous: previous && listTopic(previous),
      next: next && listTopic(next),
    }
  })
