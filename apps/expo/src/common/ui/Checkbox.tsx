import { resolveThemeColor } from '~themes/colorValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { twMerge } from '~common/ui/classNames'
import Box, { BoxProps } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'

type CheckboxProps = Omit<BoxProps, 'children'> & {
  checked: boolean
  size?: number
  iconSize?: number
  checkedColor?: string
  uncheckedColor?: string
  checkColor?: string
}

// The app's only checkbox: a drawn square, filled when checked. Prefer it to
// `check-square` / `square` icons so every list reads the same way.
const Checkbox = ({
  checked,
  size = 24,
  iconSize,
  checkedColor = 'primary',
  uncheckedColor = 'tertiary',
  checkColor = 'white',
  ...boxProps
}: CheckboxProps) => {
  const stylingTheme = useStylingTheme()

  return (
    <Box
      {...boxProps}
      style={[
        {
          width: size,
          height: size,
          backgroundColor: resolveThemeColor(stylingTheme, checked ? checkedColor : undefined),
          borderColor: resolveThemeColor(stylingTheme, checked ? checkedColor : uncheckedColor),
        },
        boxProps.style,
      ]}
      className={twMerge(
        'overflow-hidden border-continuous',
        twMerge(
          'overflow-hidden border-continuous rounded-[4px] border-[2px] items-center justify-center',
          boxProps.className
        )
      )}
    >
      {checked && (
        <FeatherIcon name="check" size={iconSize ?? Math.round(size * 0.6)} color={checkColor} />
      )}
    </Box>
  )
}

export default Checkbox
