import { Children, isValidElement } from 'react'
import Box from '~common/ui/Box'
import { useSelectionMenu } from '../selectionMenuContext'
import type { ActionsLayoutProps } from './ActionsLayout'

export default function ActionsLayout({ children, width }: ActionsLayoutProps) {
  const menu = useSelectionMenu()
  if (menu) return <Box className="w-full gap-[2px]">{children}</Box>
  return (
    <Box className="flex-row flex-wrap" style={{ width, flexShrink: 0 }}>
      {Children.toArray(children).map(child => (
        <Box key={isValidElement(child) ? child.key : String(child)} className="w-1/4 items-center">
          {child}
        </Box>
      ))}
    </Box>
  )
}
