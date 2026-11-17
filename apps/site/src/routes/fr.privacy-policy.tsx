import { createFileRoute } from '@tanstack/react-router'
import { RESOURCE_PAGE_CACHE_CONTROL } from '@/features/resources/publicSite'
import Page from '@/pages/privacy-policy'
export const Route = createFileRoute('/fr/privacy-policy')({ headers: () => ({ 'Cache-Control': RESOURCE_PAGE_CACHE_CONTROL }), component: Page, head: () => ({ meta: [{ title: 'Privacy Policy - Bible Strong App' }] }) })
