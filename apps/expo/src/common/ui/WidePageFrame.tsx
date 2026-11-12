import type { ReactNode } from 'react'
import type { WidePage } from './widePage'

/**
 * Root of a page that may set two columns. The native apps keep one column and render the page
 * as it is; `WidePageFrame.web.tsx` measures it and widens its header.
 */
const WidePageFrame = ({ children }: { page: WidePage; width: number; children: ReactNode }) => (
  <>{children}</>
)

export default WidePageFrame
