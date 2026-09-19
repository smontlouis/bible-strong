import { createFileRoute } from '@tanstack/react-router'
import Page from '@/pages/data-deletion'
export const Route = createFileRoute('/fr/data-deletion')({ component: Page, head: () => ({ meta: [{ title: 'Supprimer mon compte et mes données - Bible Strong' }] }) })
