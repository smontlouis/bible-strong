import { resolveThemeColor } from '~themes/colorValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { twMerge } from '~common/ui/classNames'
import Box, { type BoxProps } from '~common/ui/Box'

type RadioProps = Omit<BoxProps, 'children'> & {
  selected: boolean
  size?: number
  selectedColor?: string
  unselectedColor?: string
}

const Radio = ({
  selected,
  size = 24,
  selectedColor = 'primary',
  unselectedColor = 'tertiary',
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
            width: size * 0.42,
            height: size * 0.42,
            borderRadius: (size * 0.42) / 2,
            backgroundColor: resolveThemeColor(stylingTheme, selectedColor),
          }}
        />
      )}
    </Box>
  )
}

export default Radio
