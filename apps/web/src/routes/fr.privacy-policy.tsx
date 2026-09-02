import { createFileRoute } from '@tanstack/react-router'
import Page from '@/pages/privacy-policy'
export const Route = createFileRoute('/fr/privacy-policy')({ component: Page, head: () => ({ meta: [{ title: 'Privacy Policy - Bible Strong App' }] }) })
