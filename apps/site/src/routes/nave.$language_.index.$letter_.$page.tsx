import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { NaveLetterPage } from '@/features/nave/NavePages'
import { loadNaveLetterPage } from '@/features/nave/nave.functions'
import { buildNaveLetterHead } from '@/features/nave/naveHead'
import { isNaveLetter, parseNavePageNumber } from '@/features/nave/naveRoutes'
import { isResourceLanguage, RESOURCE_PAGE_CACHE_CONTROL } from '@/features/resources/publicSite'

// `/nave/:language/index/:letter/:page` — a numbered page of a letter.
export const Route = createFileRoute('/nave/$language_/index/$letter_/$page')({
  beforeLoad: ({ params }) => {
    const { language } = params
    const letter = params.letter.toLowerCase()
    const page = parseNavePageNumber(params.page)
    if (!isResourceLanguage(language) || !isNaveLetter(letter) || !page) throw notFound()
    // The first page has no number, so it has a single address.
    if (page === 1) {
      throw redirect({
        to: '/nave/$language/index/$letter',
        params: { language, letter },
        statusCode: 301,
      })
    }
    if (params.letter !== letter) {
      throw redirect({
        to: '/nave/$language/index/$letter/$page',
        params: { language, letter, page: String(page) },
        statusCode: 301,
      })
    }
  },
  loader: ({ params }) =>
    loadNaveLetterPage({
      data: {
        language: params.language,
        letter: params.letter,
        page: parseNavePageNumber(params.page),
      },
    }),
  head: ({ loaderData }) => (loaderData ? buildNaveLetterHead(loaderData) : {}),
  // Only a rendered page is cacheable: a failed load must not be kept by the CDN.
  headers: ({ loaderData }) =>
    loaderData ? { 'Cache-Control': RESOURCE_PAGE_CACHE_CONTROL } : undefined,
  component: NaveLetterPageRoute,
})

function NaveLetterPageRoute() {
  return <NaveLetterPage page={Route.useLoaderData()} />
}
