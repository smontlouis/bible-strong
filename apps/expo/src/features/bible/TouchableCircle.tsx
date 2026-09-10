import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import * as NativeUI from 'react-native'
import { TouchableOpacityProps, ViewProps } from 'react-native'
import { twMerge } from '~common/ui/classNames'

import type { Theme as AppTheme } from '~themes'

const Touchable = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.TouchableOpacity>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge('flex-[1] items-center justify-center', className)
  return (
    <NativeUI.TouchableOpacity
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof NativeUI.TouchableOpacity>['style']}
    />
  )
}

type CircleStyleProps = {
  color: string
  size: number
}

const Container = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.View>, keyof CircleStyleProps | 'theme'> &
    Omit<CircleStyleProps, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const { color, size } = props
  const resolvedClassName = twMerge('', className)
  return (
    <NativeUI.View
      {...props}
      className={resolvedClassName}
      style={
        [
          { width: size, height: size, borderRadius: size / 3, backgroundColor: color },
          props.style,
        ] as UIComponentProps<typeof NativeUI.View>['style']
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
