import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { ComponentType } from 'react'
import * as NativeUI from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import type { Theme as AppTheme } from '~themes'
import { useTheme } from '~themes/ThemeProvider'

import Text from '~common/ui/Text'

type SvgIconComponentProps = {
  width?: number
  height?: number
  size?: number
  color?: string
  fill?: string
}

const Touchable = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.TouchableOpacity>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const { disabled } = props
  const classStyles = useResolveClassNames(
    twMerge('flex-[1] items-center justify-center', className)
  )
  return (
    <NativeUI.TouchableOpacity
      {...props}
      style={
        [classStyles, { opacity: disabled ? 0.3 : 1 }, props.style] as UIComponentProps<
          typeof NativeUI.TouchableOpacity
        >['style']
      }
    />
  )
}

const TouchableSvgIcon = ({
  onPress,
  isSelected,
  color,
  size = 20,
  icon: Icon,
  label,
  disabled,
}: {
  onPress: () => void
  color?: string
  isSelected?: boolean
  size?: number
  icon: ComponentType<SvgIconComponentProps>
  noFlex?: boolean
  label?: string
  disabled?: boolean
}) => {
  const theme = useTheme()
  return (
    <Touchable onPress={onPress} disabled={disabled}>
      <Icon
        width={size}
        height={size}
        color={
          disabled ? theme.colors.grey : theme.colors[color as keyof typeof theme.colors] || color
        }
        fill={isSelected ? theme.colors.primary : theme.colors.grey}
      />
      {label && <Text className="mt-[5px] text-[9px] text-grey">{label}</Text>}
    </Touchable>
  )
}

export default TouchableSvgIcon
