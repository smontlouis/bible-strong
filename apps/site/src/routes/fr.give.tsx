import { createFileRoute } from '@tanstack/react-router'
import GivePage from '@/pages/give'
export const Route = createFileRoute('/fr/give')({ component: GivePage, head: () => ({ meta: [{ title: 'Soutenir Bible Strong' }] }) })
