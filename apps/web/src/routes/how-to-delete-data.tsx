import { createFileRoute } from '@tanstack/react-router'
import Page from '@/pages/how-to-delete-data'
export const Route = createFileRoute('/how-to-delete-data')({ component: Page, head: () => ({ meta: [{ title: 'How to delete data? - Bible Strong App' }] }) })
