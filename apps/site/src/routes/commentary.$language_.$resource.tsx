import { createFileRoute, notFound } from '@tanstack/react-router'
import CommentaryPage from '@/features/commentary/CommentaryPage'
import { loadCommentaryPage } from '@/features/commentary/commentary.functions'
import { buildCommentaryHead } from '@/features/commentary/commentaryHead'
import { isCommentaryResourceSlug } from '@/features/commentary/commentaryRoutes'
import { isResourceLanguage, RESOURCE_PAGE_CACHE_CONTROL } from '@/features/resources/publicSite'

// `/commentary/:language/:resource` — a commentary and the chapters it covers.
export const Route = createFileRoute('/commentary/$language_/$resource')({
  beforeLoad: ({ params }) => {
    if (!isResourceLanguage(params.language) || !isCommentaryResourceSlug(params.resource)) {
      throw notFound()
    }
  },
  loader: ({ params }) => loadCommentaryPage({ data: params }),
  head: ({ loaderData }) => (loaderData ? buildCommentaryHead(loaderData) : {}),
  // Only a rendered page is cacheable: a failed load must not be kept by the CDN.
  headers: ({ loaderData }) =>
    loaderData ? { 'Cache-Control': RESOURCE_PAGE_CACHE_CONTROL } : undefined,
  component: CommentaryRoute,
})

function CommentaryRoute() {
  return <CommentaryPage page={Route.useLoaderData()} />
}
