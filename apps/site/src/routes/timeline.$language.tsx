import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { resourcePageHeaders } from '@/features/resources/pageHeaders'
import TimelineIndexPage from '@/features/timeline/TimelineIndexPage'
import { loadTimelineIndexPage } from '@/features/timeline/timeline.functions'
import { buildTimelineIndexHead } from '@/features/timeline/timelineHead'
import { parseTimelineRoute } from '@/features/timeline/timelineRoutes'

// `/timeline/:language` — the timeline of a language, the first route of ADR-0056.
export const Route = createFileRoute('/timeline/$language')({
  beforeLoad: ({ params }) => {
    const route = parseTimelineRoute({ language: params.language })
    if (!route) throw notFound()
    // Any other spelling of a valid path is redirected to its canonical form.
    if (params.language !== route.language) {
      throw redirect({
        to: '/timeline/$language',
        params: { language: route.language },
        statusCode: 301,
      })
    }
  },
  loader: ({ params }) => loadTimelineIndexPage({ data: { language: params.language } }),
  head: ({ loaderData }) => (loaderData ? buildTimelineIndexHead(loaderData) : {}),
  // Only a rendered page is cacheable: a failed load must not be kept by the CDN.
  headers: ({ loaderData }) => resourcePageHeaders(loaderData),
  component: TimelineIndexRoute,
})

function TimelineIndexRoute() {
  return <TimelineIndexPage page={Route.useLoaderData()} />
}
