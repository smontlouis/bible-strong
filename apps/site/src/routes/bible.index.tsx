import { createFileRoute } from '@tanstack/react-router'
import { BibleHubPage } from '@/features/bible/BibleHubPages'
import { buildBibleHubHead } from '@/features/bible/bibleHead'
import { RESOURCE_PAGE_CACHE_CONTROL } from '@/features/resources/publicSite'

// `/bible` — the Bibles of the site, with the interface in English.
export const Route = createFileRoute('/bible/')({
  head: () => buildBibleHubHead('en'),
  headers: () => ({ 'Cache-Control': RESOURCE_PAGE_CACHE_CONTROL }),
  component: () => <BibleHubPage language="en" />,
})
