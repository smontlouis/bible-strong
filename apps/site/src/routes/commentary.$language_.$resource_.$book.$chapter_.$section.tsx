import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { locateCommentarySection } from '@/features/commentary/commentary.functions'
import {
  commentaryRouteParams,
  commentarySectionAnchor,
  parseCommentaryRoute,
} from '@/features/commentary/commentaryRoutes'

// `/commentary/:language/:resource/:book/:chapter/:section` (ADR-0054). A chapter page
// carries every section of the chapter, so a section has no page of its own: its address
// leads permanently to its anchor in the chapter, and an unknown section does not exist.
export const Route = createFileRoute(
  '/commentary/$language_/$resource_/$book/$chapter_/$section'
)({
  beforeLoad: async ({ params }) => {
    const route = parseCommentaryRoute(params)
    if (!route?.section) throw notFound()
    const { page } = await locateCommentarySection({ data: params })
    throw redirect({
      to: '/commentary/$language/$resource/$book/$chapter',
      params: commentaryRouteParams(route),
      search: page > 1 ? { page } : {},
      hash: commentarySectionAnchor(route.section),
      statusCode: 301,
    })
  },
})
