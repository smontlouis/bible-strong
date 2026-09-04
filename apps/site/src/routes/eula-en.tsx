import { createFileRoute } from '@tanstack/react-router'
import Page from '@/pages/eula-en'
export const Route = createFileRoute('/eula-en')({ component: Page, head: () => ({ meta: [{ title: 'End-user license agreement - Bible Strong App' }] }) })
