import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { DictionaryIndexPage } from '@/features/dictionary/DictionaryListPages'
import { loadDictionaryIndexPage } from '@/features/dictionary/dictionary.functions'
import { buildDictionaryIndexHead } from '@/features/dictionary/dictionaryHead'
import { isResourceLanguage, RESOURCE_PAGE_CACHE_CONTROL } from '@/features/resources/publicSite'

// `/dictionary/:language` — the dictionaries published in a language.
export const Route = createFileRoute('/dictionary/$language')({
  beforeLoad: ({ params }) => {
    const language = params.language.toLowerCase()
    if (!isResourceLanguage(language)) throw notFound()
    if (params.language !== language) {
      throw redirect({ to: '/dictionary/$language', params: { language }, statusCode: 301 })
    }
  },
  loader: ({ params }) => loadDictionaryIndexPage({ data: { language: params.language } }),
  head: ({ loaderData }) => (loaderData ? buildDictionaryIndexHead(loaderData) : {}),
  // Only a rendered page is cacheable: a failed load must not be kept by the CDN.
  headers: ({ loaderData }) =>
    loaderData ? { 'Cache-Control': RESOURCE_PAGE_CACHE_CONTROL } : undefined,
  component: DictionaryIndexRoute,
})

function DictionaryIndexRoute() {
  return <DictionaryIndexPage page={Route.useLoaderData()} />
}
