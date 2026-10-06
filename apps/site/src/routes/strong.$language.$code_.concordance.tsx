import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import {
  absoluteSiteUrl,
  isResourceLanguage,
  RESOURCE_FONT_PRELOADS,
  RESOURCE_LANGUAGES,
  RESOURCE_PAGE_CACHE_CONTROL,
} from '@/features/resources/publicSite'
import StrongConcordancePage from '@/features/strong/StrongConcordancePage'
import {
  loadStrongConcordancePage,
  type StrongConcordancePageData,
} from '@/features/strong/strong.functions'
import {
  buildStrongConcordancePath,
  displayStrongCode,
  parseStrongCode,
  strongCodeSlug,
} from '@/features/strong/strongRoutes'

type ConcordanceSearch = { book?: string; cursor?: string }

const TITLES = {
  fr: (code: string, word: string, version: string) =>
    `Concordance Strong ${code} – ${word} dans la Bible (${version})`,
  en: (code: string, word: string, version: string) =>
    `Strong’s ${code} concordance – ${word} in the Bible (${version})`,
} as const

const buildHead = (page: StrongConcordancePageData) => {
  const url = absoluteSiteUrl(buildStrongConcordancePath(page.language, page.code))
  const title = TITLES[page.language](
    displayStrongCode(page.code),
    `${page.original} (${page.gloss})`,
    page.version
  )
  return {
    meta: [
      { title },
      {
        name: 'description',
        content: `${title} : ${page.verseCount.toLocaleString(page.language)} versets.`,
      },
      // Book filters and following pages only rearrange the first page.
      ...(page.isFirstPage ? [] : [{ name: 'robots', content: 'noindex, follow' }]),
      { property: 'og:title', content: title },
      { property: 'og:url', content: url },
      { property: 'og:type', content: 'article' },
    ],
    links: [
      ...RESOURCE_FONT_PRELOADS,
      { rel: 'canonical', href: url },
      ...RESOURCE_LANGUAGES.map(language => ({
        rel: 'alternate',
        hrefLang: language,
        href: absoluteSiteUrl(buildStrongConcordancePath(language, page.code)),
      })),
    ],
  }
}

export const Route = createFileRoute('/strong/$language/$code_/concordance')({
  validateSearch: (search: Record<string, unknown>): ConcordanceSearch => ({
    ...(typeof search.book === 'string' ? { book: search.book } : {}),
    ...(typeof search.cursor === 'string' ? { cursor: search.cursor } : {}),
  }),
  beforeLoad: ({ params }) => {
    const identity = parseStrongCode(params.code)
    if (!isResourceLanguage(params.language) || !identity) throw notFound()
    const code = strongCodeSlug(identity.code)
    if (params.code !== code) {
      throw redirect({
        to: '/strong/$language/$code/concordance',
        params: { language: params.language, code },
        statusCode: 301,
      })
    }
  },
  loaderDeps: ({ search }) => search,
  loader: ({ params, deps }) =>
    loadStrongConcordancePage({ data: { language: params.language, code: params.code, ...deps } }),
  head: ({ loaderData }) => (loaderData ? buildHead(loaderData) : {}),
  // Only a rendered page is cacheable: a failed load must not be kept by the CDN.
  headers: ({ loaderData }) =>
    loaderData ? { 'Cache-Control': RESOURCE_PAGE_CACHE_CONTROL } : undefined,
  component: ConcordanceRoute,
})

function ConcordanceRoute() {
  return <StrongConcordancePage page={Route.useLoaderData()} />
}
