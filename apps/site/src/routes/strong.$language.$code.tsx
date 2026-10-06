import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { isResourceLanguage, RESOURCE_PAGE_CACHE_CONTROL } from '@/features/resources/publicSite'
import StrongEntryPage from '@/features/strong/StrongEntryPage'
import { loadStrongPage } from '@/features/strong/strong.functions'
import { buildStrongHead } from '@/features/strong/strongHead'
import { parseStrongCode, strongCodeSlug } from '@/features/strong/strongRoutes'

export const Route = createFileRoute('/strong/$language/$code')({
  beforeLoad: ({ params }) => {
    const identity = parseStrongCode(params.code)
    if (!isResourceLanguage(params.language) || !identity) throw notFound()
    const code = strongCodeSlug(identity.code)
    if (params.code !== code) {
      throw redirect({
        to: '/strong/$language/$code',
        params: { language: params.language, code },
        statusCode: 301,
      })
    }
  },
  loader: ({ params }) => loadStrongPage({ data: { language: params.language, code: params.code } }),
  head: ({ loaderData }) => (loaderData ? buildStrongHead(loaderData) : {}),
  // Only a rendered entry is cacheable: a failed load must not be kept by the CDN.
  headers: ({ loaderData }) =>
    loaderData ? { 'Cache-Control': RESOURCE_PAGE_CACHE_CONTROL } : undefined,
  component: StrongRoute,
})

function StrongRoute() {
  return <StrongEntryPage entry={Route.useLoaderData()} />
}
