import type { ReactNode } from 'react'
import { twMerge } from '~common/ui/classNames'
import { colorWithOpacity, resolveThemeColor } from '~themes/colorValues'
import { useTheme } from '~themes/ThemeProvider'
import Box from './Box'

export const ICON_TILE_SIZE = 30

type IconTileProps = {
  children: ReactNode
  /** Palette token or color whose 12% tint fills the tile. */
  tint?: string
  /** Exact fill, for colors that already carry their tint (universe backgrounds). */
  bg?: string
  size?: number
  className?: string
}

/** The square that holds a row's icon. */
const IconTile = ({
  children,
  tint = 'grey',
  bg,
  size = ICON_TILE_SIZE,
  className,
}: IconTileProps) => {
  const theme = useTheme()
  return (
    <Box
      className={twMerge(
        'overflow-hidden border-continuous rounded-[8px] items-center justify-center',
        className
      )}
      style={{
        width: size,
        height: size,
        backgroundColor:
          resolveThemeColor(theme, bg) ?? colorWithOpacity(resolveThemeColor(theme, tint), 0.12),
      }}
    >
      {children}
    </Box>
  )
}

export default IconTile
