import { createFileRoute } from '@tanstack/react-router'
import Page from '@/pages/eula'
export const Route = createFileRoute('/eula')({ component: Page, head: () => ({ meta: [{ title: 'Conditions générales - Bible Strong App' }] }) })
