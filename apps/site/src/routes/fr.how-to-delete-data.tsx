import { createFileRoute } from '@tanstack/react-router'
import { RESOURCE_PAGE_CACHE_CONTROL } from '@/features/resources/publicSite'
import Page from '@/pages/how-to-delete-data'
export const Route = createFileRoute('/fr/how-to-delete-data')({ headers: () => ({ 'Cache-Control': RESOURCE_PAGE_CACHE_CONTROL }), component: Page, head: () => ({ meta: [{ title: 'Supprimer mon compte et mes données - Bible Strong' }] }) })
