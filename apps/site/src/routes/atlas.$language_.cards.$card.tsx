import { createFileRoute, notFound } from '@tanstack/react-router'
import { loadAtlasCardPage } from '@/features/atlas/atlas.functions'
import { rememberedCardPage } from '@/features/atlas/atlasCardsMemory'
import { buildAtlasCardHead } from '@/features/atlas/atlasHead'
import { parseAtlasCardId, parseAtlasRoute } from '@/features/atlas/atlasRoutes'
import { resourcePageHeaders } from '@/features/resources/pageHeaders'

// `/atlas/:language/cards/:card` — one card opened over the gallery, which draws it. This route
// gives its address, its head and its share image.
export const Route = createFileRoute('/atlas/$language_/cards/$card')({
  beforeLoad: ({ params }) => {
    if (!parseAtlasCardId(params.card)) throw notFound()
  },
  loader: async ({ params }) => {
    const route = parseAtlasRoute({ language: params.language })
    const id = parseAtlasCardId(params.card)
    if (!route || !id) throw notFound()
    return (
      rememberedCardPage(route.language, id) ??
      (await loadAtlasCardPage({ data: { language: route.language, id } }))
    )
  },
  head: ({ loaderData }) => (loaderData ? buildAtlasCardHead(loaderData) : {}),
  headers: ({ loaderData }) => resourcePageHeaders(loaderData),
  component: () => null,
})
