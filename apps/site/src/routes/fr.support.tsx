import { createFileRoute } from '@tanstack/react-router'
import Page from '@/pages/support'
export const Route = createFileRoute('/fr/support')({ component: Page, head: () => ({ meta: [{ title: 'Assistance - Bible Strong' }] }) })
