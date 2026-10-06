import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import BiblePage from '@/features/bible/BiblePage'
import { loadBiblePage } from '@/features/bible/bible.functions'
import { buildBibleHead } from '@/features/bible/bibleHead'
import { buildBiblePath, parseBibleRoute } from '@/features/bible/bibleRoutes'
import { RESOURCE_PAGE_CACHE_CONTROL } from '@/features/resources/publicSite'

// `/bible/:version[/:presentation[/:language]]/:book/:chapter[/:passage]`, the grammar of ADR-0053.
export const Route = createFileRoute('/bible/$')({
  beforeLoad: ({ params }) => {
    // A book without a chapter opens on its first chapter.
    const route = parseBibleRoute(params._splat) ?? parseBibleRoute(`${params._splat}/1`)
    if (!route) throw notFound()
    // Any other spelling of a valid passage is redirected to its canonical path.
    const canonical = buildBiblePath({ ...route, versionId: route.version.id })
    if (`/bible/${params._splat}` !== canonical) {
      throw redirect({
        to: '/bible/$',
        params: { _splat: canonical.slice('/bible/'.length) },
        statusCode: 301,
      })
    }
  },
  loader: ({ params }) => loadBiblePage({ data: { path: params._splat ?? '' } }),
  head: ({ loaderData }) => (loaderData ? buildBibleHead(loaderData) : {}),
  // Only a rendered passage is cacheable: a failed load must not be kept by the CDN.
  headers: ({ loaderData }) =>
    loaderData ? { 'Cache-Control': RESOURCE_PAGE_CACHE_CONTROL } : undefined,
  component: BibleRoute,
})

function BibleRoute() {
  return <BiblePage page={Route.useLoaderData()} />
}
