import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { NaveLetterPage } from '@/features/nave/NavePages'
import { loadNaveLetterPage } from '@/features/nave/nave.functions'
import { buildNaveLetterHead } from '@/features/nave/naveHead'
import { isNaveLetter } from '@/features/nave/naveRoutes'
import { isResourceLanguage, RESOURCE_PAGE_CACHE_CONTROL } from '@/features/resources/publicSite'

// `/nave/:language/index/:letter` — the first page of a letter; the following ones carry
// their number in the path.
export const Route = createFileRoute('/nave/$language_/index/$letter')({
  beforeLoad: ({ params }) => {
    const { language } = params
    const letter = params.letter.toLowerCase()
    if (!isResourceLanguage(language) || !isNaveLetter(letter)) throw notFound()
    if (params.letter !== letter) {
      throw redirect({
        to: '/nave/$language/index/$letter',
        params: { language, letter },
        statusCode: 301,
      })
    }
  },
  loader: ({ params }) =>
    loadNaveLetterPage({ data: { language: params.language, letter: params.letter, page: 1 } }),
  head: ({ loaderData }) => (loaderData ? buildNaveLetterHead(loaderData) : {}),
  // Only a rendered page is cacheable: a failed load must not be kept by the CDN.
  headers: ({ loaderData }) =>
    loaderData ? { 'Cache-Control': RESOURCE_PAGE_CACHE_CONTROL } : undefined,
  component: NaveLetterRoute,
})

function NaveLetterRoute() {
  return <NaveLetterPage page={Route.useLoaderData()} />
}
