import React from 'react'
import styled from '@emotion/native'
import { withTheme } from '@emotion/react'
import type { ComponentType } from 'react'
import type { SvgProps } from 'react-native-svg'
import type { Theme } from '~themes'

const Div = styled.View(() => ({
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
}))

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
