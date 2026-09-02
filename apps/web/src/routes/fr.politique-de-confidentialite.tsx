import { createFileRoute } from '@tanstack/react-router'
import Page from '@/pages/politique-de-confidentialite'
export const Route = createFileRoute('/fr/politique-de-confidentialite')({ component: Page, head: () => ({ meta: [{ title: 'Politique de confidentialité - Bible Strong App' }] }) })
