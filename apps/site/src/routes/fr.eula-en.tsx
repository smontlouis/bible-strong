import { createFileRoute } from '@tanstack/react-router'
import { RESOURCE_PAGE_CACHE_CONTROL } from '@/features/resources/publicSite'
import Page from '@/pages/eula-en'
export const Route = createFileRoute('/fr/eula-en')({ headers: () => ({ 'Cache-Control': RESOURCE_PAGE_CACHE_CONTROL }), component: Page, head: () => ({ meta: [{ title: 'End-user license agreement - Bible Strong App' }] }) })
