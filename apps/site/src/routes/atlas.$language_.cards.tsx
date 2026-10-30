import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import AtlasCardsPage from '@/features/atlas/AtlasCardsPage'
import { loadAtlasCardsPage } from '@/features/atlas/atlas.functions'
import { rememberCardsPage, rememberedCardsPage } from '@/features/atlas/atlasCardsMemory'
import { parseAtlasRoute } from '@/features/atlas/atlasRoutes'
import { resourcePageHeaders } from '@/features/resources/pageHeaders'

// `/atlas/:language/cards` — every card of the atlas, which a card opened at its own address
// lies over (ADR-0090, ADR-0091). The head is the child's: the gallery's own, or the card's.
export const Route = createFileRoute('/atlas/$language_/cards')({
  beforeLoad: ({ params, location }) => {
    const route = parseAtlasRoute({ language: params.language })
    if (!route) throw notFound()
    if (params.language !== route.language) {
      throw redirect({
        href: location.pathname.replace(`/atlas/${params.language}/`, `/atlas/${route.language}/`),
        statusCode: 301,
      })
    }
  },
  loader: async ({ params }) => {
    const route = parseAtlasRoute({ language: params.language })
    if (!route) throw notFound()
    const page =
      rememberedCardsPage(route.language) ??
      (await loadAtlasCardsPage({ data: { language: route.language } }))
    rememberCardsPage(page)
    return page
  },
  // Opening a card, or closing it, keeps the gallery as it is.
  staleTime: Infinity,
  shouldReload: false,
  headers: ({ loaderData }) => resourcePageHeaders(loaderData),
  component: AtlasCardsRoute,
})

function AtlasCardsRoute() {
  return <AtlasCardsPage page={Route.useLoaderData()} />
}
