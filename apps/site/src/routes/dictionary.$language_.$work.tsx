import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { DictionaryWorkPage } from '@/features/dictionary/DictionaryListPages'
import { loadDictionaryWorkPage } from '@/features/dictionary/dictionary.functions'
import { buildDictionaryWorkHead } from '@/features/dictionary/dictionaryHead'
import { parseDictionaryWorkRoute } from '@/features/dictionary/dictionaryRoutes'
import { RESOURCE_PAGE_CACHE_CONTROL } from '@/features/resources/publicSite'

// `/dictionary/:language/:work` — a dictionary and its alphabet.
export const Route = createFileRoute('/dictionary/$language_/$work')({
  beforeLoad: ({ params }) => {
    const route = parseDictionaryWorkRoute(params)
    if (!route) throw notFound()
    if (params.language !== route.language || params.work !== route.work) {
      throw redirect({ to: '/dictionary/$language/$work', params: route, statusCode: 301 })
    }
  },
  loader: ({ params }) =>
    loadDictionaryWorkPage({ data: { language: params.language, work: params.work } }),
  head: ({ loaderData }) => (loaderData ? buildDictionaryWorkHead(loaderData) : {}),
  // Only a rendered page is cacheable: a failed load must not be kept by the CDN.
  headers: ({ loaderData }) =>
    loaderData ? { 'Cache-Control': RESOURCE_PAGE_CACHE_CONTROL } : undefined,
  component: DictionaryWorkRoute,
})

function DictionaryWorkRoute() {
  return <DictionaryWorkPage page={Route.useLoaderData()} />
}
