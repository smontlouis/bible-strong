import { createFileRoute } from '@tanstack/react-router'
import Page from '@/pages/how-to-delete-data'
export const Route = createFileRoute('/fr/how-to-delete-data')({ component: Page, head: () => ({ meta: [{ title: 'Supprimer mon compte et mes données - Bible Strong' }] }) })
