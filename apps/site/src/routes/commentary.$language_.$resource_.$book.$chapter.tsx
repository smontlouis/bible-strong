import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import CommentaryChapterPage from '@/features/commentary/CommentaryChapterPage'
import { loadCommentaryChapterPage } from '@/features/commentary/commentary.functions'
import { buildCommentaryChapterHead } from '@/features/commentary/commentaryHead'
import {
  commentaryRouteParams,
  parseCommentaryRoute,
  validateCommentarySearch,
} from '@/features/commentary/commentaryRoutes'
import { resourcePageHeaders } from '@/features/resources/pageHeaders'

// `/commentary/:language/:resource/:book/:chapter`, the grammar of ADR-0054. A chapter too
// long for one page continues on `?page=2` and the following.
export const Route = createFileRoute('/commentary/$language_/$resource_/$book/$chapter')({
  validateSearch: validateCommentarySearch,
  beforeLoad: ({ params, search }) => {
    const route = parseCommentaryRoute(params)
    if (!route) throw notFound()
    // Any other spelling of the book or the chapter is redirected to the canonical one,
    // and the first page has a single address, without a number.
    const canonical = commentaryRouteParams(route)
    if (
      params.book !== canonical.book ||
      params.chapter !== canonical.chapter ||
      search.page === 1
    ) {
      throw redirect({
        to: '/commentary/$language/$resource/$book/$chapter',
        params: canonical,
        search: search.page && search.page > 1 ? { page: search.page } : {},
        statusCode: 301,
      })
    }
  },
  loaderDeps: ({ search }) => search,
  loader: ({ params, deps }) => loadCommentaryChapterPage({ data: { ...params, page: deps.page } }),
  head: ({ loaderData }) => (loaderData ? buildCommentaryChapterHead(loaderData) : {}),
  // Only a rendered chapter is cacheable: a failed load must not be kept by the CDN.
  headers: ({ loaderData }) => resourcePageHeaders(loaderData),
  component: CommentaryChapterRoute,
})

function CommentaryChapterRoute() {
  return <CommentaryChapterPage page={Route.useLoaderData()} />
}
