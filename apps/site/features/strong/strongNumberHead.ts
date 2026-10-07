import { truncateText } from '../resources/editorialHtml'
import { absoluteSiteUrl } from '../resources/publicSite'
import { buildResourceHead } from '../resources/resourceHead'
import type { StrongNumberPageData } from './strong.functions'
import { strongNumberBreadcrumbs } from './strongBreadcrumbs'
import { buildStrongPath, displayStrongCode } from './strongRoutes'

const DESCRIPTION_LENGTH = 155
// A title names the first senses; the page lists them all.
const TITLE_GLOSS_COUNT = 3

const LABELS = {
  fr: {
    strong: 'Strong',
    hebrew: 'Lexique hébreu',
    greek: 'Lexique grec',
    separator: ' : ',
    senses: (count: number) => `${count} sens`,
    description: (code: string, word: string, count: number, glosses: string) =>
      `Les ${count} sens de Strong ${code} ${word} : ${glosses}.`,
    verses: (count: number, version: string) =>
      ` ${count.toLocaleString('fr')} verset${count === 1 ? '' : 's'} dans la ${version}.`,
  },
  en: {
    strong: 'Strong’s',
    hebrew: 'Hebrew lexicon',
    greek: 'Greek lexicon',
    separator: ': ',
    senses: (count: number) => `${count} senses`,
    description: (code: string, word: string, count: number, glosses: string) =>
      `The ${count} senses of Strong’s ${code} ${word}: ${glosses}.`,
    verses: (count: number, version: string) =>
      ` ${count.toLocaleString('en')} verse${count === 1 ? '' : 's'} in the ${version}.`,
  },
} as const

/** Title, description, canonical, language alternates and structured data of a number page. */
export const buildStrongNumberHead = (page: StrongNumberPageData) => {
  const labels = LABELS[page.language]
  const lexicon = labels[page.lexicalLanguage]
  const code = displayStrongCode(page.code)
  const count = page.senses.length
  const path = buildStrongPath(page.language, page.code)
  const word = `${page.original} (${page.transliteration})`
  const glosses = page.glosses.slice(0, TITLE_GLOSS_COUNT).join(', ')
  const title = `${word} – ${labels.strong} ${code}${labels.separator}${glosses} (${labels.senses(count)}) | ${lexicon}`
  const description = truncateText(
    `${labels.description(code, word, count, page.glosses.join(', '))}${
      page.concordance ? labels.verses(page.concordance.verseCount, page.concordance.version) : ''
    }`,
    DESCRIPTION_LENGTH
  )

  return buildResourceHead({
    title,
    description,
    path,
    language: page.language,
    alternates: {
      fr: buildStrongPath('fr', page.code),
      en: buildStrongPath('en', page.code),
    },
    breadcrumbs: strongNumberBreadcrumbs(page),
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'DefinedTerm',
        '@id': absoluteSiteUrl(path),
        url: absoluteSiteUrl(path),
        name: page.original,
        alternateName: page.transliteration,
        termCode: code,
        description,
        inLanguage: page.language,
        inDefinedTermSet: { '@type': 'DefinedTermSet', name: `${lexicon} Strong` },
      },
    ],
  })
}
