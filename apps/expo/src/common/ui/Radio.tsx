import { resolveThemeColor } from '~themes/colorValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { twMerge } from '~common/ui/classNames'
import Box, { type BoxProps } from '~common/ui/Box'

type RadioProps = Omit<BoxProps, 'children'> & {
  selected: boolean
  size?: number
  selectedColor?: string
  unselectedColor?: string
  dotColor?: string
}

// The app's only radio: a drawn circle, filled with a white dot when selected,
// matching Checkbox. Prefer it to `check-circle` / `circle` icons.
const Radio = ({
  selected,
  size = 24,
  selectedColor = 'primary',
  unselectedColor = 'tertiary',
  dotColor = 'white',
  ...boxProps
}: RadioProps) => {
  const stylingTheme = useStylingTheme()
  return (
    <Box
      {...boxProps}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: resolveThemeColor(stylingTheme, selected ? selectedColor : undefined),
          borderColor: resolveThemeColor(stylingTheme, selected ? selectedColor : unselectedColor),
        },
        boxProps.style,
      ]}
      className={twMerge(
        'overflow-hidden border-continuous',
        twMerge(
          'overflow-hidden border-continuous border-[2px] items-center justify-center',
          boxProps.className
        )
      )}
    >
      {selected && (
        <Box
          className="overflow-hidden border-continuous"
          style={{
            width: size * 0.36,
            height: size * 0.36,
            borderRadius: (size * 0.36) / 2,
            backgroundColor: resolveThemeColor(stylingTheme, dotColor),
          }}
        />
      )}
    </Box>
  )
}

export default Radio
