import type { ReactNode } from 'react'

/** Touch actions stay visible unless the caller handles visibility through selection. */
const HoverActionsRow = ({
  children,
  showOnTouch = true,
}: {
  children: (showActions: boolean) => ReactNode
  showOnTouch?: boolean
}) => <>{children(showOnTouch)}</>

export default HoverActionsRow
