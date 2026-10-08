import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { pageCacheHeaders } from '@/features/resources/pageReads'
import { isResourceLanguage } from '@/features/resources/publicSite'
import StrongEntryPage from '@/features/strong/StrongEntryPage'
import StrongNumberPage from '@/features/strong/StrongNumberPage'
import { loadStrongPage } from '@/features/strong/strong.functions'
import { buildStrongHead } from '@/features/strong/strongHead'
import { buildStrongNumberHead } from '@/features/strong/strongNumberHead'
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
  loader: async ({ params }) => {
    const entry = await loadStrongPage({ data: { language: params.language, code: params.code } })
    // A classical number the lexicon splits into senses has its own page. Any other code is
    // a sense: a number with one sense, or a code in another letter case, leads to the one
    // address of the sense that answered.
    const code = strongCodeSlug(entry.code)
    if (entry.kind === 'moved' || params.code !== code) {
      throw redirect({
        to: '/strong/$language/$code',
        params: { language: params.language, code },
        statusCode: 301,
      })
    }
    return entry
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {}
    return loaderData.kind === 'number'
      ? buildStrongNumberHead(loaderData)
      : buildStrongHead(loaderData)
  },
  // Only a whole rendered entry is kept for long: a page missing a part it could not read
  // is kept a minute, a failed load not at all.
  headers: ({ loaderData }) => pageCacheHeaders(loaderData),
  component: StrongRoute,
})

function StrongRoute() {
  const page = Route.useLoaderData()
  return page.kind === 'number' ? (
    <StrongNumberPage page={page} />
  ) : (
    <StrongEntryPage entry={page} />
  )
}
