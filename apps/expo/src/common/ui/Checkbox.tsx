import Box, { BoxProps } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'

type CheckboxVariant = 'outline' | 'icon'

type CheckboxProps = Omit<BoxProps, 'children'> & {
  checked: boolean
  variant?: CheckboxVariant
  size?: number
  iconSize?: number
  checkedColor?: string
  uncheckedColor?: string
  checkColor?: string
  fillChecked?: boolean
}

const Checkbox = ({
  checked,
  variant = 'outline',
  size = 24,
  iconSize,
  checkedColor = 'primary',
  uncheckedColor = 'tertiary',
  checkColor = 'primary',
  fillChecked = false,
  ...boxProps
}: CheckboxProps) => {
  if (variant === 'icon') {
    return (
      <Box center width={size} height={size} {...boxProps}>
        <FeatherIcon
          name={checked ? 'check-square' : 'square'}
          size={iconSize ?? size}
          color={checked ? checkedColor : uncheckedColor}
        />
      </Box>
    )
  }

  return (
    <Box
      width={size}
      height={size}
      borderRadius={6}
      borderWidth={2}
      borderColor={checked ? checkedColor : uncheckedColor}
      bg={checked && fillChecked ? checkedColor : undefined}
      center
      {...boxProps}
    >
      {checked && (
        <FeatherIcon
          name="check"
          size={iconSize ?? 14}
          color={fillChecked ? checkColor : checkedColor}
        />
      )}
    </Box>
  )
}

export default Checkbox
