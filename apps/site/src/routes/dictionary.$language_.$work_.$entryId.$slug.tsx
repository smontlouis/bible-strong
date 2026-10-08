import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import DictionaryEntryPage from '@/features/dictionary/DictionaryEntryPage'
import { loadDictionaryEntryPage } from '@/features/dictionary/dictionary.functions'
import { buildDictionaryEntryHead } from '@/features/dictionary/dictionaryHead'
import {
  parseDictionaryEntryId,
  parseDictionaryWorkRoute,
} from '@/features/dictionary/dictionaryRoutes'
import { resourcePageHeaders } from '@/features/resources/pageHeaders'

// `/dictionary/:language/:work/:entryId/:slug` — an article (ADR-0055).
export const Route = createFileRoute('/dictionary/$language_/$work_/$entryId/$slug')({
  beforeLoad: ({ params }) => {
    if (!parseDictionaryWorkRoute(params) || !parseDictionaryEntryId(params.entryId)) {
      throw notFound()
    }
  },
  loader: async ({ params }) => {
    const page = await loadDictionaryEntryPage({
      data: { language: params.language, work: params.work, entryId: params.entryId },
    })
    // The number resolves the article; the slug follows its current heading, so a stale
    // or misspelled address moves to the canonical one.
    const canonical = {
      language: page.language,
      work: page.work.id,
      entryId: String(page.id),
      slug: page.slug,
    }
    if (
      params.language !== canonical.language ||
      params.work !== canonical.work ||
      params.entryId !== canonical.entryId ||
      params.slug !== canonical.slug
    ) {
      throw redirect({
        to: '/dictionary/$language/$work/$entryId/$slug',
        params: canonical,
        statusCode: 301,
      })
    }
    return page
  },
  head: ({ loaderData }) => (loaderData ? buildDictionaryEntryHead(loaderData) : {}),
  // Only a rendered article is cacheable: a failed load must not be kept by the CDN.
  headers: ({ loaderData }) => resourcePageHeaders(loaderData),
  component: DictionaryEntryRoute,
})

function DictionaryEntryRoute() {
  return <DictionaryEntryPage page={Route.useLoaderData()} />
}
