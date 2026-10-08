import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import DictionaryTermPage from '@/features/dictionary/DictionaryTermPage'
import { loadDictionaryTermPage } from '@/features/dictionary/dictionary.functions'
import { buildDictionaryTermHead } from '@/features/dictionary/dictionaryHead'
import {
  createDictionaryArticleSlug,
  parseDictionaryTermSlug,
} from '@/features/dictionary/dictionaryRoutes'
import { resourcePageHeaders } from '@/features/resources/pageHeaders'
import { isResourceLanguage } from '@/features/resources/publicSite'

// `/dictionary/:language/term/:slug` — a term in every dictionary of a language (ADR-0068).
export const Route = createFileRoute('/dictionary/$language_/term/$slug')({
  beforeLoad: ({ params }) => {
    if (!isResourceLanguage(params.language) || !parseDictionaryTermSlug(params.slug)) {
      throw notFound()
    }
  },
  loader: async ({ params }) => {
    const page = await loadDictionaryTermPage({
      data: { language: params.language, slug: params.slug },
    })
    // A term one dictionary holds has nothing to gather: its article is the page.
    if (page.kind === 'article') {
      throw redirect({
        to: '/dictionary/$language/$work/$entryId/$slug',
        params: {
          language: params.language,
          work: page.work,
          entryId: String(page.id),
          slug: createDictionaryArticleSlug(page.word),
        },
        statusCode: 301,
      })
    }
    return page
  },
  head: ({ loaderData }) => (loaderData ? buildDictionaryTermHead(loaderData) : {}),
  headers: ({ loaderData }) => resourcePageHeaders(loaderData),
  component: DictionaryTermRoute,
})

function DictionaryTermRoute() {
  return <DictionaryTermPage page={Route.useLoaderData()} />
}
