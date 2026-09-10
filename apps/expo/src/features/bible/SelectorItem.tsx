import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import * as NativeUI from 'react-native'
import { twMerge } from '~common/ui/classNames'

import type { Theme as AppTheme } from '~themes'
import { useTheme as useAppTheme } from '~themes/ThemeProvider'

import { wp } from '~helpers/utils'

const TouchableOpacity = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.TouchableOpacity>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge('items-center justify-center h-[45px]', className)
  return (
    <NativeUI.TouchableOpacity
      {...props}
      className={resolvedClassName}
      style={
        [{ width: wp(99) / 5 }, props.style] as UIComponentProps<
          typeof NativeUI.TouchableOpacity
        >['style']
      }
    />
  )
}

const Text = (
  componentProps: Omit<
    UIComponentProps<typeof NativeUI.Text>,
    keyof { isSelected?: boolean } | 'theme'
  > &
    Omit<{ isSelected?: boolean }, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { isSelected } = props
  const resolvedClassName = twMerge(
    'text-[16px] absolute inset-[0px] text-center justify-center items-center',
    className
  )
  return (
    <NativeUI.Text
      {...props}
      className={resolvedClassName}
      style={
        [
          {
            color: isSelected ? theme.colors.primary : theme.colors.default,
            fontWeight: isSelected ? 'bold' : 'normal',
          },
          props.style,
        ] as UIComponentProps<typeof NativeUI.Text>['style']
      }
    />
  )
}

type Props = {
  item: number
  isSelected?: boolean
  onChange: (item: number) => void
  onLongChange?: (item: number) => void
}

const SelectorItem = ({ item, isSelected, onChange, onLongChange }: Props) => (
  <TouchableOpacity
    accessibilityRole="button"
    onPress={() => onChange(item)}
    onLongPress={() => onLongChange?.(item)}
  >
    <Text isSelected={isSelected}>{item}</Text>
  </TouchableOpacity>
)

export default SelectorItem
