import type { ReactNode } from 'react'
import Box from '~common/ui/Box'

export const PublicContentLoading = () => <Box className="flex-1 bg-reverse" />

const PublicContentLayout = ({ children }: { children: ReactNode }) => (
  <Box className="flex-1 min-h-0 bg-reverse">{children}</Box>
)

export default PublicContentLayout
