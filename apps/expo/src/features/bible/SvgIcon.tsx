import type { ComponentType, ComponentPropsWithRef as UIComponentProps } from 'react'
import React from 'react'
import * as NativeUI from 'react-native'
import type { SvgProps } from 'react-native-svg'
import { twMerge } from '~common/ui/classNames'

import type { Theme as AppTheme, Theme } from '~themes'
import { withTheme } from '~themes/ThemeProvider'

const Div = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.View>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge('flex-[1] items-center justify-center', className)
  return (
    <NativeUI.View
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof NativeUI.View>['style']}
    />
  )
}

type SvgIconProps = {
  isSelected?: boolean
  color?: keyof Theme['colors'] | string
  size?: number
  icon: ComponentType<SvgProps>
  theme: Theme
}

class SvgIcon extends React.Component<SvgIconProps> {
  render() {
    const { isSelected, color, size = 20, icon: Icon, theme } = this.props
    return (
      <Div>
        <Icon
          width={size}
          height={size}
          color={theme.colors[color as keyof Theme['colors']] || color}
          fill={isSelected ? theme.colors.primary : theme.colors.grey}
        />
      </Div>
    )
  }
}

export default withTheme(SvgIcon)
