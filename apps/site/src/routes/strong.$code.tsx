import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import {
  absoluteSiteUrl,
  DEFAULT_RESOURCE_LANGUAGE,
  isResourceLanguage,
  RESOURCE_FONT_PRELOADS,
  RESOURCE_LANGUAGES,
  RESOURCE_PAGE_CACHE_CONTROL,
  type ResourceLanguage,
} from '@/features/resources/publicSite'
import { StrongIndexPage } from '@/features/strong/StrongLexiconPages'
import { loadStrongIndexPage } from '@/features/strong/strong.functions'
import {
  buildStrongIndexPath,
  parseStrongCode,
  strongCodeSlug,
} from '@/features/strong/strongRoutes'

const HEAD = {
  fr: {
    title: 'Lexique Strong hébreu et grec – tous les mots de la Bible',
    description:
      'Parcourez les mots hébreux et grecs de la Bible par leur traduction : définition, mots liés et occurrences de chaque numéro Strong.',
  },
  en: {
    title: 'Strong’s Hebrew and Greek lexicon – every word of the Bible',
    description:
      'Browse the Hebrew and Greek words of the Bible by their translation: definition, related words and occurrences of every Strong’s number.',
  },
} as const

const buildHead = (language: ResourceLanguage) => {
  const url = absoluteSiteUrl(buildStrongIndexPath(language))
  return {
    meta: [
      { title: HEAD[language].title },
      { name: 'description', content: HEAD[language].description },
      { property: 'og:title', content: HEAD[language].title },
      { property: 'og:description', content: HEAD[language].description },
      { property: 'og:url', content: url },
      { property: 'og:type', content: 'website' },
    ],
    links: [
      ...RESOURCE_FONT_PRELOADS,
      { rel: 'canonical', href: url },
      ...RESOURCE_LANGUAGES.map(alternate => ({
        rel: 'alternate',
        hrefLang: alternate,
        href: absoluteSiteUrl(buildStrongIndexPath(alternate)),
      })),
    ],
  }
}

// `/strong/:language` is the lexicon of that language. Any other value is a Strong code
// without its language, as in the study workspace (ADR-0053), and resolves to the default.
export const Route = createFileRoute('/strong/$code')({
  beforeLoad: ({ params }) => {
    if (isResourceLanguage(params.code)) return
    const identity = parseStrongCode(params.code)
    if (!identity) throw notFound()
    throw redirect({
      to: '/strong/$language/$code',
      params: { language: DEFAULT_RESOURCE_LANGUAGE, code: strongCodeSlug(identity.code) },
      statusCode: 301,
    })
  },
  loader: ({ params }) => loadStrongIndexPage({ data: { language: params.code } }),
  head: ({ loaderData }) => (loaderData ? buildHead(loaderData.language) : {}),
  // Only a rendered page is cacheable: a failed load must not be kept by the CDN.
  headers: ({ loaderData }) =>
    loaderData ? { 'Cache-Control': RESOURCE_PAGE_CACHE_CONTROL } : undefined,
  component: StrongIndexRoute,
})

function StrongIndexRoute() {
  return <StrongIndexPage page={Route.useLoaderData()} />
}
