import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { isResourceLanguage, RESOURCE_PAGE_CACHE_CONTROL } from '@/features/resources/publicSite'
import { buildResourceHead } from '@/features/resources/resourceHead'
import { StrongLetterPage } from '@/features/strong/StrongLexiconPages'
import { loadStrongLetterPage, type StrongLetterPageData } from '@/features/strong/strong.functions'
import { strongLetterBreadcrumbs } from '@/features/strong/strongBreadcrumbs'
import {
  buildStrongLetterPath,
  isStrongLexicon,
  STRONG_LETTERS,
} from '@/features/strong/strongRoutes'

const LEXICON_NAMES = {
  fr: { hebrew: 'Lexique hébreu Strong', greek: 'Lexique grec Strong' },
  en: { hebrew: 'Strong’s Hebrew lexicon', greek: 'Strong’s Greek lexicon' },
} as const

const buildHead = (page: StrongLetterPageData) => {
  const { language, lexicon, letter, entries } = page
  const name = LEXICON_NAMES[language][lexicon]
  const sample = entries
    .slice(0, 6)
    .map(entry => entry.gloss)
    .join(', ')
  return buildResourceHead({
    title:
      language === 'fr'
        ? `${name} – mots en ${letter.toUpperCase()}`
        : `${name} – words in ${letter.toUpperCase()}`,
    description:
      language === 'fr'
        ? `${entries.length.toLocaleString('fr')} mots du ${name.toLowerCase()} commençant par ${letter.toUpperCase()} : ${sample}…`
        : `${entries.length.toLocaleString('en')} words of ${name} starting with ${letter.toUpperCase()}: ${sample}…`,
    path: buildStrongLetterPath(language, lexicon, letter),
    language,
    breadcrumbs: strongLetterBreadcrumbs(language, lexicon, letter),
    ogType: 'website',
  })
}

export const Route = createFileRoute('/strong/$language/$lexicon/$letter')({
  beforeLoad: ({ params }) => {
    const { language, lexicon } = params
    const letter = params.letter.toLowerCase()
    if (!isResourceLanguage(language) || !isStrongLexicon(lexicon)) throw notFound()
    if (!STRONG_LETTERS.includes(letter)) throw notFound()
    if (params.letter !== letter) {
      throw redirect({
        to: '/strong/$language/$lexicon/$letter',
        params: { language, lexicon, letter },
        statusCode: 301,
      })
    }
  },
  loader: ({ params }) => loadStrongLetterPage({ data: params }),
  head: ({ loaderData }) => (loaderData ? buildHead(loaderData) : {}),
  // Only a rendered page is cacheable: a failed load must not be kept by the CDN.
  headers: ({ loaderData }) =>
    loaderData ? { 'Cache-Control': RESOURCE_PAGE_CACHE_CONTROL } : undefined,
  component: StrongLetterRoute,
})

function StrongLetterRoute() {
  return <StrongLetterPage page={Route.useLoaderData()} />
}
