import React from 'react'
import styled from '@emotion/native'
import { withTheme } from '@emotion/react'

const Div = styled.View(() => ({
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
}))

class SvgIcon extends React.Component<any> {
  render() {
    // @ts-ignore
    const { isSelected, color, size = 20, icon: Icon, theme } = this.props
    return (
      <Div>
        <Icon
          width={size}
          height={size}
          color={theme.colors[color]}
          fill={isSelected ? theme.colors.primary : theme.colors.grey}
        />
      </Div>
    )
  }
}

export default withTheme(SvgIcon)
