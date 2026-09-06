import { resolveThemeColor } from '~themes/colorValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { twMerge } from '~common/ui/classNames'
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
  const stylingTheme = useStylingTheme()

  if (variant === 'icon') {
    return (
      <Box
        {...boxProps}
        style={[{ width: size, height: size }, boxProps.style]}
        className={twMerge(
          'overflow-hidden border-continuous',
          twMerge(
            'overflow-hidden border-continuous items-center justify-center',
            boxProps.className
          )
        )}
      >
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
      {...boxProps}
      style={[
        {
          width: size,
          height: size,
          backgroundColor: resolveThemeColor(
            stylingTheme,
            checked && fillChecked ? checkedColor : undefined
          ),
          borderColor: resolveThemeColor(stylingTheme, checked ? checkedColor : uncheckedColor),
        },
        boxProps.style,
      ]}
      className={twMerge(
        'overflow-hidden border-continuous',
        twMerge(
          'overflow-hidden border-continuous rounded-[6px] border-[2px] items-center justify-center',
          boxProps.className
        )
      )}
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
