import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { RESOURCE_PAGE_CACHE_CONTROL } from '@/features/resources/publicSite'
import TimelineEventPage from '@/features/timeline/TimelineEventPage'
import { loadTimelineEventPage } from '@/features/timeline/timeline.functions'
import { buildTimelineEventHead } from '@/features/timeline/timelineHead'
import { parseTimelineRoute } from '@/features/timeline/timelineRoutes'

// `/timeline/:language/:slug` — an event of the timeline, the second route of ADR-0056.
export const Route = createFileRoute('/timeline/$language_/$slug')({
  beforeLoad: ({ params }) => {
    const route = parseTimelineRoute(params)
    if (!route?.slug) throw notFound()
    // Any other spelling of a valid path is redirected to its canonical form.
    if (params.language !== route.language || params.slug !== route.slug) {
      throw redirect({
        to: '/timeline/$language/$slug',
        params: { language: route.language, slug: route.slug },
        statusCode: 301,
      })
    }
  },
  loader: ({ params }) =>
    loadTimelineEventPage({ data: { language: params.language, slug: params.slug } }),
  head: ({ loaderData }) => (loaderData ? buildTimelineEventHead(loaderData) : {}),
  // Only a rendered event is cacheable: a failed load must not be kept by the CDN.
  headers: ({ loaderData }) =>
    loaderData ? { 'Cache-Control': RESOURCE_PAGE_CACHE_CONTROL } : undefined,
  component: TimelineEventRoute,
})

function TimelineEventRoute() {
  return <TimelineEventPage event={Route.useLoaderData()} />
}
