import { twMerge } from '~common/ui/classNames'
import { colorWithOpacity, resolveThemeColor } from '~themes/colorValues'
import { useTheme } from '~themes/ThemeProvider'
import Box, { type BoxProps } from './Box'

/** How much of the light grey a well lets through: enough to set it off, little enough to keep the glass. */
const SHEET_WELL_OPACITY = 0.5

/** The fill of a group inside a sheet: translucent, so the sheet's glass still shows through it. */
export const useSheetWellColor = () =>
  colorWithOpacity(resolveThemeColor(useTheme(), 'lightGrey'), SHEET_WELL_OPACITY)

/**
 * A group inside a sheet. A sheet sets no background, so that the iOS glass shows the page through
 * it: what it holds sits in a translucent well rather than an opaque card, with no outline.
 */
const SheetWell = ({ className, style, ...props }: BoxProps) => {
  const backgroundColor = useSheetWellColor()
  return (
    <Box
      {...props}
      className={twMerge('overflow-hidden border-continuous rounded-[12px]', className)}
      style={[{ backgroundColor }, style]}
    />
  )
}

export default SheetWell
