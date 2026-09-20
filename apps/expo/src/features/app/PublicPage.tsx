import type { ReactNode } from 'react'

const PublicPage = ({ children }: { title: string; children: ReactNode; onOpenApp?: () => void }) =>
  children

export default PublicPage
