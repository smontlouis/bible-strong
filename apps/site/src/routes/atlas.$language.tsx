import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import AtlasHomePage from '@/features/atlas/AtlasHomePage'
import { loadAtlasHomePage } from '@/features/atlas/atlas.functions'
import { buildAtlasHomeHead } from '@/features/atlas/atlasHead'
import { parseAtlasRoute } from '@/features/atlas/atlasRoutes'
import { resourcePageHeaders } from '@/features/resources/pageHeaders'

// `/atlas/:language` — the entry of the atlas of biblical entities (ADR-0091).
export const Route = createFileRoute('/atlas/$language')({
  beforeLoad: ({ params }) => {
    const route = parseAtlasRoute({ language: params.language })
    if (!route) throw notFound()
    if (params.language !== route.language) {
      throw redirect({
        to: '/atlas/$language',
        params: { language: route.language },
        statusCode: 301,
      })
    }
  },
  loader: ({ params }) => loadAtlasHomePage({ data: { language: params.language } }),
  head: ({ loaderData }) => (loaderData ? buildAtlasHomeHead(loaderData) : {}),
  // Only a rendered page is cacheable: a failed load must not be kept by the CDN.
  headers: ({ loaderData }) => resourcePageHeaders(loaderData),
  component: AtlasHomeRoute,
})

function AtlasHomeRoute() {
  return <AtlasHomePage page={Route.useLoaderData()} />
}
