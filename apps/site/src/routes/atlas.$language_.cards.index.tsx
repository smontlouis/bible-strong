import { createFileRoute } from '@tanstack/react-router'
import type { AtlasCardsPageData } from '@/features/atlas/atlas.functions'
import { buildAtlasCardsHead } from '@/features/atlas/atlasHead'

// The gallery with no card opened: its head is drawn from the gallery's data.
export const Route = createFileRoute('/atlas/$language_/cards/')({
  head: ({ matches }) => {
    const gallery = matches.find(match => (match.routeId as string) === '/atlas/$language_/cards')
      ?.loaderData as AtlasCardsPageData | undefined
    return gallery ? buildAtlasCardsHead(gallery) : {}
  },
  component: () => null,
})
