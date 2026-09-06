import type { ReactNode } from 'react'

/** Native touch layouts keep secondary actions visible. */
const HoverActionsRow = ({ children }: { children: (showActions: boolean) => ReactNode }) => (
  <>{children(true)}</>
)

export default HoverActionsRow
