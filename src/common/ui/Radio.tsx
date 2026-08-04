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
}: RadioProps) => (
  <Box
    width={size}
    height={size}
    borderRadius={size / 2}
    borderWidth={2}
    borderColor={selected ? selectedColor : unselectedColor}
    center
    {...boxProps}
  >
    {selected && (
      <Box
        width={size * 0.42}
        height={size * 0.42}
        borderRadius={(size * 0.42) / 2}
        bg={selectedColor}
      />
    )}
  </Box>
)

export default Radio
