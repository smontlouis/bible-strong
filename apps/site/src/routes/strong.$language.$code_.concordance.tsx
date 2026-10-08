import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { resourcePageHeaders } from '@/features/resources/pageHeaders'
import { isResourceLanguage } from '@/features/resources/publicSite'
import StrongConcordancePage from '@/features/strong/StrongConcordancePage'
import { loadStrongConcordancePage } from '@/features/strong/strong.functions'
import {
  buildConcordanceHead,
  validateConcordanceSearch,
} from '@/features/strong/strongConcordanceHead'
import { parseStrongCode, strongCodeSlug } from '@/features/strong/strongRoutes'

// The first page of a concordance; the following ones carry their number in the path.
export const Route = createFileRoute('/strong/$language/$code_/concordance')({
  validateSearch: validateConcordanceSearch,
  beforeLoad: ({ params, search }) => {
    const identity = parseStrongCode(params.code)
    if (!isResourceLanguage(params.language) || !identity) throw notFound()
    const code = strongCodeSlug(identity.code)
    if (params.code !== code) {
      throw redirect({
        to: '/strong/$language/$code/concordance',
        params: { language: params.language, code },
        search,
        statusCode: 301,
      })
    }
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps }) => {
    const page = await loadStrongConcordancePage({
      data: { language: params.language, code: params.code, book: deps.book, page: 1 },
    })
    // The verses of a number that has a page are told apart there, sense by sense.
    if ('kind' in page) {
      throw redirect({
        to: '/strong/$language/$code',
        params: { language: params.language, code: strongCodeSlug(page.code) },
        statusCode: 301,
      })
    }
    // The concordance is the one of a sense, at the address of that sense.
    const code = strongCodeSlug(page.code)
    if (params.code !== code) {
      throw redirect({
        to: '/strong/$language/$code/concordance',
        params: { language: params.language, code },
        search: deps,
        statusCode: 301,
      })
    }
    return page
  },
  head: ({ loaderData }) => (loaderData ? buildConcordanceHead(loaderData) : {}),
  // Only a rendered page is cacheable: a failed load must not be kept by the CDN.
  headers: ({ loaderData }) => resourcePageHeaders(loaderData),
  component: ConcordanceRoute,
})

function ConcordanceRoute() {
  return <StrongConcordancePage page={Route.useLoaderData()} />
}
