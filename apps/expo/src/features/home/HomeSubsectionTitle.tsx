import type { ReactNode } from 'react'
import Box from '~common/ui/Box'
import { twMerge } from '~common/ui/classNames'
import Text from '~common/ui/Text'

/**
 * Small title of a part inside a home section (« Reprendre » and « Mes plans » under « Ma
 * bibliothèque »). The row keeps the height of an action link, so parts line up with or without
 * one.
 */
const HomeSubsectionTitle = ({
  title,
  action,
  className,
}: {
  title: string
  action?: ReactNode
  /** Side-by-side parts carry the gutters themselves and pass `px-0`. */
  className?: string
}) => (
  <Box
    className={twMerge(
      'flex-row items-center justify-between gap-[12px] min-h-[44px] px-[20px] pt-[12px]',
      className
    )}
  >
    <Text accessibilityRole="header" className="shrink text-[16px] font-bold">
      {title}
    </Text>
    {action}
  </Box>
)

export default HomeSubsectionTitle
