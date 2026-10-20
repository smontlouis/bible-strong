import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { TouchableOpacityProps, ViewProps, TouchableOpacity, View } from 'react-native'
import { twMerge } from '~common/ui/classNames'

import type { Theme as AppTheme } from '~themes'

const Touchable = (
  componentProps: Omit<UIComponentProps<typeof TouchableOpacity>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge('flex-[1] items-center justify-center', className)
  return (
    <TouchableOpacity
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof TouchableOpacity>['style']}
    />
  )
}

type CircleStyleProps = {
  color: string
  size: number
}

const Container = (
  componentProps: Omit<UIComponentProps<typeof View>, keyof CircleStyleProps | 'theme'> &
    Omit<CircleStyleProps, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const { color, size } = props
  const resolvedClassName = twMerge('', className)
  return (
    <View
      {...props}
      className={resolvedClassName}
      style={
        [
          { width: size, height: size, borderRadius: size / 3, backgroundColor: color },
          props.style,
        ] as UIComponentProps<typeof View>['style']
      }
    />
  )
}

type TouchableCircleProps = ViewProps & {
  color: string
  onPress: TouchableOpacityProps['onPress']
  size?: number
}

const TouchableCircle = ({ color, onPress, size = 16, ...props }: TouchableCircleProps) => {
  return (
    <Touchable onPress={onPress}>
      <Container color={color} size={size} {...props} />
    </Touchable>
  )
}

export default TouchableCircle
