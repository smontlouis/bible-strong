import { createFileRoute, notFound } from '@tanstack/react-router'
import AtlasCardStand from '@/features/atlas/AtlasCardStand'
import { loadAtlasCardsPage } from '@/features/atlas/atlas.functions'
import { parseAtlasRoute } from '@/features/atlas/atlasRoutes'
import { resourcePageHeaders } from '@/features/resources/pageHeaders'

// `/atlas/:language/cards/stand` — the cards turning by themselves on a screen of a stand. It is
// reached by its address only, and stays out of the search engines.
export const Route = createFileRoute('/atlas/$language_/cards_/stand')({
  loader: async ({ params }) => {
    const route = parseAtlasRoute({ language: params.language })
    if (!route) throw notFound()
    return loadAtlasCardsPage({ data: { language: route.language } })
  },
  headers: ({ loaderData }) => resourcePageHeaders(loaderData),
  head: () => ({
    meta: [{ title: 'Bible Strong' }, { name: 'robots', content: 'noindex, nofollow' }],
  }),
  component: AtlasCardStandRoute,
})

function AtlasCardStandRoute() {
  const page = Route.useLoaderData()
  return <AtlasCardStand cards={page.cards} language={page.language} />
}
