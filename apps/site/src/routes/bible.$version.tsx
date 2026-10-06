import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { BibleVersionPage } from '@/features/bible/BibleHubPages'
import { loadBibleVersionPage } from '@/features/bible/bible.functions'
import { buildBibleVersionHead } from '@/features/bible/bibleHead'
import { bibleVersionSlug, findBibleVersion } from '@/features/bible/bibleVersions'
import { RESOURCE_PAGE_CACHE_CONTROL } from '@/features/resources/publicSite'

// `/bible/:version` — the books and chapters of a version.
export const Route = createFileRoute('/bible/$version')({
  beforeLoad: ({ params }) => {
    const version = findBibleVersion(params.version)
    if (!version) throw notFound()
    const slug = bibleVersionSlug(version.id)
    if (params.version !== slug) {
      throw redirect({ to: '/bible/$version', params: { version: slug }, statusCode: 301 })
    }
  },
  loader: ({ params }) => loadBibleVersionPage({ data: { version: params.version } }),
  head: ({ loaderData }) => (loaderData ? buildBibleVersionHead(loaderData) : {}),
  headers: ({ loaderData }) =>
    loaderData ? { 'Cache-Control': RESOURCE_PAGE_CACHE_CONTROL } : undefined,
  component: BibleVersionRoute,
})

function BibleVersionRoute() {
  return <BibleVersionPage page={Route.useLoaderData()} />
}
