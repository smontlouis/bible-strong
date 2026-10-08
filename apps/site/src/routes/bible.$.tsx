import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import BiblePage from '@/features/bible/BiblePage'
import { loadBiblePage } from '@/features/bible/bible.functions'
import { resourcePageHeaders } from '@/features/resources/pageHeaders'
import { validateBibleSearch } from '@/features/bible/bibleCommentaries'
import { buildBibleHead } from '@/features/bible/bibleHead'
import { buildBiblePath, parseBibleRoute } from '@/features/bible/bibleRoutes'

// `/bible/:version[/:presentation[/:language]]/:book/:chapter[/:passage]`, the grammar of ADR-0053.
export const Route = createFileRoute('/bible/$')({
  // `?commentary=barnes.mhy-fr`: the commentaries the reader shows in the text.
  validateSearch: validateBibleSearch,
  beforeLoad: ({ params, search }) => {
    // A book without a chapter opens on its first chapter.
    const route = parseBibleRoute(params._splat) ?? parseBibleRoute(`${params._splat}/1`)
    if (!route) throw notFound()
    // Any other spelling of a valid passage is redirected to its canonical path.
    const canonical = buildBiblePath({ ...route, versionId: route.version.id })
    if (`/bible/${params._splat}` !== canonical) {
      throw redirect({
        to: '/bible/$',
        params: { _splat: canonical.slice('/bible/'.length) },
        search,
        statusCode: 301,
      })
    }
  },
  loaderDeps: ({ search }) => search,
  loader: ({ params, deps }) =>
    loadBiblePage({ data: { path: params._splat ?? '', commentary: deps.commentary } }),
  head: ({ loaderData }) => (loaderData ? buildBibleHead(loaderData) : {}),
  // Only a whole rendered passage is kept for long: a page missing a part it could not read
  // is kept a minute, a failed load not at all.
  headers: ({ loaderData }) => resourcePageHeaders(loaderData),
  component: BibleRoute,
})

function BibleRoute() {
  return <BiblePage page={Route.useLoaderData()} />
}
