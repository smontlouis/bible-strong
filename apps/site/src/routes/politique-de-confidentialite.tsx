import { createFileRoute } from '@tanstack/react-router'
import { RESOURCE_PAGE_CACHE_CONTROL } from '@/features/resources/publicSite'
import Page from '@/pages/politique-de-confidentialite'
export const Route = createFileRoute('/politique-de-confidentialite')({ headers: () => ({ 'Cache-Control': RESOURCE_PAGE_CACHE_CONTROL }), component: Page, head: () => ({ meta: [{ title: 'Politique de confidentialité - Bible Strong App' }] }) })
