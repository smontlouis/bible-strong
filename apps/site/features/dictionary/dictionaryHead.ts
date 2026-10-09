import { truncateText } from '../resources/editorialHtml'
import { absoluteSiteUrl } from '../resources/publicSite'
import { buildResourceHead } from '../resources/resourceHead'
import type {
  DictionaryEntryPageData,
  DictionaryIndexPageData,
  DictionaryLetterPageData,
  DictionaryTermPageData,
  DictionaryWork,
  DictionaryWorkPageData,
} from './dictionary.functions'
import {
  dictionaryEntryBreadcrumbs,
  dictionaryLetterBreadcrumbs,
  dictionaryTermBreadcrumbs,
  dictionaryWorkBreadcrumbs,
} from './dictionaryBreadcrumbs'
import {
  buildDictionaryEntryPath,
  buildDictionaryIndexPath,
  buildDictionaryLetterPath,
  buildDictionaryTermPath,
  buildDictionaryWorkPath,
} from './dictionaryRoutes'
import { dictionaryMessages } from './messages'
import { shareCardExcerpt } from '../share/shareCardText'

const DESCRIPTION_LENGTH = 155
// More headings than a description can hold: it is cut to length afterwards.
const SAMPLE_SIZE = 12

/**
 * A work as search results name it. Several French works share a generic title, so the
 * name readers know them by follows unless the title already starts with it.
 */
export const dictionaryWorkName = ({
  title,
  abbreviation,
}: Pick<DictionaryWork, 'title' | 'abbreviation'>): string => {
  const knownBy = abbreviation.split(/\s/u)[0] ?? ''
  return title.startsWith(knownBy) ? title : `${title} (${abbreviation})`
}

/** Head of `/dictionary/:language`: the same page in each language that has dictionaries. */
export const buildDictionaryIndexHead = ({
  language,
  works,
  languages,
}: DictionaryIndexPageData) => {
  const names = works.map(work => work.abbreviation).join(', ')
  return buildResourceHead({
    title:
      language === 'fr'
        ? 'Dictionnaires bibliques en ligne | Bible Strong'
        : 'Bible dictionaries online | Bible Strong',
    description: truncateText(
      language === 'fr'
        ? `${works.length} dictionnaires bibliques à consulter en ligne : ${names}. Personnes, lieux, coutumes et notions de la Bible.`
        : `${works.length} Bible dictionaries to read online: ${names}. People, places, customs and notions of the Bible.`,
      DESCRIPTION_LENGTH
    ),
    path: buildDictionaryIndexPath(language),
    language,
    alternates:
      languages.length > 1
        ? Object.fromEntries(
            languages.map(alternate => [alternate, buildDictionaryIndexPath(alternate)])
          )
        : undefined,
    ogType: 'website',
    shareCard: {
      kind: 'title',
      title: language === 'fr' ? 'Dictionnaires bibliques' : 'Bible dictionaries',
      facts: shareCardExcerpt(names, false),
    },
  })
}

/** Head of `/dictionary/:language/:work`. A work is published in a single language. */
export const buildDictionaryWorkHead = ({ language, work }: DictionaryWorkPageData) => {
  const name = dictionaryWorkName(work)
  const path = buildDictionaryWorkPath(language, work.id)
  const authors = work.authors.join(', ')
  return buildResourceHead({
    title:
      language === 'fr'
        ? `${name} – consulter en ligne | Bible Strong`
        : `${name} – read online | Bible Strong`,
    description: truncateText(
      language === 'fr'
        ? `${work.description} Par ${authors} : tous les articles, classés par lettre.`
        : `${work.description} By ${authors}: every article, filed by letter.`,
      DESCRIPTION_LENGTH
    ),
    path,
    language,
    breadcrumbs: dictionaryWorkBreadcrumbs(language, work),
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'DefinedTermSet',
        '@id': absoluteSiteUrl(path),
        url: absoluteSiteUrl(path),
        name: work.title,
        description: work.description,
        inLanguage: language,
      },
    ],
    ogType: 'website',
    shareCard: {
      kind: 'title',
      kicker: language === 'fr' ? 'Dictionnaire' : 'Dictionary',
      chip: work.abbreviation,
      title: work.title,
      facts: authors,
    },
  })
}

