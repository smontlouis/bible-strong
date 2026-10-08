import { createFileRoute, notFound } from '@tanstack/react-router'
import CommentaryIndexPage from '@/features/commentary/CommentaryIndexPage'
import { loadCommentaryIndexPage } from '@/features/commentary/commentary.functions'
import { buildCommentaryIndexHead } from '@/features/commentary/commentaryHead'
import { resourcePageHeaders } from '@/features/resources/pageHeaders'
import { isResourceLanguage } from '@/features/resources/publicSite'

// `/commentary/:language` — the commentaries published in a language.
export const Route = createFileRoute('/commentary/$language')({
  beforeLoad: ({ params }) => {
    if (!isResourceLanguage(params.language)) throw notFound()
  },
  loader: ({ params }) => loadCommentaryIndexPage({ data: { language: params.language } }),
  head: ({ loaderData }) => (loaderData ? buildCommentaryIndexHead(loaderData.language) : {}),
  // Only a rendered page is cacheable: a failed load must not be kept by the CDN.
  headers: ({ loaderData }) => resourcePageHeaders(loaderData),
  component: CommentaryIndexRoute,
})

function CommentaryIndexRoute() {
  return <CommentaryIndexPage page={Route.useLoaderData()} />
}
