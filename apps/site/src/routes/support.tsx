import { createFileRoute } from '@tanstack/react-router'
import Page from '@/pages/support'
export const Route = createFileRoute('/support')({ component: Page, head: () => ({ meta: [{ title: 'Support - Bible Strong' }] }) })