/** Head of a letter list. Every numbered page is indexable under its own address. */
export const buildDictionaryLetterHead = (page: DictionaryLetterPageData) => {
  const { language, work, letter, entries, entryCount, pageCount } = page
  const name = dictionaryWorkName(work)
  const initial = letter.toUpperCase()
  const numbered = page.page > 1
  const pagePath = (number: number) => buildDictionaryLetterPath(language, work.id, letter, number)
  const sample = entries
    .slice(0, SAMPLE_SIZE)
    .map(entry => entry.word)
    .join(', ')
  const count = entryCount.toLocaleString(language)
  const head = buildResourceHead({
    title:
      language === 'fr'
        ? `${name} – articles en ${initial}${numbered ? ` – page ${page.page}` : ''} | Bible Strong`
        : `${name} – articles in ${initial}${numbered ? ` – page ${page.page}` : ''} | Bible Strong`,
    description: truncateText(
      language === 'fr'
        ? `${name}, lettre ${initial} : ${count} articles${numbered ? `, page ${page.page} sur ${pageCount}` : ''}. ${sample}`
        : `${name}, letter ${initial}: ${count} articles${numbered ? `, page ${page.page} of ${pageCount}` : ''}. ${sample}`,
      DESCRIPTION_LENGTH
    ),
    path: pagePath(page.page),
    language,
    breadcrumbs: dictionaryLetterBreadcrumbs(language, work, letter, page.page),
    ogType: 'website',
    shareCard: {
      kind: 'title',
      kicker: language === 'fr' ? 'Dictionnaire' : 'Dictionary',
      chip: work.abbreviation,
      title: language === 'fr' ? `Articles en ${initial}` : `Articles in ${initial}`,
      facts: `${count} articles`,
    },
  })
  return {
    ...head,
    links: [
      ...head.links,
      ...(numbered ? [{ rel: 'prev', href: absoluteSiteUrl(pagePath(page.page - 1)) }] : []),
      ...(page.page < pageCount
        ? [{ rel: 'next', href: absoluteSiteUrl(pagePath(page.page + 1)) }]
        : []),
    ],
  }
}

const ENTRY_TITLE = {
  fr: ' dans la Bible : définition',
  en: ' in the Bible: definition',
} as const

/** Head of an article. Its work exists in one language, so it has no language alternate. */
export const buildDictionaryEntryHead = (page: DictionaryEntryPageData) => {
  const { language, work, id, word } = page
  const path = buildDictionaryEntryPath({ language, work: work.id, entryId: id, word })
  return buildResourceHead({
    // An article is looked for as a question about the Bible, before the name of its work.
    title: `${word}${ENTRY_TITLE[language]} – ${dictionaryWorkName(work)}`,
    description: page.description,
    path,
    language,
    breadcrumbs: dictionaryEntryBreadcrumbs(page),
    shareCard: {
      kind: 'title',
      kicker: language === 'fr' ? 'Dictionnaire' : 'Dictionary',
      chip: work.abbreviation,
      title: word,
      excerpt: shareCardExcerpt(page.description, false),
    },
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'DefinedTerm',
        '@id': absoluteSiteUrl(path),
        url: absoluteSiteUrl(path),
        name: word,
        description: page.description,
        inLanguage: language,
        inDefinedTermSet: {
          '@type': 'DefinedTermSet',
          '@id': absoluteSiteUrl(buildDictionaryWorkPath(language, work.id)),
          name: work.title,
        },
      },
    ],
  })
}

/** Head of a term: every dictionary of the language on one notion. */
export const buildDictionaryTermHead = (page: DictionaryTermPageData) => {
  const { language, word, articles } = page
  const path = buildDictionaryTermPath(language, word)
  return buildResourceHead({
    title: dictionaryMessages(language)('term.title')
      .replace('{word}', word)
      .replace('{count}', String(articles.length)),
    description: page.description,
    path,
    language,
    breadcrumbs: dictionaryTermBreadcrumbs(page),
    shareCard: {
      kind: 'title',
      kicker: language === 'fr' ? 'Dictionnaires' : 'Dictionaries',
      chip:
        language === 'fr'
          ? `${articles.length} dictionnaires`
          : `${articles.length} dictionaries`,
      title: word,
      excerpt: shareCardExcerpt(page.description, false),
    },
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'DefinedTerm',
        '@id': absoluteSiteUrl(path),
        url: absoluteSiteUrl(path),
        name: word,
        description: page.description,
        inLanguage: language,
      },
    ],
  })
}
