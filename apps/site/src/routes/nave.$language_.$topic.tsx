import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import NaveTopicPage from '@/features/nave/NaveTopicPage'
import { loadNaveTopicPage } from '@/features/nave/nave.functions'
import { buildNaveTopicHead } from '@/features/nave/naveHead'
import { buildNavePath, parseNaveTopic } from '@/features/nave/naveRoutes'
import { resourcePageHeaders } from '@/features/resources/pageHeaders'
import { isResourceLanguage } from '@/features/resources/publicSite'

// `/nave/:language/:topic` — a topic under its published name, the route of ADR-0054.
export const Route = createFileRoute('/nave/$language_/$topic')({
  beforeLoad: ({ params, location }) => {
    const topic = parseNaveTopic(params.topic)
    if (!isResourceLanguage(params.language) || !topic) throw notFound()
    // A name has one written form in a path. The parameter reads the same whatever its
    // percent-encoding, so the requested path itself is compared. The server has already
    // decoded what needs no encoding (`%61` for `a`): only the other spellings are left.
    const canonicalPath = buildNavePath(params.language, topic)
    if (location.href.split(/[?#]/u)[0] !== canonicalPath) {
      throw redirect({ href: canonicalPath, statusCode: 301 })
    }
  },
  loader: ({ params }) =>
    loadNaveTopicPage({ data: { language: params.language, topic: params.topic } }),
  head: ({ loaderData }) => (loaderData ? buildNaveTopicHead(loaderData) : {}),
  // Only a rendered topic is cacheable: a failed load must not be kept by the CDN.
  headers: ({ loaderData }) => resourcePageHeaders(loaderData),
  component: NaveTopicRoute,
})

function NaveTopicRoute() {
  return <NaveTopicPage topic={Route.useLoaderData()} />
}
