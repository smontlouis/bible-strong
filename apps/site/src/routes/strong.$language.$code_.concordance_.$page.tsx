import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { isResourceLanguage, RESOURCE_PAGE_CACHE_CONTROL } from '@/features/resources/publicSite'
import StrongConcordancePage from '@/features/strong/StrongConcordancePage'
import { loadStrongConcordancePage } from '@/features/strong/strong.functions'
import {
  buildConcordanceHead,
  parseConcordancePage,
  validateConcordanceSearch,
} from '@/features/strong/strongConcordanceHead'
import { parseStrongCode, strongCodeSlug } from '@/features/strong/strongRoutes'

// `/strong/:language/:code/concordance/:page` — a numbered page of a concordance.
export const Route = createFileRoute('/strong/$language/$code_/concordance_/$page')({
  validateSearch: validateConcordanceSearch,
  beforeLoad: ({ params, search }) => {
    const identity = parseStrongCode(params.code)
    const page = parseConcordancePage(params.page)
    if (!isResourceLanguage(params.language) || !identity || !page) throw notFound()
    const code = strongCodeSlug(identity.code)
    // The first page has no number, so it has a single address.
    if (page === 1) {
      throw redirect({
        to: '/strong/$language/$code/concordance',
        params: { language: params.language, code },
        search,
        statusCode: 301,
      })
    }
    if (params.code !== code) {
      throw redirect({
        to: '/strong/$language/$code/concordance/$page',
        params: { language: params.language, code, page: String(page) },
        search,
        statusCode: 301,
      })
    }
  },
  loaderDeps: ({ search }) => search,
  loader: ({ params, deps }) =>
    loadStrongConcordancePage({
      data: {
        language: params.language,
        code: params.code,
        book: deps.book,
        page: parseConcordancePage(params.page),
      },
    }),
  head: ({ loaderData }) => (loaderData ? buildConcordanceHead(loaderData) : {}),
  // Only a rendered page is cacheable: a failed load must not be kept by the CDN.
  headers: ({ loaderData }) =>
    loaderData ? { 'Cache-Control': RESOURCE_PAGE_CACHE_CONTROL } : undefined,
  component: ConcordancePageRoute,
})

function ConcordancePageRoute() {
  return <StrongConcordancePage page={Route.useLoaderData()} />
}
