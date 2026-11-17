import { createFileRoute } from '@tanstack/react-router'
import { RESOURCE_PAGE_CACHE_CONTROL } from '@/features/resources/publicSite'
import GivePage from '@/pages/give'
export const Route = createFileRoute('/fr/give')({ headers: () => ({ 'Cache-Control': RESOURCE_PAGE_CACHE_CONTROL }), component: GivePage, head: () => ({ meta: [{ title: 'Soutenir Bible Strong' }] }) })
