import { createFileRoute } from '@tanstack/react-router'
import { BibleHubPage } from '@/features/bible/BibleHubPages'
import { buildBibleHubHead } from '@/features/bible/bibleHead'
import { RESOURCE_PAGE_CACHE_CONTROL } from '@/features/resources/publicSite'

// `/fr/bible` — the Bibles of the site, with the interface in French.
export const Route = createFileRoute('/fr/bible')({
  head: () => buildBibleHubHead('fr'),
  headers: () => ({ 'Cache-Control': RESOURCE_PAGE_CACHE_CONTROL }),
  component: () => <BibleHubPage language="fr" />,
})
