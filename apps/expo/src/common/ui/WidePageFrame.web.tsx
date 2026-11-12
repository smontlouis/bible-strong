import type { ReactNode } from 'react'
import Box from './Box'
import { PageHeaderWidthContext } from './pageHeaderWidth'
import type { WidePage } from './widePage'

/**
 * Root of a page that may set two columns: it is what `useWidePage` measures, and it tells the
 * page's `Header` or `FiltersHeader` how wide the content under it is.
 */
const WidePageFrame = ({
  page,
  width,
  children,
}: {
  page: WidePage
  /** Width of the page's content while it is wide, gutters included. */
  width: number
  children: ReactNode
}) => (
  <Box ref={page.ref} className="flex-1">
    <PageHeaderWidthContext.Provider value={page.wide ? width : undefined}>
      {children}
    </PageHeaderWidthContext.Provider>
  </Box>
)

export default WidePageFrame
