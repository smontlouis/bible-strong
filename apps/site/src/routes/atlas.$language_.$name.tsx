import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import AtlasEntityPage from '@/features/atlas/AtlasEntityPage'
import AtlasFamilyPage from '@/features/atlas/AtlasFamilyPage'
import { loadAtlasEntityPage, loadAtlasFamilyPage } from '@/features/atlas/atlas.functions'
import { buildAtlasEntityHead, buildAtlasFamilyHead } from '@/features/atlas/atlasHead'
import { parseAtlasRoute } from '@/features/atlas/atlasRoutes'
import { resourcePageHeaders } from '@/features/resources/pageHeaders'

// `/atlas/:language/:name` — a family of the atlas (`people`, `places`…) or one entity by its
// unique name, which always holds `@` (ADR-0091).
export const Route = createFileRoute('/atlas/$language_/$name')({
  beforeLoad: ({ params }) => {
    const route = parseAtlasRoute(params)
    if (!route || route.kind === 'home') throw notFound()
    // The language and a family are lowercase; a unique name keeps its own case.
    const name = route.kind === 'family' ? route.family : params.name
    if (params.language !== route.language || params.name !== name) {
      throw redirect({
        to: '/atlas/$language/$name',
        params: { language: route.language, name },
        statusCode: 301,
      })
    }
  },
  loader: async ({ params }) => {
    const route = parseAtlasRoute(params)
    if (!route || route.kind === 'home') throw notFound()
    return route.kind === 'family'
      ? {
          kind: 'family' as const,
          page: await loadAtlasFamilyPage({
            data: { language: route.language, family: route.family },
          }),
        }
      : {
          kind: 'entity' as const,
          page: await loadAtlasEntityPage({
            data: { language: route.language, uniqueName: route.uniqueName },
          }),
        }
  },
  head: ({ loaderData }) =>
    !loaderData
      ? {}
      : loaderData.kind === 'family'
        ? buildAtlasFamilyHead(loaderData.page)
        : buildAtlasEntityHead(loaderData.page),
  // Only a rendered page is cacheable: a failed load must not be kept by the CDN.
  headers: ({ loaderData }) => resourcePageHeaders(loaderData?.page),
  component: AtlasNameRoute,
})

function AtlasNameRoute() {
  const data = Route.useLoaderData()
  return data.kind === 'family' ? (
    <AtlasFamilyPage page={data.page} />
  ) : (
    <AtlasEntityPage page={data.page} />
  )
}
