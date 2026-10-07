import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { DictionaryLetterPage } from '@/features/dictionary/DictionaryListPages'
import { loadDictionaryLetterPage } from '@/features/dictionary/dictionary.functions'
import { buildDictionaryLetterHead } from '@/features/dictionary/dictionaryHead'
import {
  DICTIONARY_LETTERS,
  parseDictionaryWorkRoute,
  validateDictionaryListSearch,
} from '@/features/dictionary/dictionaryRoutes'
import { RESOURCE_PAGE_CACHE_CONTROL } from '@/features/resources/publicSite'

// `/dictionary/:language/:work/:letter` — the articles of a work filed under a letter,
// a numbered page at a time (`?page=2`). An article address has one more segment.
export const Route = createFileRoute('/dictionary/$language_/$work_/$letter')({
  validateSearch: validateDictionaryListSearch,
  beforeLoad: ({ params, search }) => {
    const route = parseDictionaryWorkRoute(params)
    const letter = params.letter.toLowerCase()
    if (!route || !DICTIONARY_LETTERS.includes(letter)) throw notFound()
    // The first page has no number, so it has a single address.
    const page = search.page === 1 ? undefined : search.page
    if (
      params.language !== route.language ||
      params.work !== route.work ||
      params.letter !== letter ||
      search.page !== page
    ) {
      throw redirect({
        to: '/dictionary/$language/$work/$letter',
        params: { ...route, letter },
        search: { page },
        statusCode: 301,
      })
    }
  },
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: ({ params, deps }) =>
    loadDictionaryLetterPage({
      data: {
        language: params.language,
        work: params.work,
        letter: params.letter,
        page: deps.page,
      },
    }),
  head: ({ loaderData }) => (loaderData ? buildDictionaryLetterHead(loaderData) : {}),
  // Only a rendered page is cacheable: a failed load must not be kept by the CDN.
  headers: ({ loaderData }) =>
    loaderData ? { 'Cache-Control': RESOURCE_PAGE_CACHE_CONTROL } : undefined,
  component: DictionaryLetterRoute,
})

function DictionaryLetterRoute() {
  return <DictionaryLetterPage page={Route.useLoaderData()} />
}
