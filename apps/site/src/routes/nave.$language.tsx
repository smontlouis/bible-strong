import { createFileRoute, notFound } from '@tanstack/react-router'
import { NaveIndexPage } from '@/features/nave/NavePages'
import { loadNaveIndexPage } from '@/features/nave/nave.functions'
import { buildNaveIndexHead } from '@/features/nave/naveHead'
import { isResourceLanguage, RESOURCE_PAGE_CACHE_CONTROL } from '@/features/resources/publicSite'

// `/nave/:language` — the topics of a publication, filed by letter.
export const Route = createFileRoute('/nave/$language')({
  beforeLoad: ({ params }) => {
    if (!isResourceLanguage(params.language)) throw notFound()
  },
  loader: ({ params }) => loadNaveIndexPage({ data: { language: params.language } }),
  head: ({ loaderData }) => (loaderData ? buildNaveIndexHead(loaderData) : {}),
  // Only a rendered page is cacheable: a failed load must not be kept by the CDN.
  headers: ({ loaderData }) =>
    loaderData ? { 'Cache-Control': RESOURCE_PAGE_CACHE_CONTROL } : undefined,
  component: NaveIndexRoute,
})

function NaveIndexRoute() {
  return <NaveIndexPage page={Route.useLoaderData()} />
}
